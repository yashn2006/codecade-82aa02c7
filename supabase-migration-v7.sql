-- Phase 5: Maintenance Mode (per-cafe + platform-wide) with scheduler.
--
-- Adds time-windowed maintenance to cafes (owner or super admin can set).
-- Adds a singleton platform_settings table for super admin network-wide maintenance.
-- Both expose "maintenance_active" view via simple computed helpers below.

-- ============================================================
-- 1) Per-cafe maintenance window
-- ============================================================
ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS maintenance_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_ends_at   timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_message   text;

COMMENT ON COLUMN public.cafes.maintenance_starts_at IS
  'When maintenance begins. If now() between start and end (or end is null and start <= now), cafe is in maintenance.';
COMMENT ON COLUMN public.cafes.maintenance_ends_at IS
  'When maintenance auto-lifts. NULL = manual lift required.';
COMMENT ON COLUMN public.cafes.maintenance_message IS
  'Public-facing message shown on the cafe landing page during maintenance.';

-- ============================================================
-- 2) Platform-wide maintenance (super admin only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_starts_at timestamptz,
  maintenance_ends_at   timestamptz,
  maintenance_message   text,
  maintenance_title     text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL    ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings public read" ON public.platform_settings;
CREATE POLICY "platform_settings public read"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "platform_settings admin write" ON public.platform_settings;
CREATE POLICY "platform_settings admin write"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.platform_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;
