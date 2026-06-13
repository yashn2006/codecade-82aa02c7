-- ============================================================
-- v16 — Support tickets (Help Center) + welcome notification on new café
-- ============================================================

-- ---------- Support tickets ----------
do $$ begin
  create type public.ticket_status as enum ('open','waiting','in_progress','resolved','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','customer','admin')),
  cafe_id uuid references public.cafes(id) on delete set null,
  subject text not null check (length(subject) between 2 and 200),
  description text not null check (length(description) between 2 and 4000),
  category text not null default 'general'
    check (category in ('general','billing','bookings','hardware','account','bug','feature')),
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx on public.support_tickets(user_id);
create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_created_at_idx on public.support_tickets(created_at desc);

grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

alter table public.support_tickets enable row level security;

drop policy if exists "tickets_select_own" on public.support_tickets;
create policy "tickets_select_own" on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "tickets_insert_own" on public.support_tickets;
create policy "tickets_insert_own" on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "tickets_update_admin" on public.support_tickets;
create policy "tickets_update_admin" on public.support_tickets
  for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Auto-bump updated_at
create or replace function public._tickets_touch() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_tickets_touch on public.support_tickets;
create trigger trg_tickets_touch before update on public.support_tickets
  for each row execute function public._tickets_touch();

-- Notify the user when an admin replies to their ticket
create or replace function public._on_ticket_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.admin_reply is distinct from old.admin_reply) and new.admin_reply is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      new.user_id, 'ticket_reply',
      'Support replied to your ticket',
      'Subject: ' || new.subject,
      case when new.role = 'owner' then '/owner/help' else '/portal' end
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_reply on public.support_tickets;
create trigger trg_ticket_reply after update on public.support_tickets
  for each row execute function public._on_ticket_reply();

-- ---------- Welcome notification on new café ----------
-- Extends v15 _on_cafe_insert to also welcome the new owner.
create or replace function public._on_cafe_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Welcome the new café owner
  if new.owner_id is not null then
    insert into public.notifications (user_id, cafe_id, kind, title, body, link)
    values (
      new.owner_id, new.id, 'welcome_cafe',
      '🎉 Welcome to CoreCade, ' || coalesce(new.name, 'partner') || '!',
      'Your café is live on the platform. Add devices, set rates, and take your first booking. Need help? Visit the Help Center anytime.',
      '/owner/help'
    );
  end if;

  -- Notify super admins (unchanged)
  perform public._notify_super_admins(
    'new_cafe',
    'New café onboarded: ' || new.name,
    'A new café "' || new.name || '" was created on the platform.',
    '/admin/cafes'
  );
  return new;
end $$;
