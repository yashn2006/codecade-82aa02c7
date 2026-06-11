-- ============================================================================
-- CoreCade v8 — Production launch wave
-- POS tax/discount/refund, membership auto-deduct, notifications,
-- bookings no-show + deposit, public page theme + maps, audit log,
-- tournaments matches, geo on cafes.
-- Safe to re-run.
-- ============================================================================

-- =========== Orders: tax, discount, refunds, totals, GST ===========
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_amount      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason   text,
  ADD COLUMN IF NOT EXISTS refunded_at     timestamptz,
  ADD COLUMN IF NOT EXISTS gst_rate        numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_no      text;

-- =========== Bookings: deposit + no-show ===========
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_show_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- =========== Cafes: geo for maps ===========
ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS latitude  numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS gst_no    text,
  ADD COLUMN IF NOT EXISTS default_gst_rate numeric(5,2) NOT NULL DEFAULT 0;

-- =========== Cafe pages: theme + map ===========
ALTER TABLE public.cafe_pages
  ADD COLUMN IF NOT EXISTS theme    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS map_url  text;

-- =========== Sessions: track membership consumption ===========
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS membership_minutes_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show boolean NOT NULL DEFAULT false;

-- ============================================================================
-- Audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_cafe ON public.audit_logs(cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit owner/admin read" ON public.audit_logs;
CREATE POLICY "audit owner/admin read"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = audit_logs.cafe_id AND c.owner_id = auth.uid())
  );

-- ============================================================================
-- Tournament matches (simple bracket)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL,
  match_index integer NOT NULL,
  team_a text,
  team_b text,
  score_a integer,
  score_b integer,
  winner text,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round, match_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_matches TO authenticated;
GRANT SELECT ON public.tournament_matches TO anon;
GRANT ALL ON public.tournament_matches TO service_role;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches public read" ON public.tournament_matches;
CREATE POLICY "matches public read" ON public.tournament_matches
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "matches owner write" ON public.tournament_matches;
CREATE POLICY "matches owner write" ON public.tournament_matches
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tournaments t JOIN public.cafes c ON c.id = t.cafe_id
      WHERE t.id = tournament_matches.tournament_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tournaments t JOIN public.cafes c ON c.id = t.cafe_id
      WHERE t.id = tournament_matches.tournament_id AND c.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RPC: consume membership hours (called from endSession)
-- Returns minutes deducted from active membership for this customer.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_membership_minutes(
  _customer_id uuid,
  _minutes integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cm_row record;
  available_minutes integer;
  consumed integer := 0;
  remaining integer := _minutes;
BEGIN
  IF _customer_id IS NULL OR _minutes <= 0 THEN RETURN 0; END IF;
  -- Loop through valid memberships, oldest expiry first.
  FOR cm_row IN
    SELECT id, hours_remaining FROM public.customer_memberships
    WHERE customer_id = _customer_id
      AND ends_at > now()
      AND hours_remaining > 0
    ORDER BY ends_at ASC
  LOOP
    EXIT WHEN remaining <= 0;
    available_minutes := cm_row.hours_remaining * 60;
    IF available_minutes >= remaining THEN
      UPDATE public.customer_memberships
        SET hours_remaining = hours_remaining - CEIL(remaining::numeric / 60.0)::int
        WHERE id = cm_row.id;
      consumed := consumed + remaining;
      remaining := 0;
    ELSE
      UPDATE public.customer_memberships
        SET hours_remaining = 0
        WHERE id = cm_row.id;
      consumed := consumed + available_minutes;
      remaining := remaining - available_minutes;
    END IF;
  END LOOP;
  RETURN consumed;
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_membership_minutes(uuid, integer) TO authenticated, service_role;

-- ============================================================================
-- RPC: refund order — credits wallet if paid by wallet, else just marks refunded
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_order(
  _order_id uuid,
  _amount integer,
  _reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status <> 'paid' THEN RAISE EXCEPTION 'Only paid orders can be refunded'; END IF;
  IF _amount <= 0 OR _amount > COALESCE(o.total_amount, o.subtotal) - COALESCE(o.refund_amount,0) THEN
    RAISE EXCEPTION 'Invalid refund amount';
  END IF;

  UPDATE public.orders
    SET refund_amount = COALESCE(refund_amount,0) + _amount,
        refund_reason = _reason,
        refunded_at = now(),
        status = CASE WHEN COALESCE(refund_amount,0) + _amount >= COALESCE(total_amount, subtotal)
                      THEN 'refunded' ELSE status END
    WHERE id = _order_id;

  -- If originally wallet-paid and we have a customer, credit wallet back
  IF o.payment_method = 'wallet' AND o.customer_id IS NOT NULL THEN
    PERFORM public.apply_wallet_tx(o.customer_id, o.cafe_id, _amount, 'refund'::text,
      COALESCE(_reason, 'Order refund'));
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refund_order(uuid, integer, text) TO authenticated, service_role;

-- ============================================================================
-- Receipt number sequence per cafe (simple counter in cafes)
-- ============================================================================
ALTER TABLE public.cafes ADD COLUMN IF NOT EXISTS receipt_counter integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.next_receipt_no(_cafe_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.cafes SET receipt_counter = receipt_counter + 1
    WHERE id = _cafe_id RETURNING receipt_counter INTO n;
  RETURN 'R-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYMMDD') || '-' || lpad(n::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_receipt_no(uuid) TO authenticated, service_role;
