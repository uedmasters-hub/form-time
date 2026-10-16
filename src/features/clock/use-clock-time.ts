import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

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

export function useClockTime(movement: ClockMovement): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
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
  }, [movement]);

  return now;
}

/** System "reduce motion" preference, kept live. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Unsupported platform: keep the default (motion allowed).
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
