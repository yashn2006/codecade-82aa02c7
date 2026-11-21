-- ============================================================================
-- Supabase Migration v35 — Staff PIN Login & Database Permission Enforcement
-- Safe to re-run multiple times (fully idempotent).
-- Run this in Supabase SQL Editor -> New Query -> Run.
-- ============================================================================

-- 1. public.cafes: add unique 6-character uppercase staff_code ---------------
ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS staff_code text;

CREATE OR REPLACE FUNCTION public.generate_cafe_staff_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.cafes c WHERE upper(c.staff_code) = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

-- Normalize existing codes and backfill missing ones
UPDATE public.cafes
   SET staff_code = upper(btrim(staff_code))
 WHERE staff_code IS NOT NULL AND staff_code <> upper(btrim(staff_code));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.cafes WHERE staff_code IS NULL OR btrim(staff_code) = '' LOOP
    UPDATE public.cafes
       SET staff_code = public.generate_cafe_staff_code()
     WHERE id = r.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cafes'::regclass
      AND conname = 'cafes_staff_code_key'
  ) THEN
    ALTER TABLE public.cafes
      ADD CONSTRAINT cafes_staff_code_key UNIQUE (staff_code);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._cafes_ensure_staff_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.staff_code IS NULL OR btrim(NEW.staff_code) = '' THEN
    NEW.staff_code := public.generate_cafe_staff_code();
  ELSE
    NEW.staff_code := upper(btrim(NEW.staff_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cafes_ensure_staff_code ON public.cafes;
CREATE TRIGGER trg_cafes_ensure_staff_code
  BEFORE INSERT ON public.cafes
  FOR EACH ROW
  EXECUTE FUNCTION public._cafes_ensure_staff_code();

-- 2. public.staff_permissions: PIN login & lockout columns -------------------
ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS login_email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

UPDATE public.staff_permissions
   SET username = lower(btrim(username))
 WHERE username IS NOT NULL AND username <> lower(btrim(username));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.staff_permissions'::regclass
      AND conname = 'staff_permissions_cafe_id_username_key'
  ) THEN
    ALTER TABLE public.staff_permissions
      ADD CONSTRAINT staff_permissions_cafe_id_username_key UNIQUE (cafe_id, username);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_permissions_cafe_username_ci
  ON public.staff_permissions (cafe_id, lower(username))
  WHERE username IS NOT NULL;

-- Helpers to avoid RLS recursion between public.cafes and public.staff_permissions
CREATE OR REPLACE FUNCTION public._is_cafe_owner(_cafe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cafes c
    WHERE c.id = _cafe_id AND c.owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_cafe_owner(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._is_active_staff_user(_cafe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_permissions sp
    WHERE sp.cafe_id = _cafe_id
      AND sp.staff_user_id = auth.uid()
      AND sp.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_active_staff_user(uuid) TO authenticated, service_role;

-- Harden staff_permissions RLS: staff can read own row; only owner/super_admin can write
DROP POLICY IF EXISTS "owner manages staff perms" ON public.staff_permissions;
DROP POLICY IF EXISTS "staff reads own perm" ON public.staff_permissions;
DROP POLICY IF EXISTS "owner writes staff perms" ON public.staff_permissions;

CREATE POLICY "staff reads own perm"
  ON public.staff_permissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public._is_cafe_owner(staff_permissions.cafe_id)
    OR staff_user_id = auth.uid()
  );

CREATE POLICY "owner writes staff perms"
  ON public.staff_permissions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public._is_cafe_owner(staff_permissions.cafe_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public._is_cafe_owner(staff_permissions.cafe_id)
  );

-- Allow active staff to read their assigned cafe even if inactive/trial-locked
DROP POLICY IF EXISTS "staff reads assigned cafe" ON public.cafes;
CREATE POLICY "staff reads assigned cafe"
  ON public.cafes FOR SELECT TO authenticated
  USING (public._is_active_staff_user(cafes.id));

-- 3. Permission helper function ----------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_has_perm(_cafe_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.cafes c
      WHERE c.id = _cafe_id AND c.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.cafe_id = _cafe_id
        AND sp.staff_user_id = auth.uid()
        AND sp.is_active = true
        AND (sp.permissions ? _perm)
    );
$$;

GRANT EXECUTE ON FUNCTION public.staff_has_perm(uuid, text) TO authenticated, service_role;

-- Helper for read-only membership in active staff (respects is_active)
CREATE OR REPLACE FUNCTION public._is_active_cafe_member(_cafe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.cafes c
      WHERE c.id = _cafe_id AND c.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.cafe_id = _cafe_id
        AND sp.staff_user_id = auth.uid()
        AND sp.is_active = true
    );
$$;

GRANT EXECUTE ON FUNCTION public._is_active_cafe_member(uuid) TO authenticated, service_role;

-- 4. Wallet RPC & policies (require manage_wallet for staff) -----------------
-- Ensure wallet tables & required columns exist even on pre-v2/partial DBs
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wallet_balance integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'topup',
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'topup',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wallet_transactions'
      AND column_name = 'user_id'
  ) THEN
    UPDATE public.wallet_transactions wt
       SET customer_id = cu.id
      FROM public.customers cu
     WHERE wt.customer_id IS NULL
       AND wt.user_id IS NOT NULL
       AND cu.user_id = wt.user_id
       AND (wt.cafe_id IS NULL OR cu.cafe_id = wt.cafe_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_customer ON public.wallet_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_cafe_created ON public.wallet_transactions(cafe_id, created_at DESC);

GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','refunded')),
  notes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.wallet_topups
  ADD COLUMN IF NOT EXISTS cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS notes jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

GRANT SELECT, INSERT, UPDATE ON public.wallet_topups TO authenticated;
GRANT ALL ON public.wallet_topups TO service_role;
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_wallet_tx(
  _customer_id uuid,
  _cafe_id uuid,
  _amount integer,
  _kind text,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    v_allowed := true;
  ELSE
    SELECT public.staff_has_perm(_cafe_id, 'manage_wallet') INTO v_allowed;
  END IF;

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.customers
     SET wallet_balance = greatest(0, wallet_balance + _amount)
   WHERE id = _customer_id AND cafe_id = _cafe_id;

  INSERT INTO public.wallet_transactions (customer_id, cafe_id, amount, kind, note, created_by)
  VALUES (_customer_id, _cafe_id, _amount, _kind, _note, v_user);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_wallet_tx(uuid, uuid, integer, text, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "wallet tx read" ON public.wallet_transactions;
CREATE POLICY "wallet tx read"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (
    public._is_active_cafe_member(wallet_transactions.cafe_id)
    OR EXISTS (
      SELECT 1 FROM public.customers cu
      WHERE cu.id = wallet_transactions.customer_id AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "wallet tx insert by staff" ON public.wallet_transactions;
CREATE POLICY "wallet tx insert by staff"
  ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (public.staff_has_perm(wallet_transactions.cafe_id, 'manage_wallet'));

DROP POLICY IF EXISTS "topups_select_owner_staff" ON public.wallet_topups;
CREATE POLICY "topups_select_owner_staff"
  ON public.wallet_topups FOR SELECT TO authenticated
  USING (public._is_active_cafe_member(wallet_topups.cafe_id));

DROP POLICY IF EXISTS "topups_insert_owner_staff" ON public.wallet_topups;
CREATE POLICY "topups_insert_owner_staff"
  ON public.wallet_topups FOR INSERT TO authenticated
  WITH CHECK (public.staff_has_perm(wallet_topups.cafe_id, 'manage_wallet'));

-- 5. Bookings RLS (require create_bookings for staff writes) -----------------
DROP POLICY IF EXISTS "bookings visible to owner/staff/customer" ON public.bookings;
DROP POLICY IF EXISTS "bookings owner read" ON public.bookings;
CREATE POLICY "bookings owner read"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    public._is_active_cafe_member(bookings.cafe_id)
    OR EXISTS (
      SELECT 1 FROM public.customers cu
      WHERE cu.id = bookings.customer_id AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customer creates booking" ON public.bookings;
DROP POLICY IF EXISTS "bookings customer insert" ON public.bookings;
CREATE POLICY "bookings customer insert"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers cu
      WHERE cu.id = bookings.customer_id AND cu.user_id = auth.uid()
    )
    OR public.staff_has_perm(bookings.cafe_id, 'create_bookings')
  );

DROP POLICY IF EXISTS "owner/staff updates booking" ON public.bookings;
DROP POLICY IF EXISTS "bookings owner update" ON public.bookings;
CREATE POLICY "bookings owner update"
  ON public.bookings FOR UPDATE TO authenticated
  USING (public.staff_has_perm(bookings.cafe_id, 'create_bookings'))
  WITH CHECK (public.staff_has_perm(bookings.cafe_id, 'create_bookings'));

DROP POLICY IF EXISTS "bookings customer cancel" ON public.bookings;
CREATE POLICY "bookings customer cancel"
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers cu
      WHERE cu.id = bookings.customer_id AND cu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.customers cu
      WHERE cu.id = bookings.customer_id AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bookings owner delete" ON public.bookings;
CREATE POLICY "bookings owner delete"
  ON public.bookings FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = bookings.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 6. Sessions & Devices RLS --------------------------------------------------
DROP POLICY IF EXISTS "cafe staff manage sessions" ON public.sessions;
DROP POLICY IF EXISTS "sessions cafe select" ON public.sessions;
DROP POLICY IF EXISTS "sessions cafe insert" ON public.sessions;
DROP POLICY IF EXISTS "sessions cafe update" ON public.sessions;
DROP POLICY IF EXISTS "sessions owner delete" ON public.sessions;

CREATE POLICY "sessions cafe select"
  ON public.sessions FOR SELECT TO authenticated
  USING (public._is_active_cafe_member(sessions.cafe_id));

CREATE POLICY "sessions cafe insert"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (public.staff_has_perm(sessions.cafe_id, 'start_sessions'));

CREATE POLICY "sessions cafe update"
  ON public.sessions FOR UPDATE TO authenticated
  USING (
    public.staff_has_perm(sessions.cafe_id, 'start_sessions')
    OR public.staff_has_perm(sessions.cafe_id, 'end_sessions')
  )
  WITH CHECK (
    public.staff_has_perm(sessions.cafe_id, 'start_sessions')
    OR public.staff_has_perm(sessions.cafe_id, 'end_sessions')
  );

CREATE POLICY "sessions owner delete"
  ON public.sessions FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = sessions.cafe_id AND c.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "cafe staff manage devices" ON public.devices;
DROP POLICY IF EXISTS "devices cafe insert" ON public.devices;
DROP POLICY IF EXISTS "devices cafe update" ON public.devices;
DROP POLICY IF EXISTS "devices cafe delete" ON public.devices;

CREATE POLICY "devices cafe insert"
  ON public.devices FOR INSERT TO authenticated
  WITH CHECK (public.staff_has_perm(devices.cafe_id, 'manage_devices'));

CREATE POLICY "devices cafe update"
  ON public.devices FOR UPDATE TO authenticated
  USING (
    public.staff_has_perm(devices.cafe_id, 'manage_devices')
    OR public.staff_has_perm(devices.cafe_id, 'start_sessions')
    OR public.staff_has_perm(devices.cafe_id, 'end_sessions')
  )
  WITH CHECK (
    public.staff_has_perm(devices.cafe_id, 'manage_devices')
    OR public.staff_has_perm(devices.cafe_id, 'start_sessions')
    OR public.staff_has_perm(devices.cafe_id, 'end_sessions')
  );

CREATE POLICY "devices cafe delete"
  ON public.devices FOR DELETE TO authenticated
  USING (public.staff_has_perm(devices.cafe_id, 'manage_devices'));

-- 7. Customers RLS (require register_customers for staff writes) -------------
DROP POLICY IF EXISTS "cafe staff manage customers" ON public.customers;
DROP POLICY IF EXISTS "customers cafe select" ON public.customers;
DROP POLICY IF EXISTS "customers cafe insert" ON public.customers;
DROP POLICY IF EXISTS "customers cafe update" ON public.customers;
DROP POLICY IF EXISTS "customers owner delete" ON public.customers;

CREATE POLICY "customers cafe select"
  ON public.customers FOR SELECT TO authenticated
  USING (
    public._is_active_cafe_member(customers.cafe_id)
    OR customers.user_id = auth.uid()
  );

CREATE POLICY "customers cafe insert"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.staff_has_perm(customers.cafe_id, 'register_customers')
    OR customers.user_id = auth.uid()
  );

CREATE POLICY "customers cafe update"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    public.staff_has_perm(customers.cafe_id, 'register_customers')
    OR customers.user_id = auth.uid()
  )
  WITH CHECK (
    public.staff_has_perm(customers.cafe_id, 'register_customers')
    OR customers.user_id = auth.uid()
  );

CREATE POLICY "customers owner delete"
  ON public.customers FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = customers.cafe_id AND c.owner_id = auth.uid())
  );

-- 8. POS & Menu RLS + RPCs (generate_bills / manage_menu) --------------------
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  stock integer,
  is_veg boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stock integer;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  payment_method text,
  subtotal integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS subtotal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_no text;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.menu_items(id),
  name text NOT NULL,
  unit_price integer NOT NULL,
  qty integer NOT NULL DEFAULT 1
);
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.menu_items(id),
  ADD COLUMN IF NOT EXISTS qty integer NOT NULL DEFAULT 1;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories, public.menu_items, public.orders, public.order_items TO authenticated;
GRANT SELECT ON public.menu_categories, public.menu_items TO anon;
GRANT ALL ON public.menu_categories, public.menu_items, public.orders, public.order_items TO service_role;

DROP POLICY IF EXISTS "menu manage" ON public.menu_items;
DROP POLICY IF EXISTS "menu owner/staff select" ON public.menu_items;
DROP POLICY IF EXISTS "menu staff insert" ON public.menu_items;
DROP POLICY IF EXISTS "menu staff update" ON public.menu_items;
DROP POLICY IF EXISTS "menu staff delete" ON public.menu_items;

CREATE POLICY "menu owner/staff select"
  ON public.menu_items FOR SELECT TO authenticated
  USING (public._is_active_cafe_member(menu_items.cafe_id));

CREATE POLICY "menu staff insert"
  ON public.menu_items FOR INSERT TO authenticated
  WITH CHECK (public.staff_has_perm(menu_items.cafe_id, 'manage_menu'));

CREATE POLICY "menu staff update"
  ON public.menu_items FOR UPDATE TO authenticated
  USING (public.staff_has_perm(menu_items.cafe_id, 'manage_menu'))
  WITH CHECK (public.staff_has_perm(menu_items.cafe_id, 'manage_menu'));

CREATE POLICY "menu staff delete"
  ON public.menu_items FOR DELETE TO authenticated
  USING (public.staff_has_perm(menu_items.cafe_id, 'manage_menu'));

DROP POLICY IF EXISTS "menu cat manage" ON public.menu_categories;
DROP POLICY IF EXISTS "menu cat write" ON public.menu_categories;
CREATE POLICY "menu cat write"
  ON public.menu_categories FOR ALL TO authenticated
  USING (public.staff_has_perm(menu_categories.cafe_id, 'manage_menu'))
  WITH CHECK (public.staff_has_perm(menu_categories.cafe_id, 'manage_menu'));

DROP POLICY IF EXISTS "orders manage" ON public.orders;
DROP POLICY IF EXISTS "orders cafe select" ON public.orders;
DROP POLICY IF EXISTS "orders cafe insert" ON public.orders;
DROP POLICY IF EXISTS "orders cafe update" ON public.orders;
DROP POLICY IF EXISTS "orders owner delete" ON public.orders;

CREATE POLICY "orders cafe select"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public._is_active_cafe_member(orders.cafe_id)
    OR EXISTS (
      SELECT 1 FROM public.customers cu
      WHERE cu.id = orders.customer_id AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "orders cafe insert"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.staff_has_perm(orders.cafe_id, 'generate_bills'));

CREATE POLICY "orders cafe update"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.staff_has_perm(orders.cafe_id, 'generate_bills'))
  WITH CHECK (public.staff_has_perm(orders.cafe_id, 'generate_bills'));

CREATE POLICY "orders owner delete"
  ON public.orders FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = orders.cafe_id AND c.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "order items manage" ON public.order_items;
DROP POLICY IF EXISTS "order items select" ON public.order_items;
DROP POLICY IF EXISTS "order items insert" ON public.order_items;
DROP POLICY IF EXISTS "order items update" ON public.order_items;
DROP POLICY IF EXISTS "order items delete" ON public.order_items;

CREATE POLICY "order items select"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public._is_active_cafe_member(o.cafe_id)
          OR EXISTS (
            SELECT 1 FROM public.customers cu
            WHERE cu.id = o.customer_id AND cu.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "order items insert"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.staff_has_perm(o.cafe_id, 'generate_bills')
    )
  );

CREATE POLICY "order items update"
  ON public.order_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.staff_has_perm(o.cafe_id, 'generate_bills')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.staff_has_perm(o.cafe_id, 'generate_bills')
    )
  );

CREATE POLICY "order items delete"
  ON public.order_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.staff_has_perm(o.cafe_id, 'generate_bills')
    )
  );

CREATE OR REPLACE FUNCTION public.settle_order(_order_id uuid, _payment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cafe uuid;
  v_cust uuid;
  v_total int;
  v_allowed boolean;
BEGIN
  SELECT cafe_id, customer_id, coalesce(nullif(total_amount, 0), subtotal)
    INTO v_cafe, v_cust, v_total
    FROM public.orders
   WHERE id = _order_id AND status = 'open';
  IF v_cafe IS NULL THEN
    RAISE EXCEPTION 'order not found or already settled';
  END IF;

  IF coalesce(auth.role(), '') = 'service_role'
     OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    v_allowed := true;
  ELSE
    SELECT public.staff_has_perm(v_cafe, 'generate_bills') INTO v_allowed;
  END IF;
  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- decrement stock for tracked items
  UPDATE public.menu_items mi
     SET stock = greatest(0, stock - oi.qty)
    FROM public.order_items oi
   WHERE oi.order_id = _order_id AND mi.id = oi.item_id AND mi.stock IS NOT NULL;

  -- wallet debit (enforces manage_wallet inside apply_wallet_tx for staff)
  IF _payment = 'wallet' THEN
    IF v_cust IS NULL THEN RAISE EXCEPTION 'wallet requires customer'; END IF;
    PERFORM public.apply_wallet_tx(v_cust, v_cafe, -v_total, 'order', 'POS order');
  END IF;

  UPDATE public.orders
     SET status = 'paid', payment_method = _payment, paid_at = now()
   WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_order(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refund_order(
  _order_id uuid,
  _amount integer,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
  v_allowed boolean;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF coalesce(auth.role(), '') = 'service_role'
     OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    v_allowed := true;
  ELSE
    SELECT public.staff_has_perm(o.cafe_id, 'generate_bills') INTO v_allowed;
  END IF;
  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF o.status <> 'paid' AND o.status <> 'refunded' THEN
    RAISE EXCEPTION 'Only paid orders can be refunded';
  END IF;
  IF _amount <= 0 OR _amount > coalesce(nullif(o.total_amount, 0), o.subtotal) - coalesce(o.refund_amount, 0) THEN
    RAISE EXCEPTION 'Invalid refund amount';
  END IF;

  UPDATE public.orders
     SET refund_amount = coalesce(refund_amount, 0) + _amount,
         refund_reason = _reason,
         refunded_at = now(),
         status = CASE
           WHEN coalesce(refund_amount, 0) + _amount >= coalesce(nullif(total_amount, 0), subtotal)
             THEN 'refunded'
           ELSE status
         END
   WHERE id = _order_id;

  IF o.payment_method = 'wallet' AND o.customer_id IS NOT NULL THEN
    PERFORM public.apply_wallet_tx(
      o.customer_id, o.cafe_id, _amount, 'refund'::text, coalesce(_reason, 'Order refund')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_order(uuid, integer, text) TO authenticated, service_role;

-- 9. Revenue entries & RPC (require view_revenue / owner) -------------------
CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  kind text NOT NULL DEFAULT 'cash',
  source text NOT NULL DEFAULT 'session',
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue_entries
  ADD COLUMN IF NOT EXISTS cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_entries TO authenticated;
GRANT ALL ON public.revenue_entries TO service_role;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenue owner manage" ON public.revenue_entries;
DROP POLICY IF EXISTS "revenue view" ON public.revenue_entries;
DROP POLICY IF EXISTS "revenue write" ON public.revenue_entries;

CREATE POLICY "revenue view"
  ON public.revenue_entries FOR SELECT TO authenticated
  USING (public.staff_has_perm(revenue_entries.cafe_id, 'view_revenue'));

CREATE POLICY "revenue write"
  ON public.revenue_entries FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = revenue_entries.cafe_id AND c.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = revenue_entries.cafe_id AND c.owner_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.record_revenue(
  _cafe_id uuid,
  _amount integer,
  _kind text,
  _source text,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed boolean;
  v_id uuid;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    v_allowed := true;
  ELSE
    SELECT
      public.has_role(v_user, 'super_admin')
      OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = _cafe_id AND c.owner_id = v_user)
      OR public.staff_has_perm(_cafe_id, 'view_revenue')
    INTO v_allowed;
  END IF;
  IF NOT coalesce(v_allowed, false) THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.revenue_entries (cafe_id, amount, kind, source, note, recorded_by)
  VALUES (_cafe_id, _amount, _kind, _source, _note, v_user)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_revenue(uuid, integer, text, text, text) TO authenticated, service_role;
