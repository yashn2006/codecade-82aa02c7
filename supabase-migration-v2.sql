-- ============================================================================
-- CoreCade — Phase 2B Patch (run AFTER supabase-migration.sql)
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE.
-- Paste into Supabase SQL editor.
-- ============================================================================

-- 1. STAFF / OWNER CAN INSERT BOOKINGS ----------------------------------------
drop policy if exists "customer creates booking" on public.bookings;
create policy "customer creates booking" on public.bookings for insert to authenticated
  with check (
    exists (select 1 from public.customers cu where cu.id = bookings.customer_id and cu.user_id = auth.uid())
    or exists (select 1 from public.cafes c where c.id = bookings.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = bookings.cafe_id and sp.staff_user_id = auth.uid())
    or public.has_role(auth.uid(), 'super_admin')
  );

-- 2. MEMBERSHIPS: full CRUD by owner / super_admin ----------------------------
-- (existing policies already cover this via memberships.cafe_id check; reaffirm)
drop policy if exists "memberships owner manage" on public.memberships;
create policy "memberships owner manage" on public.memberships for all to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = memberships.cafe_id and c.owner_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = memberships.cafe_id and c.owner_id = auth.uid())
  );

-- 3. CUSTOMER_MEMBERSHIPS: owner/staff can grant ------------------------------
drop policy if exists "customer membership manage" on public.customer_memberships;
create policy "customer membership manage" on public.customer_memberships for all to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (
      select 1 from public.memberships m
      join public.cafes c on c.id = m.cafe_id
      where m.id = customer_memberships.membership_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.memberships m
      join public.staff_permissions sp on sp.cafe_id = m.cafe_id
      where m.id = customer_memberships.membership_id and sp.staff_user_id = auth.uid()
    )
  )
  with check (
    public.has_role(auth.uid(), 'super_admin')
    or exists (
      select 1 from public.memberships m
      join public.cafes c on c.id = m.cafe_id
      where m.id = customer_memberships.membership_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.memberships m
      join public.staff_permissions sp on sp.cafe_id = m.cafe_id
      where m.id = customer_memberships.membership_id and sp.staff_user_id = auth.uid()
    )
  );

-- 4. WALLET LEDGER ------------------------------------------------------------
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  amount integer not null, -- positive = credit, negative = debit
  kind text not null default 'topup', -- topup | session | refund | adjust
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_tx_customer on public.wallet_transactions(customer_id, created_at desc);

grant select, insert on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;

alter table public.wallet_transactions enable row level security;

drop policy if exists "wallet tx read" on public.wallet_transactions;
create policy "wallet tx read" on public.wallet_transactions for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = wallet_transactions.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = wallet_transactions.cafe_id and sp.staff_user_id = auth.uid())
    or exists (select 1 from public.customers cu where cu.id = wallet_transactions.customer_id and cu.user_id = auth.uid())
  );

drop policy if exists "wallet tx insert by staff" on public.wallet_transactions;
create policy "wallet tx insert by staff" on public.wallet_transactions for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = wallet_transactions.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = wallet_transactions.cafe_id and sp.staff_user_id = auth.uid())
  );

-- 5. RPC: apply wallet transaction (atomic balance update) --------------------
create or replace function public.apply_wallet_tx(
  _customer_id uuid,
  _cafe_id uuid,
  _amount integer,
  _kind text,
  _note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_allowed boolean;
begin
  -- authorize: super_admin OR cafe owner/staff for this cafe
  select
    public.has_role(v_user, 'super_admin')
    or exists (select 1 from public.cafes c where c.id = _cafe_id and c.owner_id = v_user)
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = _cafe_id and sp.staff_user_id = v_user)
  into v_allowed;
  if not v_allowed then raise exception 'forbidden'; end if;

  update public.customers
     set wallet_balance = greatest(0, wallet_balance + _amount)
   where id = _customer_id and cafe_id = _cafe_id;

  insert into public.wallet_transactions (customer_id, cafe_id, amount, kind, note, created_by)
  values (_customer_id, _cafe_id, _amount, _kind, _note, v_user);
end;
$$;

grant execute on function public.apply_wallet_tx(uuid, uuid, integer, text, text) to authenticated;

-- 6. STAFF INVITES: allow owner to read profile email by id (for staff list) --
-- Already covered by has_role(super_admin) read of profiles; cafe owners need
-- to read their staff members' profiles too:
drop policy if exists "cafe owner reads staff profiles" on public.profiles;
create policy "cafe owner reads staff profiles" on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.staff_permissions sp
      join public.cafes c on c.id = sp.cafe_id
      where sp.staff_user_id = profiles.id and c.owner_id = auth.uid()
    )
  );

-- 7. SESSIONS LEDGER VIEW (today's revenue per cafe) --------------------------
create or replace view public.v_sessions_today as
  select cafe_id, count(*) as session_count, coalesce(sum(amount), 0)::int as revenue
  from public.sessions
  where ended_at >= date_trunc('day', now())
  group by cafe_id;

grant select on public.v_sessions_today to authenticated, service_role;

-- 8. CAFE SUBSCRIPTIONS (manual activation; Razorpay later) -------------------
create table if not exists public.cafe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active', -- active | paused | cancelled
  current_period_end timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cafe_sub_cafe on public.cafe_subscriptions(cafe_id);

grant select on public.cafe_subscriptions to authenticated;
grant all on public.cafe_subscriptions to service_role;

alter table public.cafe_subscriptions enable row level security;
drop policy if exists "cafe sub read" on public.cafe_subscriptions;
create policy "cafe sub read" on public.cafe_subscriptions for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = cafe_subscriptions.cafe_id and c.owner_id = auth.uid())
  );
