-- v20: Referral system + white-label-lite (logo + accent) on cafes.
--
-- Referral flow:
-- 1) Each cafe gets a unique referral code (auto-generated).
-- 2) When a NEW cafe is created with `referred_by_code`, we record a referral.
-- 3) On their first paid month (or admin-triggered), both cafes get +30 trial days
--    via redeem_referral(_referral_id). MVP: we expose redeem_referral; admin or
--    payment hook calls it.
--
-- White-label-lite:
-- - cafes.logo_url, cafes.accent_color → shown on public /c/<slug> page.

-- ---------- White-label fields ----------
alter table public.cafes
  add column if not exists logo_url     text,
  add column if not exists accent_color text;

-- ---------- Referral fields & tables ----------
alter table public.cafes
  add column if not exists referral_code text unique;

-- Backfill / generator
create or replace function public._gen_referral_code()
returns text language sql stable as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

update public.cafes set referral_code = public._gen_referral_code()
where referral_code is null;

create or replace function public._cafe_referral_default()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := public._gen_referral_code();
  end if;
  return new;
end$$;

drop trigger if exists trg_cafe_referral_default on public.cafes;
create trigger trg_cafe_referral_default
before insert on public.cafes
for each row execute function public._cafe_referral_default();

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_cafe_id uuid not null references public.cafes(id) on delete cascade,
  referred_cafe_id uuid not null references public.cafes(id) on delete cascade,
  code_used text not null,
  status text not null default 'pending'
    check (status in ('pending','redeemed','expired')),
  bonus_days int not null default 30,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (referred_cafe_id)
);

create index if not exists idx_ref_referrer on public.referrals(referrer_cafe_id, status);
create index if not exists idx_ref_status on public.referrals(status);

grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;

drop policy if exists "ref read own" on public.referrals;
create policy "ref read own" on public.referrals for select to authenticated
using (
  exists (select 1 from public.cafes c
          where (c.id = referrer_cafe_id or c.id = referred_cafe_id)
            and c.owner_id = auth.uid())
  or public.has_role(auth.uid(), 'super_admin')
);

-- ---------- Apply referral on cafe insert (if owner passes code in metadata) ----------
-- For MVP: a server fn calls apply_referral_code(_new_cafe_id, _code) right after insert.
create or replace function public.apply_referral_code(_new_cafe_id uuid, _code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ref_cafe uuid;
  v_id uuid;
begin
  if _code is null or _code = '' then return null; end if;
  select id into v_ref_cafe from public.cafes where referral_code = upper(_code) limit 1;
  if v_ref_cafe is null or v_ref_cafe = _new_cafe_id then return null; end if;
  insert into public.referrals (referrer_cafe_id, referred_cafe_id, code_used)
  values (v_ref_cafe, _new_cafe_id, upper(_code))
  on conflict (referred_cafe_id) do nothing
  returning id into v_id;
  return v_id;
end$$;

grant execute on function public.apply_referral_code(uuid, text) to authenticated, service_role;

-- ---------- Redeem referral: +30 trial days to BOTH cafes ----------
create or replace function public.redeem_referral(_referral_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select * into r from public.referrals where id = _referral_id and status = 'pending';
  if r is null then return; end if;

  update public.cafes
    set trial_ends_at = greatest(trial_ends_at, now()) + (r.bonus_days || ' days')::interval,
        subscription_status = case when subscription_status = 'expired' then 'trialing' else subscription_status end
    where id in (r.referrer_cafe_id, r.referred_cafe_id);

  update public.referrals set status = 'redeemed', redeemed_at = now() where id = r.id;

  -- notify both owners
  insert into public.notifications (user_id, cafe_id, kind, title, body, link)
  select c.owner_id, c.id, 'referral_redeemed',
         '+' || r.bonus_days || ' trial days unlocked',
         'Your referral bonus was applied. Enjoy extra days on us.',
         '/owner'
  from public.cafes c
  where c.id in (r.referrer_cafe_id, r.referred_cafe_id);
end$$;

grant execute on function public.redeem_referral(uuid) to service_role;
