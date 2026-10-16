import { addDays, toISODate, type CalendarDate } from '@/features/calendar/calendar-date';
import { zoneOffsetMs, zonedParts } from '@/features/region/zoned-time';

import type { CalendarItem } from './types';

/**
 * Time arithmetic for the user's items. Pure functions: wall-clock ↔ instant
 * in a named zone, the clock-face pick, reminder instants and formatting.
 */

export type WallTime = { hours: number; minutes: number; seconds: number };

export function parseISODate(iso: string): CalendarDate {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

export function timeString({ hours, minutes, seconds }: WallTime): string {
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function parseTime(time: string): WallTime {
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return { hours, minutes, seconds };
}

/**
 * The instant at which a zone's wall clock shows this date and time.
 * Around a daylight-saving change the zone has two offsets within a day:
 * a wall time that happens twice (autumn) takes the first, and one that
 * doesn't happen (inside the spring-forward gap) lands just after the jump —
 * 2:30 becomes 3:30, as clocks do.
 */
export function wallToInstant(date: CalendarDate, time: WallTime, timeZone: string): number {
  const wallAsUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hours,
    time.minutes,
    time.seconds,
  );
  const HALF_DAY = 43_200_000;
  const candidates = [
    wallAsUtc - zoneOffsetMs(timeZone, wallAsUtc - HALF_DAY),
    wallAsUtc - zoneOffsetMs(timeZone, wallAsUtc + HALF_DAY),
  ].sort((a, b) => a - b);
  for (const instant of candidates) {
    if (instant + zoneOffsetMs(timeZone, instant) === wallAsUtc) return instant;
  }
  return candidates[1];
}

export function instantToWall(
  instant: number,
  timeZone: string,
): { date: CalendarDate; time: WallTime } {
  const p = zonedParts(new Date(instant), timeZone);
  return {
    date: { year: p.year, month: p.month, day: p.day },
    time: { hours: p.hours, minutes: p.minutes, seconds: p.seconds },
  };
}

/**
 * A point on the dial read the way the hour hand reads: the angle from 12
 * o'clock gives hours and minutes (half a degree per minute) and, if asked,
 * seconds. The dial shows 12 hours, so the result is the next time — from
 * now, in the zone — that the hour hand will point there: later today,
 * this evening, or tomorrow morning.
 *
 * `step` rounds to whole minutes (1, or 5 for a fingertip).
 */
export function timeFromDial(
  angleDegrees: number,
  now: number,
  timeZone: string,
  step = 1,
): { date: CalendarDate; time: WallTime } {
  const turn = (((angleDegrees % 360) + 360) % 360) / 360;
  const totalSeconds = Math.round(turn * 12 * 3600);
  let minutesOfDial: number;
  let seconds: number;
  if (step <= 0) {
    minutesOfDial = Math.floor(totalSeconds / 60);
    seconds = totalSeconds % 60;
  } else {
    minutesOfDial = Math.round(totalSeconds / 60 / step) * step;
    seconds = 0;
  }
  minutesOfDial %= 12 * 60;
  const hours12 = Math.floor(minutesOfDial / 60);
  const minutes = minutesOfDial % 60;

  const today = instantToWall(now, timeZone).date;
  for (let day = 0; day < 2; day++) {
    const date = addDays(today, day);
    for (const hours of [hours12, hours12 + 12]) {
      const time = { hours, minutes, seconds };
      if (wallToInstant(date, time, timeZone) > now) return { date, time };
    }
  }
  return { date: addDays(today, 1), time: { hours: hours12, minutes, seconds } };
}

/** Angle on the dial (degrees from 12, clockwise) for a point. */
export function dialAngle(x: number, y: number, centerX: number, centerY: number): number {
  const degrees = (Math.atan2(x - centerX, centerY - y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** Angle of a wall time on the hour track (12 hours a turn). */
export function hourAngle(time: WallTime): number {
  return (((time.hours % 12) * 3600 + time.minutes * 60 + time.seconds) / 43_200) * 360;
}

/** Instant and reminder for an item's fields. */
export function scheduleFor(
  date: CalendarDate,
  time: WallTime | null,
  timeZone: string,
  reminderMinutes: number | null,
): { startsAt: string | null; remindAt: string | null } {
  if (!time) {
    // Untimed items remind at 9:00 on the day, minus the lead time.
    if (reminderMinutes === null) return { startsAt: null, remindAt: null };
    const nine = wallToInstant(date, { hours: 9, minutes: 0, seconds: 0 }, timeZone);
    return { startsAt: null, remindAt: new Date(nine - reminderMinutes * 60_000).toISOString() };
  }
  const start = wallToInstant(date, time, timeZone);
  return {
    startsAt: new Date(start).toISOString(),
    remindAt:
      reminderMinutes === null ? null : new Date(start - reminderMinutes * 60_000).toISOString(),
  };
}

/**
 * Where an item sits in another zone's calendar: timed items move with
 * their instant (a 9 am call in London is an afternoon call in Delhi);
 * untimed ones keep their date.
 */
export function placeIn(
  item: CalendarItem,
  timeZone: string,
): { date: string; time: WallTime | null } {
  if (!item.startsAt || !item.time) return { date: item.date, time: null };
  if (item.timeZone === timeZone) return { date: item.date, time: parseTime(item.time) };
  const wall = instantToWall(Date.parse(item.startsAt), timeZone);
  return { date: toISODate(wall.date), time: wall.time };
}

let hour12Cache: boolean | null = null;
/** Whether the device's locale writes times with AM/PM. */
export function uses12Hour(): boolean {
  if (hour12Cache === null) {
    try {
      hour12Cache = Boolean(
        new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12,
      );
    } catch {
      hour12Cache = false;
    }
  }
  return hour12Cache;
}

/** "3:27 PM", "15:27", or with seconds "3:27:40 PM". */
export function formatWallTime(time: WallTime, withSeconds = false, hour12 = uses12Hour()): string {
  const mm = String(time.minutes).padStart(2, '0');
  const ss = withSeconds ? `:${String(time.seconds).padStart(2, '0')}` : '';
  if (!hour12) return `${String(time.hours).padStart(2, '0')}:${mm}${ss}`;
  const h = time.hours % 12 === 0 ? 12 : time.hours % 12;
  return `${h}:${mm}${ss} ${time.hours < 12 ? 'AM' : 'PM'}`;
}

/** RFC 4122 v4 id; uses the platform's generator when there is one. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) id += '-';
    else if (i === 14) id += '4';
    else if (i === 19) id += hex[(Math.random() * 4) | 8];
    else id += hex[(Math.random() * 16) | 0];
  }
  return id;
}
