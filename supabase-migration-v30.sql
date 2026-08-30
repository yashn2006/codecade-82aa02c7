-- =====================================================================
-- CoreCade v30 — Live Floor: full session detail
-- Adds package/payment/pause tracking to sessions + session alert log.
-- Idempotent: safe to re-run.
-- =====================================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS planned_minutes  integer,
  ADD COLUMN IF NOT EXISTS package_name     text,
  ADD COLUMN IF NOT EXISTS amount_paid      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method   text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS paused_at        timestamptz,
  ADD COLUMN IF NOT EXISTS paused_ms        bigint NOT NULL DEFAULT 0;

-- Alerts sent to the customer during a session -------------------------
CREATE TABLE IF NOT EXISTS public.session_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  cafe_id     uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  channel     text NOT NULL DEFAULT 'whatsapp',
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_alerts_session_idx ON public.session_alerts(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_alerts TO authenticated;
GRANT ALL ON public.session_alerts TO service_role;

ALTER TABLE public.session_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_alerts owner all" ON public.session_alerts;
CREATE POLICY "session_alerts owner all" ON public.session_alerts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c
            WHERE c.id = session_alerts.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cafes c
            WHERE c.id = session_alerts.cafe_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );
