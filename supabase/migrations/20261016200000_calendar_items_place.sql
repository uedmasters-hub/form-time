-- FORM / TIME — where an item happens: a place or a meeting link.
-- Run after 20261016120000_calendar_items.sql. Safe to run again.

alter table public.calendar_items
  add column if not exists place text not null default ''
    check (char_length(place) <= 500);
