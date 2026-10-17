import { View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G } from 'react-native-svg';

import { GLYPH_HEIGHT, layoutNumeral } from '../numerals';
import { Numeral } from './Numeral';

export type WallTimeParts = { hours: number; minutes: number; seconds: number };

const pad = (n: number) => String(n).padStart(2, '0');
/** Space for the two-dot colon, as a share of the numeral height. */
const COLON = 0.36;
const strokeFor = (height: number) => Math.max(2.4, height * 0.11);

/** The groups of digits shown: "9", "33" (and "07" with seconds). */
function partsOf(time: WallTimeParts, hour12: boolean, withSeconds: boolean, padHour: boolean) {
  const hour = hour12 ? time.hours % 12 || 12 : time.hours;
  return [
    padHour && !hour12 ? pad(hour) : String(hour),
    pad(time.minutes),
    ...(withSeconds ? [pad(time.seconds)] : []),
  ];
}

/** Width of the drawing at a given numeral height, for layout. */
export function timeNumeralsWidth(
  time: WallTimeParts,
  height: number,
  { hour12 = false, withSeconds = false, padHour = false, tabular = false } = {},
): number {
  const parts = partsOf(time, hour12, withSeconds, padHour);
  const digits = parts.reduce(
    (w, p) => w + (layoutNumeral(p, { tabular }).width / GLYPH_HEIGHT) * height,
    0,
  );
  return digits + height * COLON * (parts.length - 1) + strokeFor(height) * 2;
}

/**
 * "3:00" or "15:00:28" in the dial's monoline numerals, with a two-dot
 * colon. Hidden from assistive tech: whatever shows it labels the time.
 */
export function TimeNumerals({
  time,
  hour12,
  withSeconds,
  color,
  height = 28,
  padHour = false,
  glow,
  idPrefix = 'ft-time',
  tabular = false,
}: {
  time: WallTimeParts;
  hour12: boolean;
  withSeconds: boolean;
  color: string;
  height?: number;
  /** 24-hour time with a leading zero ("09:33"). */
  padHour?: boolean;
  /** A soft halo beneath the numerals (night dials with depth on). */
  glow?: { color: string; opacity: number };
  idPrefix?: string;
  /** Equal-width digits: the drawing keeps one width whatever the time. */
  tabular?: boolean;
}) {
  const stroke = strokeFor(height);
  const parts = partsOf(time, hour12, withSeconds, padHour);
  const widths = parts.map((p) => (layoutNumeral(p, { tabular }).width / GLYPH_HEIGHT) * height);
  const colon = height * COLON;
  const width = widths.reduce((a, b) => a + b, 0) + colon * (parts.length - 1) + stroke * 2;
  const svgHeight = height + stroke * 2;
  // A glow needs room to fade out, or it stops in a hard edge at the drawing's
  // bounds; the room is outside the layout box (negative margin).
  const bleed = glow ? Math.ceil(height * 0.25) : 0;
  const mid = svgHeight / 2 + bleed;

  const draw = (ink: string, prefix: string) => {
    let x = stroke + bleed;
    return parts.map((text, i) => {
      const w = widths[i];
      const numeral = (
        <Numeral
          key={`${prefix}n${i}`}
          text={text}
          x={x + w / 2}
          y={mid}
          height={height}
          strokeWidth={stroke}
          color={ink}
          tabular={tabular}
        />
      );
      x += w;
      if (i === parts.length - 1) return numeral;
      const cx = x + colon / 2;
      x += colon;
      return [
        numeral,
        <Circle
          key={`${prefix}a${i}`}
          cx={cx}
          cy={mid - height * 0.2}
          r={stroke * 0.6}
          fill={ink}
        />,
        <Circle
          key={`${prefix}b${i}`}
          cx={cx}
          cy={mid + height * 0.2}
          r={stroke * 0.6}
          fill={ink}
        />,
      ];
    });
  };

  return (
    // On a View: react-native-svg hands its props to the DOM on web, where
    // React Native's accessibility props don't exist.
    <View aria-hidden style={bleed ? { margin: -bleed } : undefined}>
      <Svg width={width + bleed * 2} height={svgHeight + bleed * 2}>
        {glow ? (
          <>
            <Defs>
              <Filter
                id={`${idPrefix}-glow`}
                filterUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={width + bleed * 2}
                height={svgHeight + bleed * 2}
              >
                <FeGaussianBlur stdDeviation={height * 0.06} />
              </Filter>
            </Defs>
            <G filter={`url(#${idPrefix}-glow)`} opacity={glow.opacity}>
              {draw(glow.color, 'g')}
            </G>
          </>
        ) : null}
        {draw(color, '')}
      </Svg>
    </View>
  );
}
