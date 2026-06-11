-- ============================================================================
-- GIGANEXA — Phase 1 Foundation Schema
-- Run this ONCE in Supabase SQL Editor: https://supabase.com/dashboard/project/nggaiqniweggifcjtoio/sql
-- ============================================================================

-- 1. ROLES ENUM ---------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'cafe_owner', 'cafe_staff', 'customer');

-- 2. CORE TABLES --------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  cafe_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role, cafe_id)
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_monthly integer not null default 0,
  max_devices integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text unique not null,
  name text not null,
  description text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  logo_url text,
  cover_url text,
  plan_id uuid references public.subscription_plans(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  type text not null default 'pc',
  specs jsonb default '{}'::jsonb,
  hourly_rate integer not null default 0,
  status text not null default 'available',
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  wallet_balance integer not null default 0,
  created_at timestamptz not null default now(),
  unique (cafe_id, phone)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  amount integer,
  status text not null default 'active'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  hours_included integer not null default 0,
  price integer not null default 0,
  validity_days integer not null default 30,
  is_active boolean not null default true
);

create table public.customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  hours_remaining integer not null default 0
);

create table public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (cafe_id, staff_user_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- 3. HELPER FUNCTIONS ---------------------------------------------------------

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.get_user_cafe_id(_user_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.cafes where owner_id = _user_id limit 1
$$;

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger cafes_updated before update on public.cafes
  for each row execute function public.handle_updated_at();

-- 4. AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP -----------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. GRANTS -------------------------------------------------------------------

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.cafes to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.customer_memberships to authenticated;
grant select, insert, update, delete on public.staff_permissions to authenticated;
grant select on public.subscription_plans to anon, authenticated;
grant insert on public.contacts to anon, authenticated;

grant all on public.profiles, public.user_roles, public.cafes, public.devices,
  public.customers, public.sessions, public.bookings, public.memberships,
  public.customer_memberships, public.staff_permissions, public.subscription_plans,
  public.contacts to service_role;

-- 6. RLS ----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.cafes enable row level security;
alter table public.devices enable row level security;
alter table public.customers enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.memberships enable row level security;
alter table public.customer_memberships enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.contacts enable row level security;

-- profiles
create policy "own profile read" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'super_admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id);

-- user_roles (read only; writes go through admin paths)
create policy "own roles read" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'super_admin'));

-- cafes
create policy "owner manages cafe" on public.cafes for all to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
create policy "active cafes public read" on public.cafes for select to anon, authenticated
  using (is_active = true);

-- devices (owner + staff scoped to cafe)
create policy "cafe staff manage devices" on public.devices for all to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = devices.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = devices.cafe_id and sp.staff_user_id = auth.uid())
  );

-- customers
create policy "cafe staff manage customers" on public.customers for all to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = customers.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = customers.cafe_id and sp.staff_user_id = auth.uid())
    or customers.user_id = auth.uid()
  );

-- sessions
create policy "cafe staff manage sessions" on public.sessions for all to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = sessions.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = sessions.cafe_id and sp.staff_user_id = auth.uid())
  );

-- bookings (customers can book at any active cafe)
create policy "bookings visible to owner/staff/customer" on public.bookings for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = bookings.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = bookings.cafe_id and sp.staff_user_id = auth.uid())
    or exists (select 1 from public.customers cu where cu.id = bookings.customer_id and cu.user_id = auth.uid())
  );
create policy "customer creates booking" on public.bookings for insert to authenticated
  with check (
    exists (select 1 from public.customers cu where cu.id = bookings.customer_id and cu.user_id = auth.uid())
  );
create policy "owner/staff updates booking" on public.bookings for update to authenticated
  using (
    exists (select 1 from public.cafes c where c.id = bookings.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = bookings.cafe_id and sp.staff_user_id = auth.uid())
  );

-- memberships
create policy "memberships public read" on public.memberships for select to anon, authenticated
  using (is_active = true);
create policy "memberships owner manage" on public.memberships for all to authenticated
  using (exists (select 1 from public.cafes c where c.id = memberships.cafe_id and c.owner_id = auth.uid()));

-- customer_memberships
create policy "customer membership read" on public.customer_memberships for select to authenticated
  using (
    exists (select 1 from public.customers cu where cu.id = customer_memberships.customer_id and cu.user_id = auth.uid())
    or exists (
      select 1 from public.memberships m
      join public.cafes c on c.id = m.cafe_id
      where m.id = customer_memberships.membership_id and c.owner_id = auth.uid()
    )
  );

-- staff_permissions (only cafe owner manages)
create policy "owner manages staff perms" on public.staff_permissions for all to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.cafes c where c.id = staff_permissions.cafe_id and c.owner_id = auth.uid())
    or staff_user_id = auth.uid()
  );

-- subscription_plans (public read; super_admin manages)
create policy "plans public read" on public.subscription_plans for select to anon, authenticated
  using (is_active = true);
create policy "super admin manages plans" on public.subscription_plans for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- contacts (anyone can submit; only super_admin reads)
create policy "anyone can submit contact" on public.contacts for insert to anon, authenticated
  with check (true);
create policy "super admin reads contacts" on public.contacts for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- 7. SEED PLANS ---------------------------------------------------------------

insert into public.subscription_plans (name, price_monthly, max_devices, features) values
  ('Starter',  99900,  10, '["Basic POS","Session tracking","Email support"]'::jsonb),
  ('Pro',      249900, 30, '["All Starter","Bookings","Memberships","Analytics","Priority support"]'::jsonb),
  ('Enterprise', 599900, 100, '["All Pro","Multi-branch","White-label","Dedicated manager","API access"]'::jsonb);
