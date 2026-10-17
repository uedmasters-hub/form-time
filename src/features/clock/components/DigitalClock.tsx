import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import type { DialTheme } from '../dial-theme';
import { GLYPH_HEIGHT, layoutNumeral } from '../numerals';
import { useClockTime } from '../use-clock-time';
import { Numeral } from './Numeral';
import { TimeNumerals, timeNumeralsWidth, type WallTimeParts } from './TimeNumerals';

type DigitalClockProps = {
  /** The whole page area. */
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
  /** Top-right corner: the date, with its numeral this tall. */
  topRight?: (now: Date, layout: { numeralHeight: number }) => ReactNode;
  /** Bottom-right corner: what's coming up, `rows` of it at most. */
  bottomRight?: (now: Date, layout: { rows: number }) => ReactNode;
};

/** Bands kept clear for the corner controls (region code, settings, switch). */
const TOP = 72;
const BOTTOM = 76;
/** Wide layouts: the time on the left, the corners' column on the right. */
const WIDE_MIN_WIDTH = 720;
const COLUMN_GAP = 64;
/** Space the upcoming list reserves per row and for its heading. */
const ROW = 66;
const HEADING = 32;

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

/** Height of the date block (DayHeading) for a numeral this tall. */
function dateBlockHeight(numeral: number) {
  const stroke = Math.max(3, numeral * 0.17);
  return 16 + 14 + numeral + stroke * 2 + 12 + 21 + 21;
}

/**
 * The digital face. Built so nothing moves: the time sits centred in an
 * area of its own, with equal-width digits and a fixed-width seconds
 * column, so it keeps one size and one place as the seconds, minutes and
 * the list change. The date takes the top-right corner and what's coming
 * up the bottom-right, in space reserved for them.
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
  topRight,
  bottomRight,
}: DigitalClockProps) {
  const now = useClockTime('quartz', paused);
  const time = wallTime(now, timeZone);
  const wide = width >= WIDE_MIN_WIDTH && width >= height * 1.15;
  const side = wide ? 48 : 20;

  // The corners.
  const column = wide ? Math.round(Math.min(320, Math.max(240, width * 0.24))) : width - side * 2;
  const dateNumeral = wide ? 56 : 40;
  const dateHeight = dateBlockHeight(dateNumeral);
  const rows = wide
    ? Math.max(
        1,
        Math.min(4, Math.floor((height - TOP - BOTTOM - dateHeight - 40 - HEADING) / ROW)),
      )
    : height < 700
      ? 2
      : 3;
  const listHeight = HEADING + rows * ROW;

  // The time's own area: beside the column (wide) or between the corners (narrow).
  const area = wide
    ? { left: side, right: side + column + COLUMN_GAP, top: TOP, bottom: BOTTOM }
    : { left: side, right: side, top: TOP + dateHeight + 16, bottom: BOTTOM + listHeight + 16 };
  const areaWidth = width - area.left - area.right;
  const areaHeight = height - area.top - area.bottom;

  // Size from the widest possible time, so it never changes with the digits.
  const perUnit = timeNumeralsWidth(ZERO, 100, { padHour: true, tabular: true }) / 100;
  const SIDE_SHARE = 0.46; // the seconds / AM-PM column, as a share of the numeral height
  let numeral = Math.min(areaWidth / (perUnit + SIDE_SHARE), areaHeight * (wide ? 0.55 : 0.8), 340);
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
    <View style={styles.timeRow}>
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

      {topRight ? (
        <View style={[styles.corner, { top: TOP, right: side, width: column }]}>
          {topRight(now, { numeralHeight: dateNumeral })}
        </View>
      ) : null}
      {bottomRight ? (
        <View style={[styles.corner, { bottom: BOTTOM, right: side, width: column }]}>
          {bottomRight(now, { rows })}
        </View>
      ) : null}
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
  corner: { position: 'absolute' },
});
