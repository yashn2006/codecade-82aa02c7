-- v9 — Platform config (fees, tax, branding) + user activity RPC
-- Safe to run multiple times.

-- 1) Extend platform_settings with config columns
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS platform_fee_pct  numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_tax_pct   numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency          text         NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS support_email     text,
  ADD COLUMN IF NOT EXISTS support_phone     text,
  ADD COLUMN IF NOT EXISTS brand_name        text,
  ADD COLUMN IF NOT EXISTS brand_tagline     text,
  ADD COLUMN IF NOT EXISTS signup_enabled    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_cafes_require_approval boolean NOT NULL DEFAULT false;

-- 2) Helper: per-user activity summary (super-admin only via server fn)
CREATE OR REPLACE FUNCTION public.user_activity_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  result jsonb;
  wallet_total bigint := 0;
BEGIN
  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COALESCE(sum(wt.amount), 0)
      FROM public.wallet_transactions wt
      JOIN public.customers c ON c.id = wt.customer_id
      WHERE c.user_id = $1
    $q$ INTO wallet_total USING _user_id;
  END IF;

  SELECT jsonb_build_object(
    'sessions_started',
      (SELECT count(*) FROM public.sessions s
        JOIN public.customers c ON c.id = s.customer_id
        WHERE c.user_id = _user_id),
    'orders_placed',
      (SELECT count(*) FROM public.orders o
        JOIN public.customers c ON c.id = o.customer_id
        WHERE c.user_id = _user_id),
    'bookings_made',
      (SELECT count(*) FROM public.bookings b
        JOIN public.customers c ON c.id = b.customer_id
        WHERE c.user_id = _user_id),
    'wallet_balance', wallet_total,
    'cafes_owned',
      (SELECT count(*) FROM public.cafes WHERE owner_id = _user_id),
    'audit_events_24h',
      (SELECT count(*) FROM public.audit_logs
        WHERE actor_id = _user_id
          AND created_at > now() - interval '24 hours')
  ) INTO result;

  RETURN result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.user_activity_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_activity_summary(uuid) TO authenticated, service_role;
