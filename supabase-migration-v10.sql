-- ============================================================================
-- CoreCade v10 — Phase A: split bills, device commands, staff matrix,
-- tournament payout + public registration, wallet statement.
-- Safe to re-run.
-- ============================================================================

-- ============== POS: split bills (parent reference) ==============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_label text;
CREATE INDEX IF NOT EXISTS idx_orders_parent ON public.orders(parent_order_id);

-- ============== Device commands queue ==============
CREATE TABLE IF NOT EXISTS public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  cafe_id  uuid NOT NULL REFERENCES public.cafes(id)   ON DELETE CASCADE,
  command  text NOT NULL,                       -- lock | unlock | screenshot | message | reboot | kill_session
  payload  jsonb NOT NULL DEFAULT '{}'::jsonb,
  status   text NOT NULL DEFAULT 'pending',     -- pending | sent | executed | failed | cancelled
  result   jsonb,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_devcmd_device ON public.device_commands(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devcmd_cafe   ON public.device_commands(cafe_id, status);

GRANT SELECT, INSERT, UPDATE ON public.device_commands TO authenticated;
GRANT ALL ON public.device_commands TO service_role;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "devcmd cafe rw" ON public.device_commands;
CREATE POLICY "devcmd cafe rw" ON public.device_commands FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = device_commands.cafe_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = device_commands.cafe_id AND sp.staff_user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = device_commands.cafe_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = device_commands.cafe_id AND sp.staff_user_id = auth.uid())
  );

-- ============== Staff: last_seen for online status ==============
ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- ============== Tournaments: winner + payout ==============
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS winner_team        text,
  ADD COLUMN IF NOT EXISTS winner_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_amount      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_out_at        timestamptz;

CREATE OR REPLACE FUNCTION public.payout_tournament(
  _tournament_id uuid,
  _customer_id   uuid,
  _winner_team   text,
  _amount        integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record; v_user uuid := auth.uid(); v_allowed boolean;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  SELECT
    public.has_role(v_user, 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = t.cafe_id AND c.owner_id = v_user)
  INTO v_allowed;
  IF NOT v_allowed THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF t.paid_out_at IS NOT NULL THEN RAISE EXCEPTION 'Prize already paid out'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  PERFORM public.apply_wallet_tx(_customer_id, t.cafe_id, _amount, 'topup',
    'Tournament prize: ' || t.title || COALESCE(' (' || _winner_team || ')', ''));

  UPDATE public.tournaments
    SET winner_customer_id = _customer_id,
        winner_team        = _winner_team,
        payout_amount      = _amount,
        paid_out_at        = now(),
        status             = 'completed'
    WHERE id = _tournament_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.payout_tournament(uuid, uuid, text, integer) TO authenticated, service_role;

-- ============== Public tournament read + anon registration ==============
GRANT SELECT ON public.tournaments               TO anon;
GRANT SELECT ON public.tournament_registrations  TO anon;
GRANT INSERT ON public.tournament_registrations  TO anon;

DROP POLICY IF EXISTS "tourn public read" ON public.tournaments;
CREATE POLICY "tourn public read" ON public.tournaments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "treg public read" ON public.tournament_registrations;
CREATE POLICY "treg public read" ON public.tournament_registrations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "treg public insert" ON public.tournament_registrations;
CREATE POLICY "treg public insert" ON public.tournament_registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- only allow inserts on open, upcoming tournaments that are not full
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_registrations.tournament_id
        AND t.status = 'upcoming'
        AND (SELECT count(*) FROM public.tournament_registrations r WHERE r.tournament_id = t.id) < t.capacity
    )
  );
