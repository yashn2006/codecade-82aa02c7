-- supabase-migration-v24.sql
-- Terms acceptance tracking + safety belts for launch.

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

alter table public.cafes add column if not exists terms_accepted_at timestamptz;
alter table public.cafes add column if not exists terms_version text;

-- Belt-and-suspenders: make sure RLS is enabled on every v23 table.
do $$
declare t text;
begin
  for t in select unnest(array[
    'admin_messages','trial_extensions','email_logs','revenue_entries'
  ]) loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- Quick verification helper — call `select * from public.rls_status();`
create or replace view public.rls_status as
  select schemaname, tablename, rowsecurity
  from pg_tables
  where schemaname = 'public'
  order by tablename;

grant select on public.rls_status to authenticated;
