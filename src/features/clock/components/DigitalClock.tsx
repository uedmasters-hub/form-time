import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Svg from 'react-native-svg';

import type { DialTheme } from '../dial-theme';
import { GLYPH_HEIGHT, layoutNumeral } from '../numerals';
import { useClockTime } from '../use-clock-time';
import { Numeral } from './Numeral';
import { TimeNumerals, timeNumeralsWidth, type WallTimeParts } from './TimeNumerals';

type DigitalClockProps = {
  /** The page area to lay out in. */
  width: number;
  height: number;
  theme: DialTheme;
  timeZone: string;
  hour12: boolean;
  showSeconds: boolean;
  compact: boolean;
  /** "Shadows & glow" off: no halo on night dials. */
  flat: boolean;
  /** Stop updating while the page is off screen. */
  paused: boolean;
  /** Pressing the time (e.g. to add something). */
  onPressTime?: () => void;
  /** What sits beside (wide) or below (narrow) the time. */
  aside?: (now: Date, layout: { wide: boolean; short: boolean }) => ReactNode;
};

/** Widest case, so the time never changes size as the digits change. */
const WIDEST: WallTimeParts = { hours: 0, minutes: 0, seconds: 0 };
/** Wide layouts: the time and a column beside it. */
const WIDE_MIN_WIDTH = 720;
const GAP = 48;
const PADDING = 24;

function wallTime(now: Date, timeZone: string): WallTimeParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hours: get('hour'), minutes: get('minute'), seconds: get('second') };
}

/**
 * The digital face: the time in the dial's monoline numerals, seconds and
 * AM/PM set small beside the minutes, and what's coming up in a quiet
 * column — beside the time on wide screens, below it on phones. The time
 * always leads; everything else is a step down in size and colour.
 */
export function DigitalClock({
  width,
  height,
  theme,
  timeZone,
  hour12,
  showSeconds,
  compact,
  flat,
  paused,
  onPressTime,
  aside,
}: DigitalClockProps) {
  const now = useClockTime('quartz', paused);
  const time = wallTime(now, timeZone);
  const wide = width >= WIDE_MIN_WIDTH && width >= height * 1.15;
  const asideWidth = wide ? Math.min(360, Math.max(260, width * 0.28)) : Math.min(380, width - 40);

  // Size the numerals to the space: wide, the time takes what the column
  // leaves; narrow, the width, up to a share of the height.
  const room = wide ? width - asideWidth - GAP * 2 - PADDING * 2 : width - PADDING * 2;
  const perUnit = timeNumeralsWidth(WIDEST, 100, { padHour: true }) / 100;
  const sideRoom = 0.42; // seconds / AM-PM column, as a share of the numeral height
  let numeral = room / (perUnit + sideRoom);
  numeral = Math.min(numeral, height * (wide ? 0.42 : 0.24), 340);
  if (compact) numeral *= 0.68;
  numeral = Math.floor(numeral);
  const small = Math.round(numeral * 0.26);

  const glow =
    !flat && theme.mode === 'night' && theme.numeralGlow > 0
      ? { color: theme.lumeGlow, opacity: Math.min(0.6, theme.numeralGlow * 1.4) }
      : undefined;

  // Redrawn once a minute, not every second.
  const { hours, minutes } = time;
  const main = useMemo(
    () => (
      <TimeNumerals
        time={{ hours, minutes, seconds: 0 }}
        hour12={hour12}
        withSeconds={false}
        padHour
        height={numeral}
        color={theme.numeral}
        glow={glow}
        idPrefix="ft-digital"
      />
    ),
    [hours, minutes, hour12, numeral, theme.numeral, glow?.color, glow?.opacity],
  );

  const spoken = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12,
    timeZone,
  }).format(now);

  const face = (
    <View style={styles.timeRow}>
      {main}
      <View style={[styles.side, { height: numeral, marginLeft: numeral * 0.08 }]}>
        {hour12 ? (
          <Text
            style={[styles.meridiem, { color: theme.scale, fontSize: Math.max(11, small * 0.55) }]}
          >
            {time.hours >= 12 ? 'PM' : 'AM'}
          </Text>
        ) : (
          <View />
        )}
        {showSeconds ? (
          <Digits text={String(time.seconds).padStart(2, '0')} height={small} color={theme.scale} />
        ) : null}
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.page,
        wide ? styles.wide : styles.narrow,
        { paddingHorizontal: PADDING, gap: wide ? GAP : Math.max(24, numeral * 0.25) },
      ]}
    >
      {onPressTime ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${spoken}. Add something`}
          accessibilityHint="Starts something new at the next five minutes"
          onPress={onPressTime}
          style={({ hovered }) => [styles.timeTarget, hovered && { opacity: 0.85 }]}
        >
          {face}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={spoken} style={styles.timeTarget}>
          {face}
        </View>
      )}
      {aside ? (
        <View
          style={[
            styles.aside,
            { width: asideWidth, borderColor: theme.dialRim },
            wide ? styles.asideWide : styles.asideNarrow,
          ]}
        >
          {aside(now, { wide, short: height < 420 })}
        </View>
      ) : null}
    </View>
  );
}

/** Two small digits in the dial's numerals (the seconds). */
function Digits({ text, height, color }: { text: string; height: number; color: string }) {
  const stroke = Math.max(1.6, height * 0.11);
  const width = (layoutNumeral(text).width / GLYPH_HEIGHT) * height + stroke * 2;
  return (
    <View aria-hidden>
      <Svg width={width} height={height + stroke * 2}>
        <Numeral
          text={text}
          x={width / 2}
          y={height / 2 + stroke}
          height={height}
          strokeWidth={stroke}
          color={color}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wide: { flexDirection: 'row' },
  narrow: { flexDirection: 'column' },
  timeTarget: { alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  side: { justifyContent: 'space-between', paddingVertical: 4 },
  meridiem: { fontWeight: '600', letterSpacing: 1.6 },
  aside: {},
  // A hairline between the time and what's coming up.
  asideWide: { borderLeftWidth: 1, paddingLeft: 32, alignSelf: 'center' },
  asideNarrow: { borderTopWidth: 1, paddingTop: 20 },
});
