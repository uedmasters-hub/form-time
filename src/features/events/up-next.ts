import { addDays, toISODate } from '@/features/calendar/calendar-date';

import { formatWallTime, instantToWall, placeIn } from './item-time';
import type { CalendarItem } from './types';

/**
 * What's coming up, for the digital watch: the next alarm, then today's
 * items (all-day first, then by time) and tomorrow's, with "Now" or
 * "in 12 min" on anything close.
 */
export type Upcoming = {
  item: CalendarItem;
  /** "10:00 AM", "All day", "Tomorrow · 9:00 AM". */
  when: string;
  /** "Now", "in 12 min", or null when it's further off. */
  relative: string | null;
};

export type UpNext = {
  /** The next alarm within a day. */
  alarm: Upcoming | null;
  rows: Upcoming[];
  /** How many more there are beyond `rows`. */
  more: number;
};

/** Items that started this recently still show, as "Now". */
const NOW_WINDOW_MS = 10 * 60_000;
const SOON_MS = 60 * 60_000;
const ALARM_WINDOW_MS = 24 * 3600_000;

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
      if (placed.date === todayISO) {
        entries.push({ item, when: 'All day', relative: null, at: -Infinity });
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
  entries.sort((a, b) => a.at - b.at);

  const alarmEntry =
    entries.find((e) => e.item.kind === 'alarm' && e.at > now && e.at - now <= ALARM_WINDOW_MS) ??
    null;
  const rest = entries.filter((e) => e !== alarmEntry);
  const strip = ({ at: _at, ...u }: Entry): Upcoming => u;

  return {
    alarm: alarmEntry ? strip(alarmEntry) : null,
    rows: rest.slice(0, limit).map(strip),
    more: Math.max(0, rest.length - limit),
  };
}
