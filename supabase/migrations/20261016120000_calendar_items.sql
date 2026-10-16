-- FORM / TIME — the user's own calendar items (events, meetings, notes,
-- follow-ups, alarms). Run once in the Supabase SQL editor, or with
-- `supabase db push`. Safe to run again.
--
-- Privacy: every row belongs to the signed-in user (auth.uid()); row-level
-- security lets each user read and write only their own rows. The app signs
-- in anonymously until accounts are added, so enable "Allow anonymous
-- sign-ins" under Authentication → Sign In / Providers.

create table if not exists public.calendar_items (
  id               uuid primary key,
  user_id          uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  kind             text not null
                     check (kind in ('event', 'meeting', 'note', 'follow_up', 'alarm')),
  title            text not null default '' check (char_length(title) <= 200),
  notes            text not null default '' check (char_length(notes) <= 4000),
  -- What the user meant: a wall-clock date and time in a named zone…
  local_date       date not null,
  local_time       time,                        -- null: all day / untimed
  time_zone        text not null check (char_length(time_zone) <= 64),
  -- …and the instants that works out to.
  starts_at        timestamptz,
  remind_at        timestamptz,
  reminder_minutes integer check (reminder_minutes between 0 and 10080),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Soft delete, so a deletion reaches the user's other devices.
  deleted_at       timestamptz
);

create index if not exists calendar_items_user_date
  on public.calendar_items (user_id, local_date);
create index if not exists calendar_items_user_updated
  on public.calendar_items (user_id, updated_at);

alter table public.calendar_items enable row level security;

drop policy if exists "Own items: read" on public.calendar_items;
create policy "Own items: read" on public.calendar_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Own items: add" on public.calendar_items;
create policy "Own items: add" on public.calendar_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Own items: change" on public.calendar_items;
create policy "Own items: change" on public.calendar_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own items: remove" on public.calendar_items;
create policy "Own items: remove" on public.calendar_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Only signed-in users (including anonymous ones) get the table; never anon.
revoke all on public.calendar_items from anon;
grant select, insert, update, delete on public.calendar_items to authenticated;
