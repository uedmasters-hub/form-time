import { BS_MONTH_NAMES, BS_MONTH_NAMES_NE, bsMonthLength, fromBS, toBS } from './bikram-sambat';
import {
  addMonths as addGregorianMonths,
  daysInMonth,
  formatDate,
  type CalendarDate,
} from './calendar-date';

/**
 * The calendar the month grid is laid out in. Days are always Gregorian
 * CalendarDates underneath (holidays, "today" and selection stay the same);
 * a system decides which days form a month and how they're numbered and
 * named.
 */
export type CalendarSystemId = 'gregorian' | 'bikram-sambat';

/** A month in a system's own numbering, e.g. Asoj 2083 = { 2083, 6 }. */
export type MonthRef = { year: number; month: number };

export type CalendarSystem = {
  id: CalendarSystemId;
  /** The month containing a date, or null if the system doesn't cover it. */
  monthOf: (date: CalendarDate) => MonthRef | null;
  /** The date's day number in its month (1 Asoj, …), or null if not covered. */
  dayOf: (date: CalendarDate) => number | null;
  firstDay: (month: MonthRef) => CalendarDate;
  length: (month: MonthRef) => number;
  /** Months later (or earlier); null past the covered range. */
  shiftMonth: (month: MonthRef, months: number) => MonthRef | null;
  /** Same day number, months later (clamped to the month's length); null past the range. */
  shiftDate: (date: CalendarDate, months: number) => CalendarDate | null;
  monthName: (month: MonthRef) => string;
  /** "October 2026" or "Asoj 2083". */
  monthLabel: (month: MonthRef) => string;
  /** "Friday, 16 October 2026" or "Friday, 30 Asoj 2083". */
  longDate: (date: CalendarDate) => string;
  /** The other calendar's name for the month, e.g. "असोज · Sep – Oct 2026". */
  secondaryMonthLabel?: (month: MonthRef) => string;
  /** The Gregorian date beside a B.S. one, e.g. "16 October 2026". */
  secondaryDate?: (date: CalendarDate) => string;
};

export const sameMonth = (a: MonthRef | null, b: MonthRef | null) =>
  a !== null && b !== null && a.year === b.year && a.month === b.month;

const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: 'long' };

export const gregorian: CalendarSystem = {
  id: 'gregorian',
  monthOf: (date) => ({ year: date.year, month: date.month }),
  dayOf: (date) => date.day,
  firstDay: (m) => ({ ...m, day: 1 }),
  length: (m) => daysInMonth(m.year, m.month),
  shiftMonth: (m, months) => {
    const next = addGregorianMonths({ ...m, day: 1 }, months);
    return { year: next.year, month: next.month };
  },
  shiftDate: (date, months) => addGregorianMonths(date, months),
  monthName: (m) => formatDate({ ...m, day: 1 }, { month: 'long' }),
  monthLabel: (m) => formatDate({ ...m, day: 1 }, { month: 'long', year: 'numeric' }),
  longDate: (date) =>
    formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
};

function bsShift(m: MonthRef, months: number): MonthRef | null {
  const index = m.year * 12 + (m.month - 1) + months;
  const next = { year: Math.floor(index / 12), month: (index % 12) + 1 };
  return bsMonthLength(next.year, next.month) === null ? null : next;
}

/** "October 2026", "Sep – Oct 2026" or "Dec 2026 – Jan 2027". */
function gregorianSpan(first: CalendarDate, last: CalendarDate): string {
  if (first.year === last.year && first.month === last.month) {
    return formatDate(first, { month: 'long', year: 'numeric' });
  }
  if (first.year === last.year) {
    return `${formatDate(first, { month: 'short' })} – ${formatDate(last, {
      month: 'short',
      year: 'numeric',
    })}`;
  }
  return `${formatDate(first, { month: 'short', year: 'numeric' })} – ${formatDate(last, {
    month: 'short',
    year: 'numeric',
  })}`;
}

export const bikramSambat: CalendarSystem = {
  id: 'bikram-sambat',
  monthOf: (date) => {
    const bs = toBS(date);
    return bs ? { year: bs.year, month: bs.month } : null;
  },
  dayOf: (date) => toBS(date)?.day ?? null,
  firstDay: (m) => fromBS({ ...m, day: 1 }) as CalendarDate,
  length: (m) => bsMonthLength(m.year, m.month) ?? 30,
  shiftMonth: bsShift,
  shiftDate: (date, months) => {
    const bs = toBS(date);
    if (!bs) return null;
    const next = bsShift(bs, months);
    if (!next) return null;
    const length = bsMonthLength(next.year, next.month) as number;
    return fromBS({ ...next, day: Math.min(bs.day, length) });
  },
  monthName: (m) => BS_MONTH_NAMES[m.month - 1],
  monthLabel: (m) => `${BS_MONTH_NAMES[m.month - 1]} ${m.year}`,
  longDate: (date) => {
    const bs = toBS(date);
    if (!bs) return gregorian.longDate(date);
    return `${formatDate(date, WEEKDAY)}, ${bs.day} ${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
  },
  secondaryMonthLabel: (m) => {
    const first = fromBS({ ...m, day: 1 }) as CalendarDate;
    const last = fromBS({ ...m, day: bsMonthLength(m.year, m.month) as number }) as CalendarDate;
    return `${BS_MONTH_NAMES_NE[m.month - 1]} · ${gregorianSpan(first, last)}`;
  },
  secondaryDate: (date) => formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' }),
};

export type CalendarChoice = 'bs' | 'ad';

/**
 * The calendar for a region: Nepal uses Bikram Sambat unless the user picks
 * the Gregorian calendar, and while today is inside the published B.S. range.
 */
export function calendarSystemFor(
  region: string,
  choice: CalendarChoice,
  today: CalendarDate,
): CalendarSystem {
  if (region === 'NP' && choice === 'bs' && bikramSambat.monthOf(today)) return bikramSambat;
  return gregorian;
}
