-- ============================================================
-- CoreCade Migration v14 — Booking payment methods + Razorpay
-- Adds payment_method + razorpay refs on bookings.
-- Run AFTER v13.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.booking_payment_method AS ENUM ('pay_online', 'pay_at_cafe', 'cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method public.booking_payment_method NOT NULL DEFAULT 'pay_at_cafe',
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS bookings_razorpay_order_idx
  ON public.bookings (razorpay_order_id);
