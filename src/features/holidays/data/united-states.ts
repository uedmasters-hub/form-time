import { addDays, toISODate, weekday, type CalendarDate } from '@/features/calendar/calendar-date';

import type { Holiday, HolidaySource } from '../types';

/**
 * United States — federal holidays (5 U.S.C. 6103), computed from the
 * statutory rules for any year. When a holiday falls on a Saturday it is
 * observed the Friday before; on a Sunday, the Monday after (OPM).
 */
export const US_SOURCES: HolidaySource[] = [
  {
    label: 'U.S. Office of Personnel Management — Federal Holidays',
    url: 'https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/',
    covers: 'Federal holidays and weekend observance rules',
  },
];

/** The nth (1-based) given weekday of a month; n = -1 for the last. */
function nthWeekday(year: number, month: number, wd: number, n: number): CalendarDate {
  if (n > 0) {
    const first = { year, month, day: 1 };
    const offset = (wd - weekday(first) + 7) % 7;
    return addDays(first, offset + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = { year, month, day: lastDay };
  return addDays(last, -((weekday(last) - wd + 7) % 7));
}

function withObservance(date: CalendarDate, name: string): Holiday[] {
  const wd = weekday(date);
  const holiday: Holiday = { start: toISODate(date), name, kind: 'public' };
  if (wd === 6) {
    return [
      { ...holiday, note: 'Observed on Friday' },
      { start: toISODate(addDays(date, -1)), name: `${name} (observed)`, kind: 'public' },
    ];
  }
  if (wd === 0) {
    return [
      { ...holiday, note: 'Observed on Monday' },
      { start: toISODate(addDays(date, 1)), name: `${name} (observed)`, kind: 'public' },
    ];
  }
  return [holiday];
}

const MON = 1;
const THU = 4;

export function usFederalHolidays(year: number): Holiday[] {
  const fixed = (month: number, day: number, name: string) =>
    withObservance({ year, month, day }, name);
  const nth = (month: number, wd: number, n: number, name: string): Holiday => ({
    start: toISODate(nthWeekday(year, month, wd, n)),
    name,
    kind: 'public',
  });

  return [
    ...fixed(1, 1, "New Year's Day"),
    nth(1, MON, 3, 'Birthday of Martin Luther King, Jr.'),
    nth(2, MON, 3, "Washington's Birthday (Presidents' Day)"),
    nth(5, MON, -1, 'Memorial Day'),
    ...fixed(6, 19, 'Juneteenth National Independence Day'),
    ...fixed(7, 4, 'Independence Day'),
    nth(9, MON, 1, 'Labor Day'),
    nth(10, MON, 2, 'Columbus Day'),
    ...fixed(11, 11, 'Veterans Day'),
    nth(11, THU, 4, 'Thanksgiving Day'),
    ...fixed(12, 25, 'Christmas Day'),
  ];
}
