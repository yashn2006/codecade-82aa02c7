-- =====================================================================
-- CoreCade v29 — Membership RLS fix + phone columns + owner→admin msgs
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1) MEMBERSHIPS RLS -----------------------------------------------------
--    Owners must be able to insert/update/delete their own memberships.
--    Previously only SELECT was scoped; INSERT policy was missing.

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memberships owner all" ON public.memberships;
CREATE POLICY "memberships owner all" ON public.memberships
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c
            WHERE c.id = memberships.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cafes c
            WHERE c.id = memberships.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Same class of bug: customer_memberships insert (grantMembership)
ALTER TABLE public.customer_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_memberships owner all" ON public.customer_memberships;
CREATE POLICY "customer_memberships owner all" ON public.customer_memberships
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers cu
      JOIN public.cafes c ON c.id = cu.cafe_id
      WHERE cu.id = customer_memberships.customer_id AND c.owner_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers cu
      JOIN public.cafes c ON c.id = cu.cafe_id
      WHERE cu.id = customer_memberships.customer_id AND c.owner_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'super_admin')
  );

-- 2) PHONE columns everywhere the request lists ----------------------
ALTER TABLE public.profiles           ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.staff_permissions  ADD COLUMN IF NOT EXISTS phone text;
-- cafes.phone and customers.phone already exist.

-- 3) OWNER → ADMIN messaging (mirror of admin_messages) --------------
CREATE TABLE IF NOT EXISTS public.owner_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cafe_id     uuid REFERENCES public.cafes(id) ON DELETE SET NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.owner_messages TO authenticated;
GRANT ALL ON public.owner_messages TO service_role;

ALTER TABLE public.owner_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_messages sender insert" ON public.owner_messages;
CREATE POLICY "owner_messages sender insert" ON public.owner_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "owner_messages sender read" ON public.owner_messages;
CREATE POLICY "owner_messages sender read" ON public.owner_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "owner_messages admin update" ON public.owner_messages;
CREATE POLICY "owner_messages admin update" ON public.owner_messages
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS owner_messages_sent_at_idx
  ON public.owner_messages (sent_at DESC);
CREATE INDEX IF NOT EXISTS owner_messages_unread_idx
  ON public.owner_messages (read_at) WHERE read_at IS NULL;
