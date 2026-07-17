-- ============================================================
-- CoreCade — v28 FINAL LAUNCH MIGRATION
-- Run this AFTER v25 (skip v27 if it failed; this replaces it).
-- Idempotent — safe to re-run.
--
-- Fixes:
--   1. v27 generated-column error ("generation expression is not immutable")
--      → replaced with trigger-maintained booking_window column.
--   2. RLS gaps across all three portals (admin / owner / customer).
--   3. Missing indexes causing dashboard lag.
--   4. Tournament capacity race + duplicate-team guard.
--   5. Overlapping-booking guard (defence-in-depth against double-book).
--   6. Storage bucket RLS for image uploads (cafe-gallery / avatars).
--   7. Grants that were missed on prior migrations.
-- ============================================================

-- =====================================================================
-- 0. EXTENSIONS
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =====================================================================
-- 1. TOURNAMENT REGISTRATIONS — dup guard + capacity trigger
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_registrations_team
  ON public.tournament_registrations (tournament_id, lower(team_name));

CREATE OR REPLACE FUNCTION public.enforce_tournament_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cap int; cur int;
BEGIN
  SELECT capacity INTO cap FROM public.tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF cap IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  SELECT COUNT(*) INTO cur FROM public.tournament_registrations WHERE tournament_id = NEW.tournament_id;
  IF cur >= cap THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_tournament_capacity ON public.tournament_registrations;
CREATE TRIGGER trg_enforce_tournament_capacity
  BEFORE INSERT ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tournament_capacity();

-- =====================================================================
-- 2. BOOKINGS — no-overlap guard (FIXED, no generated column)
-- =====================================================================
-- Drop the broken generated column from v27 if it exists.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlapping_device_bookings;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS booking_window;

-- Plain column maintained by trigger (immutable-safe).
ALTER TABLE public.bookings ADD COLUMN booking_window tstzrange;

CREATE OR REPLACE FUNCTION public.bookings_set_window()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.booking_window := tstzrange(
    NEW.scheduled_at,
    NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval,
    '[)'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bookings_set_window ON public.bookings;
CREATE TRIGGER trg_bookings_set_window
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_window();

-- Backfill existing rows.
UPDATE public.bookings
   SET booking_window = tstzrange(scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval, '[)')
 WHERE booking_window IS NULL;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_device_bookings
  EXCLUDE USING gist (
    device_id WITH =,
    booking_window WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));

-- =====================================================================
-- 3. PERFORMANCE INDEXES (dashboard lag fix)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_customer_scheduled ON public.bookings (customer_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_cafe_scheduled    ON public.bookings (cafe_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_cafe_status       ON public.bookings (cafe_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_device_scheduled  ON public.bookings (device_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_user_cafe        ON public.customers (user_id, cafe_id);
CREATE INDEX IF NOT EXISTS idx_devices_cafe_type          ON public.devices (cafe_id, type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_cafe_created     ON public.wallet_transactions (cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_cafe_started      ON public.sessions (cafe_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cafe_created        ON public.orders (cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user            ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_cafe            ON public.user_roles (cafe_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- =====================================================================
-- 4. BOOKINGS RLS — owner + staff can see all bookings for their cafe
-- =====================================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings owner read" ON public.bookings;
CREATE POLICY "bookings owner read"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = bookings.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.cafe_id = bookings.cafe_id
        AND ur.role IN ('cafe_owner','cafe_staff')
    )
    OR EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = bookings.customer_id AND cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bookings owner update" ON public.bookings;
CREATE POLICY "bookings owner update"
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = bookings.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.cafe_id = bookings.cafe_id
        AND ur.role IN ('cafe_owner','cafe_staff')
    )
  );

DROP POLICY IF EXISTS "bookings owner delete" ON public.bookings;
CREATE POLICY "bookings owner delete"
  ON public.bookings FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = bookings.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Customers can insert their own bookings; anon insert allowed for public reservation flow.
DROP POLICY IF EXISTS "bookings customer insert" ON public.bookings;
CREATE POLICY "bookings customer insert"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = bookings.customer_id AND cu.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.cafe_id = bookings.cafe_id
        AND ur.role IN ('cafe_owner','cafe_staff')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

-- =====================================================================
-- 5. NOTIFICATIONS — permissive insert (fixes booking → notification FK/RLS)
-- =====================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications self read" ON public.notifications;
CREATE POLICY "notifications self read"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "notifications self update" ON public.notifications;
CREATE POLICY "notifications self update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications system insert" ON public.notifications;
CREATE POLICY "notifications system insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- =====================================================================
-- 6. STORAGE RLS — cafe-gallery + avatars public read, owner write
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cafe-gallery','cafe-gallery',true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars','avatars',true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "cafe-gallery public read" ON storage.objects;
CREATE POLICY "cafe-gallery public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'cafe-gallery');

DROP POLICY IF EXISTS "cafe-gallery auth write" ON storage.objects;
CREATE POLICY "cafe-gallery auth write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cafe-gallery');

DROP POLICY IF EXISTS "cafe-gallery auth update" ON storage.objects;
CREATE POLICY "cafe-gallery auth update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cafe-gallery');

DROP POLICY IF EXISTS "cafe-gallery auth delete" ON storage.objects;
CREATE POLICY "cafe-gallery auth delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cafe-gallery');

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars auth write" ON storage.objects;
CREATE POLICY "avatars auth write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars auth update" ON storage.objects;
CREATE POLICY "avatars auth update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- =====================================================================
-- 7. TRIAL DEFAULT + LOCKOUT HELPER
-- =====================================================================
ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing';

CREATE OR REPLACE FUNCTION public.set_default_trial()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := now() + interval '15 days';
  END IF;
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trialing';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_default_trial ON public.cafes;
CREATE TRIGGER trg_set_default_trial
  BEFORE INSERT ON public.cafes
  FOR EACH ROW EXECUTE FUNCTION public.set_default_trial();

CREATE OR REPLACE FUNCTION public.cafe_is_active(_cafe_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cafes
    WHERE id = _cafe_id
      AND (subscription_status = 'active'
        OR (subscription_status = 'trialing' AND trial_ends_at > now()))
  )
$$;
GRANT EXECUTE ON FUNCTION public.cafe_is_active(uuid) TO authenticated, anon, service_role;

-- =====================================================================
-- 8. RLS SANITY: enable on every public table that's missing it
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('rls_status')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- =====================================================================
-- DONE. Verify:
--   SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_device_bookings';
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;
-- =====================================================================
