import { useEffect, useState } from 'react';

/**
 * How the second hand moves.
 * - sweep: continuous, redrawn at most ~30 times a second.
 * - tick:  one step per second, landing exactly on the second boundary.
 *
 * Either way the time is read from the system clock on every update, so the
 * display can't drift, and background tabs or sleep simply resume correctly.
 */
export type ClockMovement = 'sweep' | 'tick';

const SWEEP_FRAME_MS = 1000 / 30;

/**
 * @param paused Stop updating (e.g. the clock is off screen). The hands jump
 *   straight to the correct time when resumed.
 */
export function useClockTime(movement: ClockMovement, paused = false): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (paused) return;
    setNow(new Date());

    if (movement === 'tick') {
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        // A couple of ms past the boundary so getSeconds() has already rolled over.
        const delay = 1000 - (Date.now() % 1000) + 2;
        timer = setTimeout(() => {
          setNow(new Date());
          schedule();
        }, delay);
      };
      schedule();
      return () => clearTimeout(timer);
    }

    let frame = 0;
    let last = 0;
    const loop = (time: number) => {
      if (time - last >= SWEEP_FRAME_MS) {
        last = time;
        setNow(new Date());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [movement, paused]);

  return now;
}
