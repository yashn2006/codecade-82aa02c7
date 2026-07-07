-- ============================================================
-- CoreCade v25 — Fixes for launch:
--  1) Booking → notification FK error (customer_id vs auth user id)
--  2) Storage RLS for cafe images (logo / hero / gallery uploads)
--  3) Ensures notifications insert is safe for anonymous/guest bookings
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1) Fix booking notification trigger.
-- Bug: notifications.user_id references auth.users(id), but the trigger was
-- inserting bookings.customer_id (which is customers.id, NOT an auth user id).
create or replace function public._on_booking_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_cafe_name text;
  v_customer_user uuid;
begin
  select owner_id, name into v_owner, v_cafe_name
  from public.cafes where id = new.cafe_id;

  -- Resolve the auth user behind the customer row (may be null for walk-ins).
  if new.customer_id is not null then
    select user_id into v_customer_user
    from public.customers where id = new.customer_id;
  end if;

  -- Notify the customer only if they are a signed-in user.
  if v_customer_user is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      v_customer_user, new.cafe_id, 'booking_confirmed',
      'Booking confirmed at ' || coalesce(v_cafe_name, 'café'),
      'Your slot is locked in. See you soon!',
      '/portal'
    );
  end if;

  -- Notify the café owner (only if a valid auth user).
  if v_owner is not null
     and exists (select 1 from auth.users u where u.id = v_owner) then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      v_owner, new.cafe_id, 'new_booking',
      'New booking received',
      'A customer just booked a slot at ' || coalesce(v_cafe_name, 'your café') || '.',
      null
    );
  end if;

  return new;
exception when foreign_key_violation then
  -- Never block a booking if the notification insert fails.
  return new;
end;
$$;

-- 2) Storage bucket + RLS for cafe images
-- Creates a public bucket "cafe-gallery" (idempotent) and policies so any
-- authenticated user can upload, and owners/admins can update/delete.

insert into storage.buckets (id, name, public)
values ('cafe-gallery', 'cafe-gallery', true)
on conflict (id) do update set public = true;

-- Public read
drop policy if exists "cafe-gallery public read" on storage.objects;
create policy "cafe-gallery public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'cafe-gallery');

-- Authenticated upload (any signed-in user can upload; path convention <cafeId>/...)
drop policy if exists "cafe-gallery auth insert" on storage.objects;
create policy "cafe-gallery auth insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cafe-gallery');

-- Update / delete: uploader OR super_admin
drop policy if exists "cafe-gallery owner update" on storage.objects;
create policy "cafe-gallery owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cafe-gallery'
    and (owner = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
  );

drop policy if exists "cafe-gallery owner delete" on storage.objects;
create policy "cafe-gallery owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cafe-gallery'
    and (owner = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
  );
