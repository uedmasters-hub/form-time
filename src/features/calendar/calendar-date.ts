import { zonedParts } from '@/features/region/zoned-time';

/**
 * Calendar dates without time zones.
 *
 * A CalendarDate is a day on the wall calendar ("16 October 2026"), not an
 * instant. All arithmetic runs on UTC midnights, so daylight-saving shifts
 * and the device's offset can never move a date to the day before or after.
 * Pure functions only — safe to unit-test.
 */
export type CalendarDate = {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
};

/** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_MS = 86_400_000;

function toUtcMs({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): CalendarDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Today's date in the given IANA time zone, or the device's. */
export function today(now: Date = new Date(), timeZone?: string): CalendarDate {
  if (timeZone) {
    const p = zonedParts(now, timeZone);
    return { year: p.year, month: p.month, day: p.day };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Adds months, clamping the day: 31 Jan + 1 month = 28/29 Feb. */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const index = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function weekday(date: CalendarDate): Weekday {
  return new Date(toUtcMs(date)).getUTCDay() as Weekday;
}

export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isSameMonth(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Negative if a is before b, 0 if the same day, positive if after. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return toUtcMs(a) - toUtcMs(b);
}

/** Stable key, e.g. "2026-10-16". */
export function toISODate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** First day of the week the date falls in, for a given week start. */
export function startOfWeek(date: CalendarDate, weekStart: Weekday): CalendarDate {
  const offset = (weekday(date) - weekStart + 7) % 7;
  return addDays(date, -offset);
}

/**
 * The 42 days (6 full weeks) shown for a month, starting on `weekStart`.
 * Always six rows, so the grid never changes height between months.
 */
export function monthGrid(year: number, month: number, weekStart: Weekday): CalendarDate[] {
  const first = startOfWeek({ year, month, day: 1 }, weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** Weekdays in display order for a given week start. */
export function weekdayOrder(weekStart: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => ((weekStart + i) % 7) as Weekday);
}

/**
 * The locale's first day of the week where the platform reports it
 * (Intl.Locale#getWeekInfo); otherwise Sunday.
 */
export function defaultWeekStart(locale?: string): Weekday {
  try {
    const LocaleCtor = (Intl as { Locale?: new (tag: string) => unknown }).Locale;
    if (!LocaleCtor) return 0;
    const tag = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
    const info = new LocaleCtor(tag) as {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    // Intl uses 1 = Monday … 7 = Sunday.
    return firstDay ? ((firstDay % 7) as Weekday) : 0;
  } catch {
    return 0;
  }
}

// ── Formatting (locale-aware, never shifted by the device time zone) ──────

function utcFormatter(options: Intl.DateTimeFormatOptions, locale?: string) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
}

export function formatDate(
  date: CalendarDate,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  return utcFormatter(options, locale).format(new Date(toUtcMs(date)));
}

/** Weekday names in display order, e.g. narrow: S M T W T F S. */
export function weekdayNames(
  weekStart: Weekday,
  style: 'narrow' | 'short' | 'long',
  locale?: string,
): string[] {
  const formatter = utcFormatter({ weekday: style }, locale);
  // 4 Jan 1970 was a Sunday.
  return weekdayOrder(weekStart).map((wd) => formatter.format(new Date(Date.UTC(1970, 0, 4 + wd))));
}
