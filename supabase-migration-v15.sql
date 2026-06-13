-- ============================================================
-- v15 — Real-time notification triggers
-- Inserts rows into public.notifications when key events happen.
-- The NotificationBell already subscribes via Supabase realtime, so any
-- INSERT here surfaces in the UI within seconds.
-- ============================================================

-- Helper: notify every super_admin
create or replace function public._notify_super_admins(
  _kind text, _title text, _body text, _link text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select ur.user_id, _kind, _title, _body, _link
  from public.user_roles ur
  where ur.role = 'super_admin';
end;
$$;

-- ===== New booking → notify customer + cafe owner ============================
create or replace function public._on_booking_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_cafe_name text;
  v_link text;
begin
  select owner_id, name into v_owner, v_cafe_name
  from public.cafes where id = new.cafe_id;

  -- Notify the customer who booked
  if new.customer_id is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      new.customer_id, new.cafe_id, 'booking_confirmed',
      'Booking confirmed at ' || coalesce(v_cafe_name, 'café'),
      'Your slot is locked in. See you soon!',
      '/portal'
    );
  end if;

  -- Notify the café owner
  if v_owner is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      v_owner, new.cafe_id, 'new_booking',
      'New booking received',
      'A customer just booked a slot at ' || coalesce(v_cafe_name, 'your café') || '.',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_booking_notify on public.bookings;
create trigger trg_booking_notify
  after insert on public.bookings
  for each row execute function public._on_booking_insert();

-- ===== New café → notify super admins =======================================
create or replace function public._on_cafe_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._notify_super_admins(
    'new_cafe',
    'New café onboarded: ' || new.name,
    'A new café "' || new.name || '" was created on the platform.',
    '/admin/cafes'
  );
  return new;
end;
$$;

drop trigger if exists trg_cafe_notify on public.cafes;
create trigger trg_cafe_notify
  after insert on public.cafes
  for each row execute function public._on_cafe_insert();

-- ===== New user signup → notify super admins =================================
create or replace function public._on_profile_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._notify_super_admins(
    'new_user',
    'New user joined',
    coalesce(new.email, new.full_name, 'A new user') || ' just signed up.',
    '/admin/users'
  );
  return new;
end;
$$;

drop trigger if exists trg_profile_notify on public.profiles;
create trigger trg_profile_notify
  after insert on public.profiles
  for each row execute function public._on_profile_insert();

-- ===== New membership → notify customer + owner =============================
create or replace function public._on_membership_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_cafe_name text;
begin
  select owner_id, name into v_owner, v_cafe_name
  from public.cafes where id = new.cafe_id;

  if new.customer_id is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      new.customer_id, new.cafe_id, 'membership',
      'Membership activated',
      'Your membership at ' || coalesce(v_cafe_name, 'the café') || ' is now active.',
      '/portal'
    );
  end if;

  if v_owner is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      v_owner, new.cafe_id, 'new_membership',
      'New membership sold',
      'A customer just joined your membership program.',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_membership_notify on public.memberships;
create trigger trg_membership_notify
  after insert on public.memberships
  for each row execute function public._on_membership_insert();

-- ===== Session ending soon (10 min warning) ==================================
-- A lightweight function that callers (an edge function on a cron, or the
-- floor view tick) can invoke. Idempotent: refuses to insert a second
-- 'session_ending' notification for the same session in the same window.
create or replace function public.notify_session_ending(_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_cafe uuid;
  v_ends timestamptz;
  v_cafe_name text;
begin
  select s.customer_id, s.cafe_id, s.ends_at
    into v_customer, v_cafe, v_ends
  from public.sessions s
  where s.id = _session_id and s.status = 'active';
  if v_customer is null or v_ends is null then return; end if;

  -- Only fire once per session
  if exists (
    select 1 from public.notifications
    where user_id = v_customer
      and kind = 'session_ending'
      and body like '%' || _session_id::text || '%'
  ) then return; end if;

  select name into v_cafe_name from public.cafes where id = v_cafe;

  insert into public.notifications (user_id, cafe_id, kind, title, body, link)
  values (
    v_customer, v_cafe, 'session_ending',
    '10 minutes left on your session',
    'Your session at ' || coalesce(v_cafe_name, 'the café') ||
      ' ends at ' || to_char(v_ends at time zone 'Asia/Kolkata', 'HH24:MI') ||
      '. (session: ' || _session_id::text || ')',
    '/portal'
  );
end;
$$;

grant execute on function public.notify_session_ending(uuid) to authenticated, service_role;
