import { useEffect, useState } from 'react';

/**
 * The current time, refreshed at each minute boundary — enough for the side
 * panel's date and "in 5 min" labels, without redrawing every second.
 * Paused, it stops; resumed, it catches up at once.
 */
export function useMinute(paused = false): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (paused) return;
    setNow(new Date());
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [paused]);

  return now;
}
