import { createContext, useContext } from 'react';

import type { CalendarDate } from './calendar-date';

/**
 * Opens a day from anywhere on the home screen — the clock's date opens
 * today: the calendar comes in, on that day (its own page on phones and
 * tablets, the side panel on wide screens).
 */
export type DayNav = { openDay: (date: CalendarDate) => void };

export const DayNavContext = createContext<DayNav | null>(null);

/** Null outside the home screen. */
export function useDayNav(): DayNav | null {
  return useContext(DayNavContext);
}
