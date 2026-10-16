import { useEffect, useState } from 'react';

import { today as currentDate, type CalendarDate } from './calendar-date';

/**
 * Today's date, kept current: re-reads the clock just after each local
 * midnight, and whenever the app regains focus on web (sleep, tab switch).
 */
export function useToday(): CalendarDate {
  const [date, setDate] = useState(() => currentDate());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setDate((previous) => {
        const next = currentDate();
        return previous.year === next.year &&
          previous.month === next.month &&
          previous.day === next.day
          ? previous
          : next;
      });
    };
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(
        () => {
          refresh();
          schedule();
        },
        midnight.getTime() - now.getTime() + 50,
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
  }, []);

  return date;
}
