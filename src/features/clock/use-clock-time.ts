import { useEffect, useState } from 'react';

/**
 * How the second hand moves — the three classic watch movements.
 * - quartz:     one step a second, landing exactly on the second.
 * - mechanical: eight beats a second (28,800 vph), the fine stepped sweep of
 *               a mechanical watch.
 * - smooth:     continuous, redrawn every frame.
 *
 * Whatever the movement, the time is read from the system clock on every
 * update, so the display can't drift, and sleep or background tabs simply
 * resume at the right time.
 */
export type ClockMovement = 'quartz' | 'mechanical' | 'smooth';

/** Seconds per visible step of the second hand (0 = continuous). */
export const SECOND_STEP: Record<ClockMovement, number> = {
  quartz: 1,
  mechanical: 1 / 8,
  smooth: 0,
};

/**
 * @param paused Stop updating (e.g. the clock is off screen). The hands jump
 *   straight to the correct time when resumed.
 */
export function useClockTime(movement: ClockMovement, paused = false): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (paused) return;
    setNow(new Date());

    const stepMs = SECOND_STEP[movement] * 1000;

    if (stepMs > 0) {
      // Wake exactly on each step boundary (a couple of ms past it, so the
      // clock has already rolled over) instead of polling.
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        const delay = stepMs - (Date.now() % stepMs) + 2;
        timer = setTimeout(() => {
          setNow(new Date());
          schedule();
        }, delay);
      };
      schedule();
      return () => clearTimeout(timer);
    }

    let frame = 0;
    const loop = () => {
      setNow(new Date());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [movement, paused]);

  return now;
}
