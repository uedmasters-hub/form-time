import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import type { CalendarTheme } from '@/features/calendar/calendar-theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { refreshMessage, type RefreshOutcome } from './use-refresh-all';

/** Finger travel → pull: half, so it feels weighted. */
const RESISTANCE = 0.5;
/** Pull past this to refresh on release; the indicator rests here while it works. */
const THRESHOLD = 64;
const HOLD = 52;
const MAX_PULL = 104;
/** Travel before a touch counts as a pull (or, sideways, a swipe). */
const SLOP = 6;
const DIAL = 34;
/** The indicator stays at least this long, so a quick refresh still reads. */
const MIN_BUSY_MS = 650;
const NOTE_MS = 2200;
const NOTE_FAIL_MS = 4200;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RefreshScrollViewProps = ScrollViewProps & {
  /** Brings the data up to date and says how it went. */
  onRefresh: () => Promise<RefreshOutcome>;
  theme: CalendarTheme;
  /** Where the indicator and its note sit below the page's top (safe area, controls). */
  indicatorTop: number;
  enabled?: boolean;
  scrollRef?: Ref<ScrollView>;
  children: ReactNode;
};

/**
 * A vertical ScrollView with pull to refresh on touch screens: pulled down
 * from the top, a small dial drops in and its hand sweeps round as the pull
 * nears the point of release; let go past it and the hand turns while the
 * data refreshes, then a short note says what came of it — updated, already
 * up to date, or what went wrong. Nothing in the page moves or resets.
 *
 * Web: touches only (a mouse or trackpad scrolls as before), and the
 * browser's own pull-to-reload is held off. Native: the platform's
 * RefreshControl, with the same note.
 */
export function RefreshScrollView({
  onRefresh,
  theme,
  indicatorTop,
  enabled = true,
  scrollRef,
  style,
  children,
  ...scrollProps
}: RefreshScrollViewProps) {
  const reducedMotion = useReducedMotion();
  const pull = useSharedValue(0);
  const turn = useSharedValue(0);
  /** 1 while refreshing, for the indicator's worklets. */
  const spinning = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<RefreshOutcome | null>(null);
  const busyRef = useRef(false);
  const live = useRef(true);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote(null);
    pull.set(withTiming(HOLD, { duration: 200, easing: EASE }));
    const started = Date.now();
    let outcome: RefreshOutcome;
    try {
      outcome = await onRefresh();
    } catch {
      outcome = { kind: 'failed', message: 'Couldn’t refresh — try again' };
    }
    const wait = MIN_BUSY_MS - (Date.now() - started);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    busyRef.current = false;
    if (!live.current) return;
    pull.set(withTiming(0, { duration: 260, easing: EASE }));
    setBusy(false);
    setNote(outcome);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(
      () => setNote(null),
      outcome.kind === 'failed' ? NOTE_FAIL_MS : NOTE_MS,
    );
  }, [onRefresh, pull]);

  // The hand turns while it works (held still with reduced motion).
  useEffect(() => {
    spinning.set(busy ? 1 : 0);
    if (busy && !reducedMotion) {
      turn.set(0);
      turn.set(withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1));
    } else {
      cancelAnimation(turn);
      turn.set(0);
    }
  }, [busy, reducedMotion, turn, spinning]);

  // Web: follow touches on the scroll element itself.
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const scroller = ownRef.current as unknown as {
      getScrollableNode?: () => HTMLElement;
    } | null;
    const node = scroller?.getScrollableNode?.();
    if (!node?.addEventListener) return;

    let start: { x: number; y: number } | null = null;
    let mode: 'maybe' | 'pull' | 'off' = 'off';
    let armed = false;

    // Only from the very top: of this page, and of any list inside it.
    const atTop = (target: EventTarget | null) => {
      for (let el = target as HTMLElement | null; el && el !== node; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
      }
      return node.scrollTop <= 0;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || busyRef.current || !enabledRef.current || !atTop(e.target)) {
        mode = 'off';
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      mode = 'maybe';
      armed = false;
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'off' || !start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (mode === 'maybe') {
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
          mode = 'off'; // a sideways swipe: the pager's
          return;
        }
        if (dy < -SLOP) {
          mode = 'off'; // scrolling down the page
          return;
        }
        if (dy > SLOP && node.scrollTop <= 0) mode = 'pull';
        else return;
      }
      // Pulling: the page doesn't scroll or bounce, and the browser doesn't reload.
      if (e.cancelable) e.preventDefault();
      const next = Math.min(MAX_PULL, Math.max(0, (dy - SLOP) * RESISTANCE));
      pull.set(next);
      if (!armed && next >= THRESHOLD) {
        armed = true;
        (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(8);
      } else if (armed && next < THRESHOLD) {
        armed = false;
      }
    };
    const onEnd = () => {
      if (mode === 'pull') {
        if (pull.get() >= THRESHOLD) void runRef.current();
        else pull.set(withTiming(0, { duration: 220, easing: EASE }));
      }
      mode = 'off';
      start = null;
    };

    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', onEnd);
    node.addEventListener('touchcancel', onEnd);
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
  }, [pull]);

  const setRefs = (value: ScrollView | null) => {
    ownRef.current = value;
    if (typeof scrollRef === 'function') scrollRef(value);
    else if (scrollRef) (scrollRef as { current: ScrollView | null }).current = value;
  };

  return (
    <View style={styles.fill}>
      <ScrollView
        ref={setRefs}
        style={[style, Platform.OS === 'web' ? webContain : null]}
        refreshControl={
          Platform.OS === 'web' ? undefined : (
            <RefreshControl
              refreshing={busy}
              onRefresh={() => void run()}
              enabled={enabled}
              tintColor={theme.accent}
              colors={[theme.accent]}
              progressBackgroundColor={theme.surface}
              progressViewOffset={indicatorTop}
            />
          )
        }
        {...scrollProps}
      >
        {children}
      </ScrollView>
      {Platform.OS === 'web' ? (
        <PullDial
          pull={pull}
          turn={turn}
          spinning={spinning}
          busy={busy}
          theme={theme}
          top={indicatorTop}
        />
      ) : null}
      <RefreshNote outcome={note} theme={theme} top={indicatorTop} />
    </View>
  );
}

/** Web: the page keeps its scroll to itself, so a pull never reloads the browser. */
const webContain = { overscrollBehaviorY: 'contain' } as unknown as ViewStyle;

/**
 * A small dial on a raised disc. Pulled, it drops in and its hand sweeps
 * towards twelve; at twelve, a release refreshes. Refreshing, the hand turns.
 */
function PullDial({
  pull,
  turn,
  spinning,
  busy,
  theme,
  top,
}: {
  pull: SharedValue<number>;
  turn: SharedValue<number>;
  spinning: SharedValue<number>;
  busy: boolean;
  theme: CalendarTheme;
  top: number;
}) {
  const r = DIAL / 2 - 7;
  const c = DIAL / 2;
  const length = 2 * Math.PI * r;

  const box = useAnimatedStyle(() => {
    const p = pull.get();
    return {
      opacity: interpolate(p, [0, 24, THRESHOLD], [0, 0.7, 1], 'clamp'),
      transform: [
        { translateY: p - DIAL },
        { scale: interpolate(p, [0, THRESHOLD], [0.7, 1], 'clamp') },
      ],
    };
  });
  // The ring fills clockwise from twelve as the pull nears release.
  const ring = useAnimatedProps(() => {
    const share = Math.min(1, pull.get() / THRESHOLD);
    return { strokeDashoffset: length * (1 - share) };
  });
  const hand = useAnimatedStyle(() => {
    const share = Math.min(1, pull.get() / THRESHOLD);
    return {
      transform: [{ rotate: `${spinning.get() ? turn.get() : share * 360}deg` }],
    };
  });
  const armedTip = useAnimatedProps(() => ({
    opacity: pull.get() >= THRESHOLD || spinning.get() ? 1 : 0,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!busy}
      importantForAccessibility={busy ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={busy ? 'Refreshing' : undefined}
      accessibilityRole={busy ? 'progressbar' : undefined}
      style={[
        styles.dial,
        theme.flat ? styles.dialFlat : styles.dialRaised,
        { top, backgroundColor: theme.surface, borderColor: theme.hairline },
        box,
      ]}
    >
      <Svg width={DIAL} height={DIAL} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.hairline} strokeWidth={1.5} />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={theme.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          transform={`rotate(-90 ${c} ${c})`}
          animatedProps={ring}
        />
        <AnimatedCircle cx={c} cy={c - r} r={1.6} fill={theme.accent} animatedProps={armedTip} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, hand]}>
        <Svg width={DIAL} height={DIAL}>
          <Line
            x1={c}
            y1={c + 2}
            x2={c}
            y2={c - r + 3}
            stroke={theme.ink}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Circle cx={c} cy={c} r={1.8} fill={theme.ink} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** What came of a refresh, in a quiet pill that fades away by itself. */
function RefreshNote({
  outcome,
  theme,
  top,
}: {
  outcome: RefreshOutcome | null;
  theme: CalendarTheme;
  top: number;
}) {
  const shown = useSharedValue(0);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (outcome) {
      setText(refreshMessage(outcome));
      setFailed(outcome.kind === 'failed');
      shown.set(withTiming(1, { duration: 220, easing: EASE }));
    } else {
      shown.set(withTiming(0, { duration: 420, easing: EASE }));
    }
  }, [outcome, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: interpolate(shown.get(), [0, 1], [-6, 0]) }],
  }));

  return (
    <View pointerEvents="none" style={[styles.noteRow, { top: top + 8 }]}>
      <Animated.View
        style={[
          styles.note,
          theme.flat ? styles.dialFlat : styles.dialRaised,
          { backgroundColor: theme.surface, borderColor: theme.hairline },
          style,
        ]}
      >
        <Text
          role="status"
          aria-live="polite"
          style={[styles.noteText, { color: failed ? theme.ink : theme.muted }]}
        >
          {failed ? <Text style={{ color: theme.accent }}>{'●  '}</Text> : null}
          {outcome ? text : ''}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dial: {
    position: 'absolute',
    alignSelf: 'center',
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
  },
  dialFlat: { borderWidth: 1 },
  dialRaised: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  noteRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  note: {
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
