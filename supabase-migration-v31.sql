-- v31 — Admin-assigned plans (trial vs monthly) + manual subscription extension
-- Safe to re-run.

alter table public.profiles
  add column if not exists plan_type text not null default 'trial',
  add column if not exists plan_days int  not null default 15;

comment on column public.profiles.plan_type is 'Plan the super-admin assigned at user creation: trial | monthly';
comment on column public.profiles.plan_days is 'Number of days granted when this owner creates their cafe';

alter table public.cafes
  add column if not exists subscription_status text default 'trialing',
  add column if not exists trial_ends_at timestamptz;

-- extend_trial(): adds days on top of the later of (now, current end date)
create or replace function public.extend_trial(_cafe_id uuid, _add_days int, _reason text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new timestamptz;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden';
  end if;

  update public.cafes
     set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + (_add_days || ' days')::interval,
         subscription_status = 'active'
   where id = _cafe_id
  returning trial_ends_at into v_new;

  return v_new;
end;
$$;

grant execute on function public.extend_trial(uuid, int, text) to authenticated;
