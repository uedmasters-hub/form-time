/**
 * Holidays, festivals and observances from official sources. They are
 * read-only reference data, kept separate from the user's own events.
 */
export type HolidayKind =
  /** Offices closed nationwide (gazetted / federal / national public holiday). */
  | 'public'
  /** Optional or partial: restricted holidays, or holidays for some groups or regions. */
  | 'restricted'
  /** Cultural or religious festivals that aren't (all) office holidays. */
  | 'festival';

export type Holiday = {
  /** ISO date, e.g. "2026-10-11". */
  start: string;
  /** Last day (inclusive) for multi-day festivals. */
  end?: string;
  name: string;
  kind: HolidayKind;
  /** Who it applies to, or a caveat about the date. */
  note?: string;
};

export type HolidaySource = {
  label: string;
  url: string;
  /** What the source covers, e.g. "Gazetted & restricted holidays 2026–2027". */
  covers: string;
};

/** A holiday as it appears on one specific day. */
export type DayHoliday = Holiday & {
  /** For multi-day holidays: [day number, total days]. */
  dayOf?: [number, number];
};
