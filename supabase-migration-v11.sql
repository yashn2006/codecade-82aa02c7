-- ============================================================
-- CoreCade Migration v11 — Phase B
-- Razorpay wallet top-ups + Storage bucket for café gallery
-- Run AFTER v10.
-- ============================================================

-- ---------- 1. Wallet top-ups (Razorpay) ----------
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id         uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount          integer NOT NULL CHECK (amount > 0),    -- rupees
  currency        text NOT NULL DEFAULT 'INR',
  razorpay_order_id   text UNIQUE,
  razorpay_payment_id text,
  razorpay_signature  text,
  status          text NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','paid','failed','refunded')),
  notes           jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz
);

CREATE INDEX IF NOT EXISTS wallet_topups_cafe_idx     ON public.wallet_topups(cafe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_topups_customer_idx ON public.wallet_topups(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_topups_order_idx    ON public.wallet_topups(razorpay_order_id);

GRANT SELECT, INSERT, UPDATE ON public.wallet_topups TO authenticated;
GRANT ALL ON public.wallet_topups TO service_role;

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topups_select_owner_staff" ON public.wallet_topups;
CREATE POLICY "topups_select_owner_staff" ON public.wallet_topups
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = wallet_topups.cafe_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = wallet_topups.cafe_id AND sp.staff_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "topups_insert_owner_staff" ON public.wallet_topups;
CREATE POLICY "topups_insert_owner_staff" ON public.wallet_topups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = wallet_topups.cafe_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id = wallet_topups.cafe_id AND sp.staff_user_id = auth.uid())
  );

-- ---------- 2. Storage bucket for café galleries ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cafe-gallery', 'cafe-gallery', true, 8388608,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "cafe_gallery_public_read" ON storage.objects;
CREATE POLICY "cafe_gallery_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'cafe-gallery');

-- Authenticated café owners/staff can upload to their cafe folder (cafe_id/<anything>)
DROP POLICY IF EXISTS "cafe_gallery_insert_owner_staff" ON storage.objects;
CREATE POLICY "cafe_gallery_insert_owner_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cafe-gallery'
    AND (
      EXISTS (SELECT 1 FROM public.cafes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id::text = (storage.foldername(name))[1] AND sp.staff_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "cafe_gallery_update_owner_staff" ON storage.objects;
CREATE POLICY "cafe_gallery_update_owner_staff" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cafe-gallery'
    AND (
      EXISTS (SELECT 1 FROM public.cafes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id::text = (storage.foldername(name))[1] AND sp.staff_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "cafe_gallery_delete_owner_staff" ON storage.objects;
CREATE POLICY "cafe_gallery_delete_owner_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cafe-gallery'
    AND (
      EXISTS (SELECT 1 FROM public.cafes c WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.staff_permissions sp WHERE sp.cafe_id::text = (storage.foldername(name))[1] AND sp.staff_user_id = auth.uid())
    )
  );
