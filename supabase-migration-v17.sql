-- ============================================================
-- v17 — Café operating hours + days open
-- ============================================================

alter table public.cafes
  add column if not exists open_time text,           -- "10:00"
  add column if not exists close_time text,          -- "23:00"
  add column if not exists open_days int[] default '{1,2,3,4,5,6,0}'::int[];
  -- 0=Sun, 1=Mon ... 6=Sat — matches JS Date.getDay()

comment on column public.cafes.open_time is 'Opening time in HH:MM (24h, local cafe time).';
comment on column public.cafes.close_time is 'Closing time in HH:MM (24h). If <= open_time, treated as next-day close.';
comment on column public.cafes.open_days is 'Array of weekday indexes the cafe is open (0=Sun..6=Sat).';
