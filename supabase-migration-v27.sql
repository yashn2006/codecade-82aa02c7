-- v27 — Security & correctness hardening
-- Run in Supabase SQL Editor. Idempotent; safe to re-run.

-- ============================================================
-- 1. TOURNAMENT REGISTRATIONS — prevent duplicate team registration
--    per tournament. Also enables a partial-unique guard so a team
--    name cannot register twice for the same tournament.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_registrations_team
  ON public.tournament_registrations (tournament_id, lower(team_name));

-- Enforce capacity at the DB level (defense-in-depth against the
-- TOCTOU race in the public registration endpoint).
CREATE OR REPLACE FUNCTION public.enforce_tournament_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap int;
  cur int;
BEGIN
  SELECT capacity INTO cap FROM public.tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;
  SELECT COUNT(*) INTO cur FROM public.tournament_registrations WHERE tournament_id = NEW.tournament_id;
  IF cur >= cap THEN
    RAISE EXCEPTION 'Tournament is full';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_tournament_capacity ON public.tournament_registrations;
CREATE TRIGGER trg_enforce_tournament_capacity
  BEFORE INSERT ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tournament_capacity();

-- ============================================================
-- 2. BOOKINGS — prevent overlapping bookings on the same device
--    via an exclusion constraint (kills double-booking races
--    even if two server calls arrive simultaneously).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Only enforce for live bookings (pending/confirmed). Cancelled/completed
-- don't participate. We use a generated tstzrange for the window.
-- Use make_interval() — it's IMMUTABLE, unlike text::interval casts,
-- so Postgres accepts it in a generated-column expression.
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS booking_window;
ALTER TABLE public.bookings
  ADD COLUMN booking_window tstzrange
    GENERATED ALWAYS AS (
      tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_minutes), '[)')
    ) STORED;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_device_bookings;
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_device_bookings
  EXCLUDE USING gist (
    device_id WITH =,
    booking_window WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));

-- ============================================================
-- 3. PERFORMANCE INDEXES for portal + owner dashboards.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_customer_scheduled
  ON public.bookings (customer_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_cafe_scheduled
  ON public.bookings (cafe_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_user_cafe
  ON public.customers (user_id, cafe_id);
CREATE INDEX IF NOT EXISTS idx_devices_cafe_type
  ON public.devices (cafe_id, type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_cafe_created
  ON public.wallet_transactions (cafe_id, created_at DESC);

-- ============================================================
-- DONE. Verify with:
--   SELECT conname FROM pg_constraint
--    WHERE conname IN ('no_overlapping_device_bookings');
--   SELECT tgname FROM pg_trigger
--    WHERE tgname = 'trg_enforce_tournament_capacity';
-- ============================================================
