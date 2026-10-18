import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AnalogClock } from '@/features/clock/components/AnalogClock';
import { DigitalClock } from '@/features/clock/components/DigitalClock';
import { dayDialTheme, nightDialTheme } from '@/features/clock/dial-palettes';
import { uses12Hour } from '@/features/events/item-time';
import { useSettings } from '@/features/settings/SettingsProvider';
import type { SidebarLayout } from '@/features/sidebar/sidebar-layout';
import { useMinute } from '@/features/sidebar/use-minute';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import {
  deviceTimeZone,
  driftAt,
  parseScreensaverQuery,
  type ScreensaverOptions,
} from './screensaver-options';

/** Behind everything until the clock fades in: what a screensaver starts from. */
const BLACK = '#000000';
/** Share of the screen's shorter side kept clear around the clock. */
const MARGIN = 0.06;
/** How far the clock wanders from the centre, as a share of the shorter side. */
const DRIFT = 0.035;
/** A new resting place every minute (every five with reduced motion). */
const DRIFT_EVERY_MS = 60_000;
const DRIFT_EVERY_REDUCED_MS = 300_000;
const DRIFT_MOVE_MS = 6_000;
const FADE_IN_MS = 900;
/** The pointer hides after this long without moving (on the website). */
const CURSOR_IDLE_MS = 2_500;
const COMPACT_SCALE = 0.62;
/** Below this (shorter side, in points) the date is left out: a preview thumbnail. */
const TINY = 320;

const dateFormats = new Map<string, { weekday: Intl.DateTimeFormat; date: Intl.DateTimeFormat }>();
function formatDate(now: Date, timeZone: string) {
  let f = dateFormats.get(timeZone);
  if (!f) {
    f = {
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone }),
      date: new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', timeZone }),
    };
    dateFormats.set(timeZone, f);
  }
  return { weekday: f.weekday.format(now), date: f.date.format(now) };
}

/**
 * The clock on its own, filling the screen: what the Windows and macOS
 * screensavers show (they load this page from the web export). No controls,
 * panels or sheets; options come from the address (see screensaver-options).
 * The clock fades in from black and drifts a little each minute so nothing
 * stays on the same pixels.
 */
export function ScreensaverPage() {
  const { settings } = useSettings();
  const scheme = useColorScheme();
  const reducedMotion = useReducedMotion();

  // The address is read after mount: the static render has no query, and the
  // first client render must match it (so both start black).
  const [options, setOptions] = useState<ScreensaverOptions | null>(null);
  useEffect(() => {
    const search = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.search : '';
    setOptions(parseScreensaverQuery(search));
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'FORM / TIME';
      document.documentElement.style.backgroundColor = BLACK;
    }
  }, []);

  const o = options ?? {};
  const face = o.face ?? settings.face;
  const appearance = o.appearance ?? settings.appearance;
  const dial = o.dial ?? settings.dial;
  const lume = o.lume ?? settings.lume;
  const movement = o.movement ?? settings.movement;
  const size = o.size ?? settings.size;
  const seconds = o.seconds ?? settings.secondHand;
  const flat = !(o.depth ?? settings.depth);
  const wantsDate = o.date ?? true;
  const timeZone = useMemo(() => o.timeZone ?? deviceTimeZone(), [o.timeZone]);

  const mode = appearance === 'system' ? (scheme === 'dark' ? 'night' : 'day') : appearance;
  const theme = useMemo(
    () => (mode === 'night' ? nightDialTheme(lume) : dayDialTheme(dial)),
    [mode, lume, dial],
  );

  const [area, setArea] = useState({ width: 0, height: 0 });
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
  };
  const shorter = Math.min(area.width, area.height);
  const ready = options !== null && shorter > 0;
  // Tiny previews (Windows' Screen Saver Settings, macOS's thumbnail): the clock alone.
  const showDate = wantsDate && shorter >= TINY;

  // Fade in once, from black.
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!ready) return;
    opacity.set(
      reducedMotion ? 1 : withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) }),
    );
  }, [ready, reducedMotion, opacity]);

  // Drift: a slow walk around the centre.
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  useEffect(() => {
    if (!ready) return;
    const reach = shorter * DRIFT;
    let step = Math.floor(Date.now() / DRIFT_EVERY_MS);
    const place = (animate: boolean) => {
      const { x, y } = driftAt(step);
      const to = (v: number) =>
        animate && !reducedMotion
          ? withTiming(v * reach, { duration: DRIFT_MOVE_MS, easing: Easing.inOut(Easing.sin) })
          : v * reach;
      dx.set(to(x));
      dy.set(to(y));
    };
    place(false);
    const timer = setInterval(
      () => {
        step += 1;
        place(true);
      },
      reducedMotion ? DRIFT_EVERY_REDUCED_MS : DRIFT_EVERY_MS,
    );
    return () => clearInterval(timer);
  }, [ready, shorter, reducedMotion, dx, dy]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }],
  }));

  // The pointer: hidden while still (the screensavers close as soon as it moves).
  const [cursorHidden, setCursorHidden] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setCursorHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      clearTimeout(timer);
    };
  }, []);

  // Layout: the clock centred, the date (if shown) on a band at the foot,
  // and an equal band at the top so the clock stays in the screen's middle.
  const margin = shorter * MARGIN;
  const dateSize = Math.round(Math.min(30, Math.max(13, shorter * 0.022)));
  const band = showDate ? dateSize * 2.2 + margin : margin;
  const dialRoom = Math.min(area.width - margin * 2, area.height - band * 2);
  const dialSize = Math.max(
    0,
    Math.floor(size === 'compact' ? dialRoom * COMPACT_SCALE : dialRoom),
  );
  const layout: SidebarLayout = {
    width: area.width,
    height: area.height,
    wide: true,
    side: 0,
    dateNumeral: 0,
    eventRows: 0,
    showDate: false,
    showEvents: false,
    main: { left: margin, right: margin, top: band, bottom: band },
    top: 0,
    bottom: 0,
  };

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: ready ? theme.page : BLACK },
        Platform.OS === 'web' && cursorHidden ? ({ cursor: 'none' } as object) : null,
      ]}
      onLayout={onLayout}
      accessibilityLabel="FORM / TIME screensaver"
    >
      {ready ? (
        <Animated.View style={[StyleSheet.absoluteFill, contentStyle]} pointerEvents="none">
          {face === 'digital' ? (
            <DigitalClock
              width={area.width}
              height={area.height}
              layout={layout}
              theme={theme}
              timeZone={timeZone}
              hour12={uses12Hour()}
              showSeconds={seconds}
              compact={size === 'compact'}
              flat={flat}
              paused={false}
            />
          ) : (
            <View style={[styles.centre, layout.main]}>
              <AnalogClock
                size={dialSize}
                theme={theme}
                movement={movement}
                showSecondHand={seconds}
                timeZone={timeZone}
                flat={flat}
              />
            </View>
          )}
          {showDate ? (
            <DateLine
              timeZone={timeZone}
              size={dateSize}
              bottom={margin}
              weekdayColor={theme.scale}
              dateColor={theme.numeral}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function DateLine({
  timeZone,
  size,
  bottom,
  weekdayColor,
  dateColor,
}: {
  timeZone: string;
  size: number;
  bottom: number;
  weekdayColor: string;
  dateColor: string;
}) {
  const now = useMinute();
  const { weekday, date } = formatDate(now, timeZone);
  return (
    <View style={[styles.dateLine, { bottom, height: size * 2.2 }]}>
      <Text
        style={[styles.weekday, { color: weekdayColor, fontSize: size * 0.72 }]}
        numberOfLines={1}
      >
        {weekday.toLocaleUpperCase()}
      </Text>
      <Text style={[styles.date, { color: dateColor, fontSize: size }]} numberOfLines={1}>
        {date}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  centre: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 14,
  },
  weekday: { fontWeight: '500', letterSpacing: 2.4 },
  date: { fontWeight: '300', letterSpacing: 0.3, opacity: 0.85 },
});
