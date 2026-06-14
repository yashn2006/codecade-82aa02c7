-- ============================================================
-- v18 — 15-day free trial system
-- ============================================================

-- Trial fields on cafes
alter table public.cafes
  add column if not exists trial_starts_at timestamptz not null default now(),
  add column if not exists trial_ends_at   timestamptz not null default (now() + interval '15 days'),
  add column if not exists plan            text        not null default 'trial'
    check (plan in ('trial','starter','pro','enterprise')),
  add column if not exists subscription_status text   not null default 'trialing'
    check (subscription_status in ('trialing','active','expired','past_due','canceled'));

comment on column public.cafes.trial_ends_at is 'When the 15-day free trial expires. After this, subscription_status flips to expired and writes are blocked until upgrade.';

create index if not exists cafes_trial_ends_at_idx on public.cafes(trial_ends_at);
create index if not exists cafes_subscription_status_idx on public.cafes(subscription_status);

-- Helper: is a cafe currently active (paid OR within trial)
create or replace function public.is_cafe_active(_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select subscription_status in ('trialing','active')
       and (subscription_status = 'active' or trial_ends_at > now())
       from public.cafes where id = _cafe_id),
    false
  )
$$;

-- Daily sweep: flip expired trials. Called by pg_cron (or manually).
create or replace function public.expire_lapsed_trials()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with upd as (
    update public.cafes
       set subscription_status = 'expired'
     where subscription_status = 'trialing'
       and trial_ends_at <= now()
    returning id, owner_id, name
  ),
  notif as (
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    select owner_id, id, 'trial_expired',
           '⏰ Free trial ended for ' || name,
           'Your 15-day CoreCade trial has ended. Upgrade to keep your café running.',
           '/owner'
      from upd where owner_id is not null
    returning 1
  )
  select count(*)::int into n from upd;
  return n;
end $$;

grant execute on function public.is_cafe_active(uuid) to authenticated;
grant execute on function public.expire_lapsed_trials() to service_role;

-- Schedule daily sweep (08:00 UTC) — requires pg_cron extension.
-- Safe to skip in environments without pg_cron; call manually via the admin UI.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('corecade_expire_trials') where exists (
      select 1 from cron.job where jobname = 'corecade_expire_trials'
    );
    perform cron.schedule(
      'corecade_expire_trials', '0 8 * * *',
      $cron$ select public.expire_lapsed_trials(); $cron$
    );
  end if;
exception when others then null; end $$;

-- Welcome notification now mentions the 15-day trial
create or replace function public._on_cafe_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      new.owner_id, new.id, 'welcome_cafe',
      '🎉 Welcome to CoreCade, ' || coalesce(new.name, 'partner') || '!',
      'Your café is live with a 15-day free trial. Add devices, set rates, and take your first booking. Need help? Visit the Help Center anytime.',
      '/owner/help'
    );
  end if;
  perform public._notify_super_admins(
    'new_cafe',
    'New café onboarded: ' || new.name,
    'A new café "' || new.name || '" was created on the platform.',
    '/admin/cafes'
  );
  return new;
end $$;
