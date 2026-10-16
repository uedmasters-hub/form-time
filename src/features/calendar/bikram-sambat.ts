import { addDays, compareDates, type CalendarDate } from './calendar-date';

/**
 * Bikram Sambat (B.S.), Nepal's official calendar.
 *
 * Its month lengths come from the panchang each year and can't be calculated
 * with a simple rule, so they are listed here, one row per year. A month
 * runs from 29 to 32 days, and every year starts on 1 Baisakh, in mid-April.
 *
 * Coverage is B.S. 2070–2084 (14 Apr 2013 – 12 Apr 2028). 2082–2084 were
 * checked month by month against Hamro Patro, and 2070–2083 match both the
 * nepali-date-converter and bikram-sambat tables. Later years aren't
 * published yet, so they aren't guessed: outside the range, conversions
 * return null.
 */
export type BSDate = {
  year: number;
  /** 1 = Baisakh … 12 = Chaitra */
  month: number;
  day: number;
};

export const BS_FIRST_YEAR = 2070;

const MONTH_LENGTHS: readonly (readonly number[])[] = [
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2070
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2071
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2072
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2073
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2074
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2075
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2076
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2077
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2078
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2079
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2081
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2082
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2083
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2084
];

export const BS_LAST_YEAR = BS_FIRST_YEAR + MONTH_LENGTHS.length - 1;

/** 1 Baisakh 2070. */
const EPOCH: CalendarDate = { year: 2013, month: 4, day: 14 };

export const BS_MONTH_NAMES = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Asoj',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

/** Month names in Nepali, as Hamro Patro writes them. */
export const BS_MONTH_NAMES_NE = [
  'वैशाख',
  'जेठ',
  'असार',
  'साउन',
  'भदौ',
  'असोज',
  'कार्तिक',
  'मंसिर',
  'पुष',
  'माघ',
  'फागुन',
  'चैत',
] as const;

export function isSupportedBSYear(year: number): boolean {
  return year >= BS_FIRST_YEAR && year <= BS_LAST_YEAR;
}

/** Days in a B.S. month, or null outside the published range. */
export function bsMonthLength(year: number, month: number): number | null {
  if (!isSupportedBSYear(year) || month < 1 || month > 12) return null;
  return MONTH_LENGTHS[year - BS_FIRST_YEAR][month - 1];
}

// Days from the epoch to the first day of each year and month, built once.
const MONTH_START: number[] = [];
let total = 0;
for (const year of MONTH_LENGTHS) {
  for (const length of year) {
    MONTH_START.push(total);
    total += length;
  }
}
const TOTAL_DAYS = total;
const DAY_MS = 86_400_000;

function daysFromEpoch(date: CalendarDate): number {
  return Math.round(compareDates(date, EPOCH) / DAY_MS);
}

/** The B.S. date for a Gregorian date, or null outside 2070–2084 B.S. */
export function toBS(date: CalendarDate): BSDate | null {
  const offset = daysFromEpoch(date);
  if (offset < 0 || offset >= TOTAL_DAYS) return null;
  // Binary search for the month containing the offset.
  let lo = 0;
  let hi = MONTH_START.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (MONTH_START[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return {
    year: BS_FIRST_YEAR + Math.floor(lo / 12),
    month: (lo % 12) + 1,
    day: offset - MONTH_START[lo] + 1,
  };
}

/** The Gregorian date for a B.S. date, or null if it doesn't exist or isn't covered. */
export function fromBS({ year, month, day }: BSDate): CalendarDate | null {
  const length = bsMonthLength(year, month);
  if (length === null || day < 1 || day > length) return null;
  return addDays(EPOCH, MONTH_START[(year - BS_FIRST_YEAR) * 12 + month - 1] + day - 1);
}
