import { useEffect, useState } from 'react';

import { today as currentDate, type CalendarDate } from './calendar-date';

/**
 * Today's date in the given time zone (or the device's), kept current:
 * re-checked at every minute boundary — so midnight in any zone is caught
 * within a minute — and whenever the page becomes visible again.
 */
export function useToday(timeZone?: string): CalendarDate {
  const [date, setDate] = useState(() => currentDate(new Date(), timeZone));

  useEffect(() => {
    const refresh = () => {
      setDate((previous) => {
        const next = currentDate(new Date(), timeZone);
        return previous.year === next.year &&
          previous.month === next.month &&
          previous.day === next.day
          ? previous
          : next;
      });
    };
    refresh();

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          refresh();
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    schedule();

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [timeZone]);

  return date;
}
