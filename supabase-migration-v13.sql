-- ============================================================
-- CoreCade Migration v13 — Café-owner RLS hardening
-- Restricts cafés so only the owner (or super_admin) can
-- read/update/delete; INSERT forced to self and requires the
-- cafe_owner role. Run AFTER v12.
-- ============================================================

-- Replace the broad "owner manages cafe" policy with split, tighter ones.
DROP POLICY IF EXISTS "owner manages cafe" ON public.cafes;

-- SELECT: owner, super_admin, or assigned staff
DROP POLICY IF EXISTS "cafe owner select" ON public.cafes;
CREATE POLICY "cafe owner select"
  ON public.cafes FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.cafe_id = cafes.id
        AND ur.role IN ('cafe_staff', 'cafe_owner')
    )
  );

-- INSERT: must be a cafe_owner (or super_admin) AND owner_id must equal auth.uid()
-- (super_admin bypass lets the admin console assign owner_id to anyone)
DROP POLICY IF EXISTS "cafe owner insert" ON public.cafes;
CREATE POLICY "cafe owner insert"
  ON public.cafes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'cafe_owner')
      AND owner_id = auth.uid()
    )
  );

-- UPDATE: only owner or super_admin; can never reassign owner_id away from self
DROP POLICY IF EXISTS "cafe owner update" ON public.cafes;
CREATE POLICY "cafe owner update"
  ON public.cafes FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR owner_id = auth.uid()
  );

-- DELETE: only owner or super_admin
DROP POLICY IF EXISTS "cafe owner delete" ON public.cafes;
CREATE POLICY "cafe owner delete"
  ON public.cafes FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Public read of active cafés stays as-is ("active cafes public read"); no change.

-- Belt-and-suspenders trigger: prevent ownership transfer by non-admins
CREATE OR REPLACE FUNCTION public.cafes_guard_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only super_admin can reassign café ownership';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cafes_guard_owner_change ON public.cafes;
CREATE TRIGGER trg_cafes_guard_owner_change
  BEFORE UPDATE ON public.cafes
  FOR EACH ROW EXECUTE FUNCTION public.cafes_guard_owner_change();
