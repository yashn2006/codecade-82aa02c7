-- v32 — Email OTP verification for signup (Resend)
-- Server-only table: accessed exclusively with the service role key.

create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  resend_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists email_otps_email_idx on public.email_otps (email);
create index if not exists email_otps_expires_idx on public.email_otps (expires_at);

-- No anon/authenticated grants on purpose: only the service role touches this.
grant all on public.email_otps to service_role;

alter table public.email_otps enable row level security;
-- RLS on with zero policies => nothing but service_role can read/write.

-- Housekeeping: drop rows older than a day.
delete from public.email_otps where created_at < now() - interval '1 day';
