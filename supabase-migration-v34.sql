-- ============================================================================
-- Supabase Migration v34: Complete, Self-Contained & Zero-Error
-- (Run this script in Supabase SQL Editor -> New Query -> Run)
-- Safe to re-run multiple times (fully idempotent).
-- Does NOT require any Supabase Edge Functions!
-- ============================================================================

-- 0. Helper: has_role (text overload so RLS checks never fail) -----------------
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text = _role
  );
$$;

grant execute on function public.has_role(uuid, text) to authenticated, anon, service_role;

-- 1. Notifications Table & Policies --------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cafe_id uuid references public.cafes(id) on delete cascade,
  kind text not null default 'general',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

drop policy if exists "notif own read" on public.notifications;
create policy "notif own read"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications self update" on public.notifications;
drop policy if exists "notif own update" on public.notifications;
create policy "notifications self update"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications self delete" on public.notifications;
create policy "notifications self delete"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- 2. Platform Settings (Billing UPI & Launch Pricing) --------------------------
create table if not exists public.platform_settings (
  id boolean primary key default true,
  billing_upi_id text,
  billing_qr_url text,
  billing_note text,
  billing_monthly_price_paise int not null default 99900,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.platform_settings
  add column if not exists billing_upi_id text,
  add column if not exists billing_qr_url text,
  add column if not exists billing_note text,
  add column if not exists billing_monthly_price_paise int not null default 99900;

insert into public.platform_settings (id, billing_monthly_price_paise)
values (true, 99900)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
grant select on public.platform_settings to authenticated, anon;
grant all on public.platform_settings to service_role;

drop policy if exists "anyone can read platform settings" on public.platform_settings;
create policy "anyone can read platform settings"
  on public.platform_settings for select to authenticated, anon
  using (true);

-- 3. Subscription Extension Events ---------------------------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  added_days int not null,
  new_ends_at timestamptz,
  amount_paise int,
  source text not null default 'manual',
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_cafe_idx on public.subscription_events (cafe_id, created_at desc);

alter table public.subscription_events enable row level security;
grant select on public.subscription_events to authenticated;
grant all on public.subscription_events to service_role;

drop policy if exists "owners read own subscription events" on public.subscription_events;
create policy "owners read own subscription events"
  on public.subscription_events for select to authenticated
  using (
    exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'super_admin')
  );

-- 4. Café Invoices & Upgrade Plans Submission ----------------------------------
create table if not exists public.cafe_invoices (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  amount_paise int not null,
  days int not null default 30,
  status text not null default 'pending',  -- pending | submitted | approved | rejected
  note text,
  txn_ref text,
  proof_url text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists cafe_invoices_cafe_idx on public.cafe_invoices (cafe_id, created_at desc);
create index if not exists cafe_invoices_status_idx on public.cafe_invoices (status);

alter table public.cafe_invoices enable row level security;
grant select, insert, update on public.cafe_invoices to authenticated;
grant all on public.cafe_invoices to service_role;

drop policy if exists "owners read own invoices" on public.cafe_invoices;
create policy "owners read own invoices"
  on public.cafe_invoices for select to authenticated
  using (
    exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'super_admin')
  );

drop policy if exists "owners insert own invoices" on public.cafe_invoices;
create policy "owners insert own invoices"
  on public.cafe_invoices for insert to authenticated
  with check (
    exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'super_admin')
  );

drop policy if exists "owners update own invoices" on public.cafe_invoices;
create policy "owners update own invoices"
  on public.cafe_invoices for update to authenticated
  using (
    exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())
    or public.has_role(auth.uid(), 'super_admin')
  );

-- 5. Stored Procedure: extend_subscription -------------------------------------
create or replace function public.extend_subscription(
  _cafe_id uuid, _add_days int, _reason text default null,
  _amount_paise int default null, _source text default 'manual'
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_new timestamptz;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden';
  end if;

  update public.cafes
     set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + (_add_days || ' days')::interval,
         subscription_status = 'active'
   where id = _cafe_id
  returning trial_ends_at into v_new;

  insert into public.subscription_events (cafe_id, added_days, new_ends_at, amount_paise, source, reason, created_by)
  values (_cafe_id, _add_days, v_new, _amount_paise, coalesce(_source, 'manual'), _reason, auth.uid());

  return v_new;
end;
$$;

grant execute on function public.extend_subscription(uuid, int, text, int, text) to authenticated;

-- 6. Customer Wallet Topup Requests Table --------------------------------------
create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_rupees numeric not null,
  txn_ref text not null,
  proof_url text,
  status text not null default 'pending', -- pending | approved | rejected
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists topup_requests_user_idx on public.topup_requests (user_id, created_at desc);

alter table public.topup_requests enable row level security;
grant select, insert, update on public.topup_requests to authenticated;
grant all on public.topup_requests to service_role;

drop policy if exists "users read own topup requests" on public.topup_requests;
create policy "users read own topup requests"
  on public.topup_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "users insert own topup requests" on public.topup_requests;
create policy "users insert own topup requests"
  on public.topup_requests for insert to authenticated
  with check (user_id = auth.uid());

-- 7. Automated Booking Status Change Trigger -----------------------------------
create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cafe_name text;
  v_customer_user_id uuid;
begin
  if new.status is distinct from old.status and new.status in ('confirmed', 'cancelled') then
    select name into v_cafe_name from public.cafes where id = new.cafe_id;

    select user_id into v_customer_user_id
    from public.customers
    where id = new.customer_id;

    if v_customer_user_id is not null then
      insert into public.notifications (user_id, kind, title, body, link)
      values (
        v_customer_user_id,
        'booking',
        case when new.status = 'confirmed' then 'Booking Confirmed! 🎮' else 'Booking Cancelled' end,
        case
          when new.status = 'confirmed' then coalesce(v_cafe_name, 'Café') || ' confirmed your station booking for ' || to_char(new.scheduled_at, 'DD Mon, HH:MI AM') || '.'
          else coalesce(v_cafe_name, 'Café') || ' cancelled your booking. Any paid deposit has been refunded to your wallet.'
        end,
        '/portal'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_booking_status on public.bookings;
create trigger trg_notify_booking_status
  after update on public.bookings
  for each row
  execute function public.notify_booking_status_change();
