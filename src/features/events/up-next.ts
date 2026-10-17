import { addDays, toISODate } from '@/features/calendar/calendar-date';

import { formatWallTime, instantToWall, placeIn } from './item-time';
import type { CalendarItem } from './types';

/**
 * What's coming up, for the digital watch, soonest first: anything under
 * way ("Now"), then today's and tomorrow's timed items (alarms included) in
 * time order, then today's all-day items. "in 12 min" marks anything
 * within the hour.
 */
export type Upcoming = {
  item: CalendarItem;
  /** "10:00 AM", "All day", "Tomorrow · 9:00 AM". */
  when: string;
  /** "Now", "in 12 min", or null when it's further off. */
  relative: string | null;
};

export type UpNext = {
  rows: Upcoming[];
  /** How many more there are beyond `rows`. */
  more: number;
};

/** Items that started this recently still show, as "Now". */
const NOW_WINDOW_MS = 10 * 60_000;
const SOON_MS = 60 * 60_000;

export function upNext(
  items: CalendarItem[],
  now: number,
  timeZone: string,
  { limit = 3, hour12 }: { limit?: number; hour12?: boolean } = {},
): UpNext {
  const today = instantToWall(now, timeZone).date;
  const todayISO = toISODate(today);
  const tomorrowISO = toISODate(addDays(today, 1));

  type Entry = Upcoming & { at: number };
  const entries: Entry[] = [];
  for (const item of items) {
    if (item.deletedAt) continue;
    const placed = placeIn(item, timeZone);
    if (!item.startsAt || !placed.time) {
      // All day: after the timed items, in the order they were made.
      if (placed.date === todayISO) {
        entries.push({ item, when: 'All day', relative: null, at: Infinity });
      }
      continue;
    }
    const at = Date.parse(item.startsAt);
    if (at < now - NOW_WINDOW_MS) continue;
    if (placed.date !== todayISO && placed.date !== tomorrowISO) continue;
    const time = formatWallTime(placed.time, placed.time.seconds !== 0, hour12);
    const until = at - now;
    entries.push({
      item,
      at,
      when: placed.date === todayISO ? time : `Tomorrow · ${time}`,
      relative:
        until <= 0
          ? 'Now'
          : until < SOON_MS
            ? `in ${Math.max(1, Math.ceil(until / 60_000))} min`
            : null,
    });
  }
  // Stable: equal times (and all-day items) keep their order.
  entries.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));

  return {
    rows: entries.slice(0, limit).map(({ at: _at, ...u }) => u),
    more: Math.max(0, entries.length - limit),
  };
}
