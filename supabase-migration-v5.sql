-- ============================================================================
-- CoreCade — Floor Builder patch v5
-- Adds grid placement (pos_x, pos_y) + zone label/color to devices,
-- and floor dimensions to cafes.
-- Safe to re-run (idempotent).
-- ============================================================================

alter table public.devices add column if not exists pos_x integer;
alter table public.devices add column if not exists pos_y integer;
alter table public.devices add column if not exists zone text;
alter table public.devices add column if not exists zone_color text;

alter table public.cafes add column if not exists floor_cols integer not null default 10;
alter table public.cafes add column if not exists floor_rows integer not null default 6;
