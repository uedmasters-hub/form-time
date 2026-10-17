-- FORM / TIME — each account's settings and calendar preferences (dial,
-- appearance, movement, week start, region, holiday filters…), one row per
-- user. Safe to run again.
--
-- Privacy: row-level security lets each signed-in user read and write only
-- their own row; anonymous (signed-out) requests get nothing.

create table if not exists public.user_settings (
  user_id    uuid primary key default auth.uid()
               references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb
               check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 16384),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Own settings: read" on public.user_settings;
create policy "Own settings: read" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Own settings: add" on public.user_settings;
create policy "Own settings: add" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Own settings: change" on public.user_settings;
create policy "Own settings: change" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_settings from anon;
grant select, insert, update on public.user_settings to authenticated;
