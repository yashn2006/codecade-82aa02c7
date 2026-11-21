-- ============================================================================
-- Supabase Migration v36 — Fix Café RLS Infinite Recursion & Delete FK Blockers
-- Safe to re-run multiple times (fully idempotent).
-- Run this in Supabase SQL Editor -> New Query -> Run.
-- ============================================================================

-- 1. Fix RLS infinite recursion (ERROR 42P17) between cafes <-> staff_permissions
-- Previously:
--   - public.cafes policy "staff reads assigned cafe" queried public.staff_permissions
--   - public.staff_permissions policies queried public.cafes
-- Calling both inside RLS caused Postgres error 42P17 ("infinite recursion detected
-- in policy for relation cafes"), breaking café workspace loading.
-- Solution: route cross-table membership checks through SECURITY DEFINER helpers.

ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

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

DROP POLICY IF EXISTS "staff reads assigned cafe" ON public.cafes;
CREATE POLICY "staff reads assigned cafe"
  ON public.cafes FOR SELECT TO authenticated
  USING (public._is_active_staff_user(cafes.id));

-- 2. Fix order_items.item_id foreign key blocking menu item & café deletion
-- Previously:
--   order_items.item_id referenced menu_items(id) with NO ACTION, so deleting
--   a menu item or deleting a café (which cascades to menu_items) threw:
--   "update or delete on table menu_items violates foreign key constraint order_items_item_id_fkey"
-- Using ON DELETE SET NULL unblocks deletes while preserving historical order line
-- snapshots (name, unit_price, qty) on existing receipts.

DO $$
DECLARE
  v_con record;
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL
     AND to_regclass('public.menu_items') IS NOT NULL THEN
    ALTER TABLE public.order_items
      ALTER COLUMN item_id DROP NOT NULL;

    -- Drop any existing FK constraint(s) on order_items(item_id) -> menu_items(id)
    FOR v_con IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = 'public.order_items'::regclass
        AND con.contype = 'f'
        AND att.attname = 'item_id'
    LOOP
      EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;
  END IF;
END $$;
