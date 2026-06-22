-- v22 — UPI payment fields on cafe_pages
-- Run in Supabase SQL editor.

alter table public.cafe_pages
  add column if not exists upi_id text,
  add column if not exists upi_qr_url text;

comment on column public.cafe_pages.upi_id is 'Café UPI VPA (e.g. cafe@upi) shown to customers for direct payment.';
comment on column public.cafe_pages.upi_qr_url is 'Optional UPI QR image URL uploaded by the café owner.';
