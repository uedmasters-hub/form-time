import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

/**
 * Lets controls inside a page ignore the press that ends a swipe.
 *
 * A horizontal drag that starts on a day cell must move the pages, not select
 * that day when the pointer is released. The pager records when a swipe was
 * last active; `useSwipeAwarePress` drops presses that land within that window.
 */
type PagerGestureState = {
  markSwipe: () => void;
  wasSwiping: () => boolean;
};

/** A press released this soon after a swipe belongs to the swipe. */
const SWIPE_PRESS_WINDOW_MS = 250;

const PagerGestureContext = createContext<PagerGestureState>({
  markSwipe: () => {},
  wasSwiping: () => false,
});

export function PagerGestureProvider({ children }: { children: ReactNode }) {
  const lastSwipeAt = useRef(-Infinity);

  const value = useMemo<PagerGestureState>(
    () => ({
      markSwipe: () => {
        lastSwipeAt.current = Date.now();
      },
      wasSwiping: () => Date.now() - lastSwipeAt.current < SWIPE_PRESS_WINDOW_MS,
    }),
    [],
  );

  return <PagerGestureContext.Provider value={value}>{children}</PagerGestureContext.Provider>;
}

export function usePagerGesture(): PagerGestureState {
  return useContext(PagerGestureContext);
}

/** Wraps a press handler so it's skipped when the press was really a swipe. */
export function useSwipeAwarePress<Args extends unknown[]>(
  handler: (...args: Args) => void,
): (...args: Args) => void {
  const { wasSwiping } = usePagerGesture();
  return useCallback(
    (...args: Args) => {
      if (!wasSwiping()) handler(...args);
    },
    [handler, wasSwiping],
  );
}
