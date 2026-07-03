-- ============================================================================
-- CoreCade v23 — Pre-Launch Final Schema
-- Run this AFTER v1-v22 in Supabase SQL Editor.
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE / DROP+CREATE.
-- ============================================================================

-- =========== 1. ADMIN-TO-OWNER MESSAGES ===========
-- Admins can broadcast messages to any cafe owner; owners see their inbox.

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- admin
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- owner
  cafe_id uuid REFERENCES public.cafes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_msg_recipient ON public.admin_messages(recipient_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_msg_sender ON public.admin_messages(sender_id, sent_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin msg recipient read" ON public.admin_messages;
CREATE POLICY "admin msg recipient read" ON public.admin_messages FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "admin msg admin write" ON public.admin_messages;
CREATE POLICY "admin msg admin write" ON public.admin_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admin msg recipient update" ON public.admin_messages;
CREATE POLICY "admin msg recipient update" ON public.admin_messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- =========== 2. TRIAL EXTENSIONS (manual overrides by admin) ===========
-- Every time an admin extends a trial, we log it here for audit + history.

CREATE TABLE IF NOT EXISTS public.trial_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_ends_at timestamptz,
  new_ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trial_ext_cafe ON public.trial_extensions(cafe_id, created_at DESC);

GRANT SELECT ON public.trial_extensions TO authenticated;
GRANT ALL ON public.trial_extensions TO service_role;

ALTER TABLE public.trial_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial ext admin read" ON public.trial_extensions;
CREATE POLICY "trial ext admin read" ON public.trial_extensions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = trial_extensions.cafe_id AND c.owner_id = auth.uid())
  );

-- =========== 3. MANUAL REVENUE ENTRIES (cash / UPI / QR) ===========
-- Cafe owners can record income that never touched Razorpay (cash, UPI scan, etc).

CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  amount integer NOT NULL,                    -- paise (₹1 = 100)
  kind text NOT NULL DEFAULT 'cash',          -- cash | upi | card | other
  source text NOT NULL DEFAULT 'session',     -- session | pos | membership | tournament | other
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rev_cafe ON public.revenue_entries(cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_kind ON public.revenue_entries(cafe_id, kind, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_entries TO authenticated;
GRANT ALL ON public.revenue_entries TO service_role;

ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenue owner manage" ON public.revenue_entries;
CREATE POLICY "revenue owner manage" ON public.revenue_entries FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = revenue_entries.cafe_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = revenue_entries.cafe_id AND sp.staff_user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = revenue_entries.cafe_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = revenue_entries.cafe_id AND sp.staff_user_id = auth.uid())
  );

-- =========== 4. EMAIL LOGS (notification delivery tracking) ===========
-- Tracks every email sent from the app so admins can verify delivery.

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  template text NOT NULL,                      -- welcome | receipt | trial_ending | admin_message | password_reset
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',       -- queued | sent | delivered | bounced | failed
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_status ON public.email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_to ON public.email_logs(to_email, created_at DESC);

GRANT SELECT, INSERT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email log admin read" ON public.email_logs;
CREATE POLICY "email log admin read" ON public.email_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "email log insert" ON public.email_logs;
CREATE POLICY "email log insert" ON public.email_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =========== 5. RPC: extend trial (admin only) ===========
-- Callable from admin dashboard to add days to a cafe's trial.

CREATE OR REPLACE FUNCTION public.extend_trial(
  _cafe_id uuid,
  _add_days integer,
  _reason text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_old timestamptz;
  v_new timestamptz;
BEGIN
  IF NOT public.has_role(v_admin, 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: only super_admin can extend trials';
  END IF;

  SELECT trial_ends_at INTO v_old FROM public.cafes WHERE id = _cafe_id;
  IF v_old IS NULL THEN v_old := now(); END IF;
  v_new := v_old + (_add_days || ' days')::interval;

  UPDATE public.cafes
     SET trial_ends_at = v_new,
         subscription_status = CASE WHEN subscription_status = 'expired' THEN 'trialing' ELSE subscription_status END,
         updated_at = now()
   WHERE id = _cafe_id;

  INSERT INTO public.trial_extensions (cafe_id, admin_id, previous_ends_at, new_ends_at, reason)
  VALUES (_cafe_id, v_admin, v_old, v_new, _reason);

  -- notify owner
  INSERT INTO public.notifications (user_id, cafe_id, kind, title, body, link)
  SELECT c.owner_id, c.id, 'trial_extended',
         'Trial extended — ' || c.name,
         'Your trial was extended by ' || _add_days || ' day(s). New expiry: ' || to_char(v_new AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
         '/owner'
  FROM public.cafes c WHERE c.id = _cafe_id;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_trial(uuid, integer, text) TO authenticated, service_role;

-- =========== 6. RPC: record manual revenue (owner/staff) ===========

CREATE OR REPLACE FUNCTION public.record_revenue(
  _cafe_id uuid,
  _amount integer,
  _kind text,
  _source text,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed boolean;
  v_id uuid;
BEGIN
  SELECT
    public.has_role(v_user, 'super_admin')
    OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = _cafe_id AND c.owner_id = v_user)
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = _cafe_id AND sp.staff_user_id = v_user)
  INTO v_allowed;
  IF NOT v_allowed THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.revenue_entries (cafe_id, amount, kind, source, note, recorded_by)
  VALUES (_cafe_id, _amount, _kind, _source, _note, v_user)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_revenue(uuid, integer, text, text, text) TO authenticated, service_role;

-- =========== 7. RPC: admin broadcast message to all owners ===========

CREATE OR REPLACE FUNCTION public.broadcast_admin_message(
  _subject text,
  _body text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_count integer := 0;
  r record;
BEGIN
  IF NOT public.has_role(v_admin, 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: only super_admin can broadcast';
  END IF;

  FOR r IN SELECT id, owner_id FROM public.cafes WHERE is_active = true LOOP
    INSERT INTO public.admin_messages (sender_id, recipient_id, cafe_id, subject, body)
    VALUES (v_admin, r.owner_id, r.id, _subject, _body);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.broadcast_admin_message(text, text) TO authenticated, service_role;

-- =========== 8. CAFES: trial_ends_at + subscription_status (if missing) ===========
-- These were added in earlier migrations but safe-guarded here.

ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing';

-- =========== 9. VIEWS: revenue summary per cafe (today + this month) ===========

CREATE OR REPLACE VIEW public.v_revenue_today AS
  SELECT cafe_id, coalesce(sum(amount), 0)::int AS revenue
  FROM public.revenue_entries
  WHERE created_at >= date_trunc('day', now())
  GROUP BY cafe_id;

CREATE OR REPLACE VIEW public.v_revenue_month AS
  SELECT cafe_id, coalesce(sum(amount), 0)::int AS revenue
  FROM public.revenue_entries
  WHERE created_at >= date_trunc('month', now())
  GROUP BY cafe_id;

GRANT SELECT ON public.v_revenue_today TO authenticated, service_role;
GRANT SELECT ON public.v_revenue_month TO authenticated, service_role;

-- =========== 10. INDEXES ON EXISTING TABLES (performance) ===========

CREATE INDEX IF NOT EXISTS idx_cafes_owner ON public.cafes(owner_id);
CREATE INDEX IF NOT EXISTS idx_cafes_status ON public.cafes(subscription_status, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_sessions_cafe_date ON public.sessions(cafe_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_cafe ON public.bookings(cafe_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_cafe ON public.customers(cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_cafe ON public.devices(cafe_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_cafe_status ON public.orders(cafe_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_cafe ON public.wallet_transactions(cafe_id, created_at DESC);

-- ============================================================================
-- END v23
-- ============================================================================
