-- ============================================================
-- CoreCade Migration v12 — Phase C
-- Booking deposit (wallet auto-deduct/refund) + no-show cron
-- Run AFTER v11.
-- ============================================================

-- Optional grace window (minutes) for no-show auto flag.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS no_show_grace_minutes integer NOT NULL DEFAULT 15;

-- ---------- RPC: pay deposit from wallet ----------
CREATE OR REPLACE FUNCTION public.pay_booking_deposit(_booking_id uuid, _amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_bal     integer;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT id, cafe_id, customer_id, deposit_paid
    INTO v_booking
  FROM public.bookings
  WHERE id = _booking_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_booking.customer_id IS NULL THEN RAISE EXCEPTION 'Booking has no customer'; END IF;
  IF v_booking.deposit_paid THEN RAISE EXCEPTION 'Deposit already paid'; END IF;

  SELECT wallet_balance INTO v_bal FROM public.customers WHERE id = v_booking.customer_id FOR UPDATE;
  IF v_bal < _amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  PERFORM public.apply_wallet_tx(
    v_booking.customer_id, v_booking.cafe_id, -_amount, 'session',
    'Booking deposit ' || _booking_id::text
  );

  UPDATE public.bookings
     SET deposit_amount = _amount, deposit_paid = true
   WHERE id = _booking_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_booking_deposit(uuid, integer) TO authenticated;

-- ---------- RPC: refund deposit ----------
CREATE OR REPLACE FUNCTION public.refund_booking_deposit(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_booking record;
BEGIN
  SELECT id, cafe_id, customer_id, deposit_amount, deposit_paid
    INTO v_booking
  FROM public.bookings
  WHERE id = _booking_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT v_booking.deposit_paid THEN RETURN; END IF;
  IF v_booking.customer_id IS NULL OR v_booking.deposit_amount <= 0 THEN RETURN; END IF;

  PERFORM public.apply_wallet_tx(
    v_booking.customer_id, v_booking.cafe_id, v_booking.deposit_amount, 'refund',
    'Booking refund ' || _booking_id::text
  );

  UPDATE public.bookings
     SET deposit_paid = false
   WHERE id = _booking_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refund_booking_deposit(uuid) TO authenticated;

-- ---------- RPC: auto-flag no-shows (called by pg_cron) ----------
CREATE OR REPLACE FUNCTION public.auto_flag_no_shows()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH flagged AS (
    UPDATE public.bookings
       SET status = 'no_show', no_show_at = now()
     WHERE status IN ('pending','confirmed')
       AND (scheduled_at + (no_show_grace_minutes || ' minutes')::interval) < now()
       AND no_show_at IS NULL
     RETURNING id
  )
  SELECT count(*) INTO v_count FROM flagged;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_flag_no_shows() TO service_role;

-- ---------- Schedule cron (every 5 minutes) ----------
-- Requires pg_cron extension. Safe to re-run.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('corecade-auto-no-show');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'corecade-auto-no-show',
  '*/5 * * * *',
  $$SELECT public.auto_flag_no_shows();$$
);
