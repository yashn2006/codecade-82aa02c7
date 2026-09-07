-- v33 — Subscription dashboard, extension history and manual billing (UPI proof flow)
-- Safe to re-run.

-- Platform-level payment details shown to owners (admin's UPI / QR).
alter table public.platform_settings
  add column if not exists billing_upi_id text,
  add column if not exists billing_qr_url text,
  add column if not exists billing_note text,
  add column if not exists billing_monthly_price_paise int not null default 99900;

-- 1. Extension history -------------------------------------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  added_days int not null,
  new_ends_at timestamptz,
  amount_paise int,
  source text not null default 'manual',   -- manual | payment
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_cafe_idx on public.subscription_events (cafe_id, created_at desc);

grant select on public.subscription_events to authenticated;
grant all on public.subscription_events to service_role;
alter table public.subscription_events enable row level security;

drop policy if exists "owners read own subscription events" on public.subscription_events;
create policy "owners read own subscription events"
on public.subscription_events for select to authenticated
using (
  exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())
  or public.has_role(auth.uid(), 'super_admin')
);

-- 2. Invoices / charges ------------------------------------------------------
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

grant select, update on public.cafe_invoices to authenticated;
grant all on public.cafe_invoices to service_role;
alter table public.cafe_invoices enable row level security;

drop policy if exists "owners read own invoices" on public.cafe_invoices;
create policy "owners read own invoices"
on public.cafe_invoices for select to authenticated
using (
  exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())
  or public.has_role(auth.uid(), 'super_admin')
);

-- 3. Extension helper that also records history ------------------------------
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
