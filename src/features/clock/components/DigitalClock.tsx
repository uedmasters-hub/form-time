import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import type { SidebarLayout } from '@/features/sidebar/sidebar-layout';

import type { DialTheme } from '../dial-theme';
import { GLYPH_HEIGHT, layoutNumeral } from '../numerals';
import { useClockTime } from '../use-clock-time';
import { Numeral } from './Numeral';
import { TimeNumerals, timeNumeralsWidth, type WallTimeParts } from './TimeNumerals';

type DigitalClockProps = {
  /** The whole page area. */
  width: number;
  height: number;
  /** The side panel's place; the time takes the space it leaves (`main`). */
  layout: SidebarLayout;
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
  /** The time's width as laid out, so the side panel can keep clear of it. */
  onTimeWidth?: (width: number) => void;
};

const ZERO: WallTimeParts = { hours: 0, minutes: 0, seconds: 0 };

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
 * The digital face. Built so nothing moves: the time sits centred in an
 * area of its own, with equal-width digits and a fixed-width seconds
 * column, so it keeps one size and one place as the seconds, minutes and
 * the list change. The side panel (drawn by the page) has space of its own.
 */
export function DigitalClock({
  width,
  height,
  layout,
  theme,
  timeZone,
  hour12,
  showSeconds,
  compact,
  flat,
  paused,
  onPressTime,
  onTimeWidth,
}: DigitalClockProps) {
  const now = useClockTime('quartz', paused);
  const time = wallTime(now, timeZone);
  const wide = layout.wide;
  // The time's own area: beside the panel (wide) or between its halves (narrow).
  const area = layout.main;
  const areaWidth = width - area.left - area.right;
  const areaHeight = height - area.top - area.bottom;

  // Size from the widest possible time, so it never changes with the digits.
  const perUnit = timeNumeralsWidth(ZERO, 100, { padHour: true, tabular: true }) / 100;
  const SIDE_SHARE = 0.46; // the seconds / AM-PM column, as a share of the numeral height
  // Wide: the time keeps clear of its area's sides, so it never runs edge to edge.
  const fill = wide ? 0.9 : 1;
  let numeral = Math.min(
    (areaWidth * fill) / (perUnit + SIDE_SHARE),
    areaHeight * (wide ? 0.55 : 0.8),
    340,
  );
  if (compact) numeral *= 0.68;
  numeral = Math.max(24, Math.floor(numeral));
  const mainStroke = Math.max(2.4, numeral * 0.11);
  const small = Math.round(numeral * 0.27);
  const smallStroke = Math.max(1.6, small * 0.11);
  const sideWidth = Math.ceil(
    Math.max(
      (layoutNumeral('00', { tabular: true }).width / GLYPH_HEIGHT) * small + smallStroke * 2,
      hour12 ? small * 1.3 : 0,
    ),
  );

  const glow =
    !flat && theme.mode === 'night' && theme.numeralGlow > 0
      ? { color: theme.lumeGlow, opacity: Math.min(0.6, theme.numeralGlow * 1.4) }
      : undefined;

  // Hours and minutes redraw once a minute; only the seconds tick.
  const { hours, minutes } = time;
  const main = useMemo(
    () => (
      <TimeNumerals
        time={{ hours, minutes, seconds: 0 }}
        hour12={hour12}
        withSeconds={false}
        padHour
        tabular
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
    <View style={styles.timeRow} onLayout={(e) => onTimeWidth?.(e.nativeEvent.layout.width)}>
      {main}
      {/* Fixed width: AM/PM level with the digits' tops, seconds on their baseline. */}
      <View
        style={[
          styles.side,
          { width: sideWidth, height: numeral + mainStroke * 2, marginLeft: numeral * 0.1 },
        ]}
      >
        {hour12 ? (
          <Text
            style={[
              styles.meridiem,
              { color: theme.scale, fontSize: Math.max(11, small * 0.5), marginTop: mainStroke },
            ]}
          >
            {time.hours >= 12 ? 'PM' : 'AM'}
          </Text>
        ) : (
          <View />
        )}
        {showSeconds ? (
          <View style={{ marginBottom: mainStroke - smallStroke }}>
            <Seconds
              text={String(time.seconds).padStart(2, '0')}
              height={small}
              stroke={smallStroke}
              width={sideWidth}
              color={theme.scale}
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <View style={[styles.timeArea, area]}>
        {onPressTime ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${spoken}. Add something`}
            accessibilityHint="Starts something new at the next five minutes"
            onPress={onPressTime}
            style={({ hovered }) => hovered && styles.hovered}
          >
            {face}
          </Pressable>
        ) : (
          <View accessible accessibilityLabel={spoken}>
            {face}
          </View>
        )}
      </View>
    </View>
  );
}

/** The seconds: two equal-width digits, right-aligned in a fixed column. */
function Seconds({
  text,
  height,
  stroke,
  width,
  color,
}: {
  text: string;
  height: number;
  stroke: number;
  width: number;
  color: string;
}) {
  const inner = (layoutNumeral(text, { tabular: true }).width / GLYPH_HEIGHT) * height;
  return (
    <View aria-hidden>
      <Svg width={width} height={height + stroke * 2}>
        <Numeral
          text={text}
          x={width - stroke - inner / 2}
          y={height / 2 + stroke}
          height={height}
          strokeWidth={stroke}
          color={color}
          tabular
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignSelf: 'stretch' },
  timeArea: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { justifyContent: 'space-between' },
  meridiem: { fontWeight: '600', letterSpacing: 1.6 },
  hovered: { opacity: 0.85 },
});
