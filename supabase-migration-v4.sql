-- ============================================================================
-- CoreCade — Phase 3+ patch v4
-- Adds suspend timer + notes to devices, supports reserved/suspended status.
-- Safe to re-run (idempotent).
-- Run in Supabase SQL Editor.
-- ============================================================================

alter table public.devices add column if not exists suspend_until timestamptz;
alter table public.devices add column if not exists notes text;

-- Optional helper: when suspend_until passes, status auto-resets via this RPC
create or replace function public.expire_device_suspensions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.devices
     set status = 'available', suspend_until = null
   where status = 'suspended' and suspend_until is not null and suspend_until <= now();
$$;

grant execute on function public.expire_device_suspensions() to authenticated, service_role;
