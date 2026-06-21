-- v21 — Realtime publication for live cafe theme/page updates + Batch D polish
-- Run in Supabase SQL editor.

-- Enable realtime broadcasts for cafe_pages and cafes so the public /c/$slug
-- page updates the moment the owner saves a theme/logo change.
do $$
begin
  begin
    alter publication supabase_realtime add table public.cafe_pages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.cafes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_tickets;
  exception when duplicate_object then null;
  end;
end $$;

-- REPLICA IDENTITY FULL so payloads include all columns for downstream UI.
alter table public.cafe_pages replica identity full;
alter table public.cafes replica identity full;
