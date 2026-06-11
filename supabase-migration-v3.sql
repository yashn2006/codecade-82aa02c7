-- ============================================================================
-- CoreCade — Phase 3 Patch (run AFTER supabase-migration.sql and v2.sql)
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE / DROP+CREATE.
-- Paste into Supabase SQL editor.
-- ============================================================================

-- ===== 1. MENU + POS =========================================================
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_menu_cat_cafe on public.menu_categories(cafe_id, sort_order);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price integer not null default 0,
  stock integer,                       -- null = unlimited
  is_veg boolean not null default true,
  is_active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_menu_item_cafe on public.menu_items(cafe_id, is_active);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  status text not null default 'open',  -- open | paid | void
  payment_method text,                  -- cash | wallet | tab
  subtotal integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_orders_cafe on public.orders(cafe_id, status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.menu_items(id),
  name text not null,
  unit_price integer not null,
  qty integer not null default 1
);
create index if not exists idx_order_items_order on public.order_items(order_id);

grant select, insert, update, delete on public.menu_categories to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select on public.menu_items to anon;     -- public café page
grant select on public.menu_categories to anon;
grant all on public.menu_categories, public.menu_items, public.orders, public.order_items to service_role;

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- helper predicate: caller works at this cafe
-- public read for active menu (for the public café page)
drop policy if exists "menu public read" on public.menu_items;
create policy "menu public read" on public.menu_items for select to anon, authenticated
  using (is_active);
drop policy if exists "menu cat public read" on public.menu_categories;
create policy "menu cat public read" on public.menu_categories for select to anon, authenticated using (true);

drop policy if exists "menu manage" on public.menu_items;
create policy "menu manage" on public.menu_items for all to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = menu_items.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = menu_items.cafe_id and sp.staff_user_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = menu_items.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = menu_items.cafe_id and sp.staff_user_id = auth.uid())
  );

drop policy if exists "menu cat manage" on public.menu_categories;
create policy "menu cat manage" on public.menu_categories for all to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = menu_categories.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = menu_categories.cafe_id and sp.staff_user_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = menu_categories.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = menu_categories.cafe_id and sp.staff_user_id = auth.uid())
  );

drop policy if exists "orders manage" on public.orders;
create policy "orders manage" on public.orders for all to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = orders.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = orders.cafe_id and sp.staff_user_id = auth.uid())
    or exists (select 1 from public.customers cu where cu.id = orders.customer_id and cu.user_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = orders.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = orders.cafe_id and sp.staff_user_id = auth.uid())
  );

drop policy if exists "order items manage" on public.order_items;
create policy "order items manage" on public.order_items for all to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          public.has_role(auth.uid(),'super_admin')
          or exists (select 1 from public.cafes c where c.id = o.cafe_id and c.owner_id = auth.uid())
          or exists (select 1 from public.staff_permissions sp where sp.cafe_id = o.cafe_id and sp.staff_user_id = auth.uid())
          or exists (select 1 from public.customers cu where cu.id = o.customer_id and cu.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          public.has_role(auth.uid(),'super_admin')
          or exists (select 1 from public.cafes c where c.id = o.cafe_id and c.owner_id = auth.uid())
          or exists (select 1 from public.staff_permissions sp where sp.cafe_id = o.cafe_id and sp.staff_user_id = auth.uid())
        )
    )
  );

-- atomic settle: marks paid, decrements stock, optionally debits wallet
create or replace function public.settle_order(_order_id uuid, _payment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cafe uuid;
  v_cust uuid;
  v_total int;
  v_allowed boolean;
begin
  select cafe_id, customer_id, subtotal into v_cafe, v_cust, v_total
    from public.orders where id = _order_id and status = 'open';
  if v_cafe is null then raise exception 'order not found or already settled'; end if;

  select public.has_role(v_user,'super_admin')
    or exists (select 1 from public.cafes c where c.id = v_cafe and c.owner_id = v_user)
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = v_cafe and sp.staff_user_id = v_user)
    into v_allowed;
  if not v_allowed then raise exception 'forbidden'; end if;

  -- decrement stock for tracked items
  update public.menu_items mi
     set stock = greatest(0, stock - oi.qty)
    from public.order_items oi
   where oi.order_id = _order_id and mi.id = oi.item_id and mi.stock is not null;

  -- wallet
  if _payment = 'wallet' then
    if v_cust is null then raise exception 'wallet requires customer'; end if;
    perform public.apply_wallet_tx(v_cust, v_cafe, -v_total, 'order', 'POS order');
  end if;

  update public.orders
     set status = 'paid', payment_method = _payment, paid_at = now()
   where id = _order_id;
end;
$$;
grant execute on function public.settle_order(uuid, text) to authenticated;

-- ===== 2. TOURNAMENTS ========================================================
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  title text not null,
  game text not null,
  format text not null default 'solo',  -- solo | duo | squad
  entry_fee integer not null default 0,
  prize_pool integer not null default 0,
  capacity integer not null default 16,
  starts_at timestamptz not null,
  status text not null default 'upcoming', -- upcoming | live | completed | cancelled
  banner_url text,
  rules text,
  created_at timestamptz not null default now()
);
create index if not exists idx_tourn_cafe on public.tournaments(cafe_id, starts_at desc);

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  team_name text not null,
  contact text,
  paid boolean not null default false,
  seat_no int,
  placement int,
  created_at timestamptz not null default now()
);
create index if not exists idx_treg_tourn on public.tournament_registrations(tournament_id);

grant select on public.tournaments to anon;
grant select, insert, update, delete on public.tournaments to authenticated;
grant select, insert, update, delete on public.tournament_registrations to authenticated;
grant all on public.tournaments, public.tournament_registrations to service_role;

alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;

drop policy if exists "tournaments public read" on public.tournaments;
create policy "tournaments public read" on public.tournaments for select to anon, authenticated using (true);

drop policy if exists "tournaments manage" on public.tournaments;
create policy "tournaments manage" on public.tournaments for all to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = tournaments.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = tournaments.cafe_id and sp.staff_user_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(),'super_admin')
    or exists (select 1 from public.cafes c where c.id = tournaments.cafe_id and c.owner_id = auth.uid())
    or exists (select 1 from public.staff_permissions sp where sp.cafe_id = tournaments.cafe_id and sp.staff_user_id = auth.uid())
  );

drop policy if exists "treg read" on public.tournament_registrations;
create policy "treg read" on public.tournament_registrations for select to authenticated using (
  public.has_role(auth.uid(),'super_admin')
  or exists (
    select 1 from public.tournaments t join public.cafes c on c.id = t.cafe_id
    where t.id = tournament_registrations.tournament_id
      and (c.owner_id = auth.uid()
        or exists (select 1 from public.staff_permissions sp where sp.cafe_id = c.id and sp.staff_user_id = auth.uid()))
  )
  or exists (select 1 from public.customers cu where cu.id = tournament_registrations.customer_id and cu.user_id = auth.uid())
);

drop policy if exists "treg insert" on public.tournament_registrations;
create policy "treg insert" on public.tournament_registrations for insert to authenticated with check (
  public.has_role(auth.uid(),'super_admin')
  or exists (
    select 1 from public.tournaments t join public.cafes c on c.id = t.cafe_id
    where t.id = tournament_registrations.tournament_id
      and (c.owner_id = auth.uid()
        or exists (select 1 from public.staff_permissions sp where sp.cafe_id = c.id and sp.staff_user_id = auth.uid()))
  )
  or exists (select 1 from public.customers cu where cu.id = tournament_registrations.customer_id and cu.user_id = auth.uid())
);

drop policy if exists "treg update" on public.tournament_registrations;
create policy "treg update" on public.tournament_registrations for update to authenticated using (
  public.has_role(auth.uid(),'super_admin')
  or exists (
    select 1 from public.tournaments t join public.cafes c on c.id = t.cafe_id
    where t.id = tournament_registrations.tournament_id
      and (c.owner_id = auth.uid()
        or exists (select 1 from public.staff_permissions sp where sp.cafe_id = c.id and sp.staff_user_id = auth.uid()))
  )
);

-- ===== 3. CAFE PUBLIC PAGE ===================================================
create table if not exists public.cafe_pages (
  cafe_id uuid primary key references public.cafes(id) on delete cascade,
  tagline text,
  hero_url text,
  about text,
  hours jsonb default '{}'::jsonb,         -- {mon:"10-23", ...}
  socials jsonb default '{}'::jsonb,       -- {instagram, youtube, discord}
  gallery jsonb default '[]'::jsonb,       -- [urls]
  updated_at timestamptz not null default now()
);
grant select on public.cafe_pages to anon, authenticated;
grant insert, update, delete on public.cafe_pages to authenticated;
grant all on public.cafe_pages to service_role;

alter table public.cafe_pages enable row level security;
drop policy if exists "cafe page public read" on public.cafe_pages;
create policy "cafe page public read" on public.cafe_pages for select to anon, authenticated using (true);
drop policy if exists "cafe page manage" on public.cafe_pages;
create policy "cafe page manage" on public.cafe_pages for all to authenticated using (
  public.has_role(auth.uid(),'super_admin')
  or exists (select 1 from public.cafes c where c.id = cafe_pages.cafe_id and c.owner_id = auth.uid())
) with check (
  public.has_role(auth.uid(),'super_admin')
  or exists (select 1 from public.cafes c where c.id = cafe_pages.cafe_id and c.owner_id = auth.uid())
);

-- ===== 4. NOTIFICATIONS ======================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cafe_id uuid references public.cafes(id) on delete cascade,
  kind text not null,                  -- session_ending | booking_reminder | tournament | wallet_low
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(user_id, created_at desc);

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;
drop policy if exists "notif own read" on public.notifications;
create policy "notif own read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notif own update" on public.notifications;
create policy "notif own update" on public.notifications for update to authenticated using (user_id = auth.uid());

-- ===== 5. PUBLIC READ FOR DISCOVERY ==========================================
-- The public café landing pages also need cafe + devices reads from anon.
drop policy if exists "cafes public read" on public.cafes;
create policy "cafes public read" on public.cafes for select to anon, authenticated using (is_active);
grant select on public.cafes to anon;

drop policy if exists "devices public read" on public.devices;
create policy "devices public read" on public.devices for select to anon, authenticated using (true);
grant select on public.devices to anon;
