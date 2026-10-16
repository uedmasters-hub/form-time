import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { usePagerGesture } from './pager-context';

type SwipePagerProps = {
  /** The page to show. Controlled: the pager reports changes, the parent sets it. */
  index: number;
  onIndexChange: (index: number) => void;
  /** A swipe has started; the result arrives later through onIndexChange. */
  onSwipeStart?: () => void;
  /** Written continuously (0 … pages − 1) so indicators can follow the finger. */
  progress: SharedValue<number>;
  /** Skip the settle animation; pages still track the finger directly. */
  reducedMotion: boolean;
  children: ReactNode;
};

/** Ease-out with a long, soft landing — fast start, gentle stop. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SETTLE_MS = 480;
const MIN_SETTLE_MS = 240;
/** Initial slope of EASE ≈ 1 / 0.22; used to carry the finger's speed into the settle. */
const EASE_INITIAL_SLOPE = 4.5;

/** Drag past this share of the width, or flick faster than this, to change page. */
const DISTANCE_THRESHOLD = 0.22;
const VELOCITY_THRESHOLD = 450; // px/s
/** Resistance when dragging past the first or last page. */
const EDGE_RESISTANCE = 0.28;

/** Horizontal travel before a drag counts as a swipe; vertical travel that cancels it. */
const ACTIVATE_X = 14;
const FAIL_Y = 12;

/** Trackpad: horizontal scroll needed to turn a page, and the quiet gap that ends a gesture. */
const WHEEL_THRESHOLD = 60;
const WHEEL_IDLE_MS = 180;

/** Leaving pages fade slightly, for depth without a visible effect. */
const OFFSCREEN_OPACITY = 0.35;

/**
 * Horizontal pager driven by swipe (touch, mouse drag), trackpad scroll and
 * the ← → keys, with a controlled index.
 *
 * It only claims clearly horizontal drags: vertical scrolling, taps and
 * presses inside a page work as usual, and a press that ends a swipe is
 * ignored (see pager-context). Inactive pages are hidden from assistive tech
 * and keyboard focus.
 */
export function SwipePager({
  index,
  onIndexChange,
  onSwipeStart,
  progress,
  reducedMotion,
  children,
}: SwipePagerProps) {
  const pages = Children.toArray(children);
  const count = pages.length;

  const [width, setWidth] = useState(0);
  const widthSv = useSharedValue(0);
  const offset = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const dragging = useSharedValue(false);
  /** Where the page is currently headed, so a re-render doesn't restart the settle. */
  const settleTarget = useSharedValue(0);
  const reducedSv = useSharedValue(reducedMotion);

  const { markSwipe } = usePagerGesture();

  const containerRef = useRef<View>(null);
  const pageRefs = useRef<(View | null)[]>([]);
  const indexRef = useRef(index);
  const lastWidth = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    reducedSv.set(reducedMotion);
  }, [reducedMotion, reducedSv]);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setWidth(nativeEvent.layout.width);
  };

  // Follow the controlled index (and keep position on resize).
  useEffect(() => {
    widthSv.set(width);
    if (width === 0 || dragging.get()) return;
    const target = -index * width;
    const resized = lastWidth.current !== width;
    lastWidth.current = width;
    if (resized || reducedMotion) {
      settleTarget.set(target);
      offset.set(target);
    } else if (settleTarget.get() !== target) {
      // (If it already matches, a swipe release is settling there — don't restart it.)
      settleTarget.set(target);
      offset.set(withTiming(target, { duration: SETTLE_MS, easing: EASE }));
    }
  }, [index, width, reducedMotion, offset, widthSv, dragging, settleTarget]);

  useAnimatedReaction(
    () => {
      const w = widthSv.get();
      return w > 0 ? -offset.get() / w : 0;
    },
    (value) => {
      progress.set(value);
    },
  );

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      if (clamped !== indexRef.current) onIndexChange(clamped);
    },
    [count, onIndexChange],
  );

  const handleSwipeStart = useCallback(() => {
    markSwipe();
    onSwipeStart?.();
  }, [markSwipe, onSwipeStart]);

  const handleSwipeEnd = useCallback(
    (target: number) => {
      markSwipe();
      onIndexChange(target);
    },
    [markSwipe, onIndexChange],
  );

  const pan = Gesture.Pan()
    .enabled(count > 1 && width > 0)
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .activeCursor('grabbing')
    .onStart(() => {
      dragging.set(true);
      // Starting mid-animation picks the page up exactly where it is.
      dragStart.set(offset.get());
      scheduleOnRN(handleSwipeStart);
    })
    .onUpdate((event) => {
      const w = widthSv.get();
      const min = -(count - 1) * w;
      let next = dragStart.get() + event.translationX;
      if (next > 0) next *= EDGE_RESISTANCE;
      else if (next < min) next = min + (next - min) * EDGE_RESISTANCE;
      offset.set(next);
    })
    .onEnd((event) => {
      const w = widthSv.get();
      const from = Math.round(-dragStart.get() / w);
      const moved = (dragStart.get() - offset.get()) / w; // + forwards, − backwards
      let target = from;
      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        target = from + (event.velocityX < 0 ? 1 : -1);
      } else if (Math.abs(moved) > DISTANCE_THRESHOLD) {
        target = from + (moved > 0 ? 1 : -1);
      }
      target = Math.max(0, Math.min(count - 1, target));

      const to = -target * w;
      settleTarget.set(to);
      if (reducedSv.get()) {
        offset.set(to);
      } else {
        const remaining = Math.abs(to - offset.get());
        const speed = Math.abs(event.velocityX);
        const duration =
          speed > 1
            ? Math.min(
                SETTLE_MS,
                Math.max(MIN_SETTLE_MS, ((EASE_INITIAL_SLOPE * remaining) / speed) * 1000),
              )
            : SETTLE_MS;
        offset.set(withTiming(to, { duration, easing: EASE }));
      }
      scheduleOnRN(handleSwipeEnd, target);
    })
    .onFinalize(() => {
      dragging.set(false);
    });

  // Trackpad two-finger swipes and Shift + mouse wheel (web).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    let accumulated = 0;
    let locked = false;
    let idle: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (event: WheelEvent) => {
      // Vertical scrolling and pinch-zoom (ctrl + wheel) pass through.
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault(); // also stops the browser's swipe-to-go-back
      clearTimeout(idle);
      idle = setTimeout(() => {
        accumulated = 0;
        locked = false;
      }, WHEEL_IDLE_MS);
      if (locked) return; // one page per gesture, however long the momentum lasts
      accumulated += event.deltaX;
      if (Math.abs(accumulated) >= WHEEL_THRESHOLD) {
        locked = true;
        goTo(indexRef.current + (accumulated > 0 ? 1 : -1));
      }
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(idle);
      node.removeEventListener('wheel', onWheel);
    };
  }, [goTo]);

  // ← → switch pages (web). Content that uses the arrows (the month grid,
  // text fields) handles them first and stops them reaching here.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      // Not inside text fields, sliders, or an open dialog (e.g. settings).
      if (
        target?.closest?.(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [aria-modal="true"]',
        )
      )
        return;
      event.preventDefault();
      goTo(indexRef.current + (event.key === 'ArrowRight' ? 1 : -1));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [goTo]);

  // Off-screen pages leave the tab order on web (inert); native uses the
  // accessibility props below.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    pageRefs.current.forEach((page, i) => {
      const node = page as unknown as HTMLElement | null;
      if (!node) return;
      if (i === index) node.removeAttribute('inert');
      else node.setAttribute('inert', '');
    });
  }, [index, width]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  return (
    <GestureDetector gesture={pan} touchAction="pan-y" userSelect="none">
      <View ref={containerRef} style={styles.viewport} onLayout={onLayout}>
        {width > 0 ? (
          <Animated.View style={[styles.track, { width: width * count }, trackStyle]}>
            {pages.map((page, i) => (
              <Page
                key={i}
                ref={(node: View | null) => {
                  pageRefs.current[i] = node;
                }}
                position={i}
                width={width}
                widthSv={widthSv}
                offset={offset}
                active={i === index}
              >
                {page}
              </Page>
            ))}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

type PageProps = {
  position: number;
  width: number;
  widthSv: SharedValue<number>;
  offset: SharedValue<number>;
  active: boolean;
  children: ReactNode;
  ref: (node: View | null) => void;
};

function Page({ position, width, widthSv, offset, active, children, ref }: PageProps) {
  const style = useAnimatedStyle(() => {
    const w = widthSv.get();
    if (w === 0) return { opacity: 1 };
    const distance = Math.abs(offset.get() + position * w) / w;
    return { opacity: interpolate(distance, [0, 1], [1, OFFSCREEN_OPACITY], 'clamp') };
  });

  return (
    <Animated.View
      ref={ref}
      style={[styles.page, { width }, style]}
      aria-hidden={!active}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    height: '100%',
  },
});
