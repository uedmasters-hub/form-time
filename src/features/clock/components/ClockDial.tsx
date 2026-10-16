import { memo } from 'react';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { DialTheme } from '../dial-theme';
import { CENTER, DIAL, DIAL_SIZE, polar } from '../geometry';
import { Numeral } from './Numeral';

type ClockDialProps = {
  size: number;
  theme: DialTheme;
  /** Unique prefix so gradient/filter ids never collide between clocks. */
  idPrefix: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const INDEX_LENGTH = DIAL.indexOuter - DIAL.indexInner;
const INDEX_MID = (DIAL.indexOuter + DIAL.indexInner) / 2;
const INDEX_WIDTH = 15;
const INDEX_LUME_WIDTH = 8.6;

/**
 * The static dial: face, minute track, applied indices and numerals.
 * Drawn once and memoised; only the hands layer changes over time.
 */
function ClockDialImpl({ size, theme, idPrefix }: ClockDialProps) {
  const id = (name: string) => `${idPrefix}-dial-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
      <Defs>
        <RadialGradient id={id('face')} cx="50%" cy="46%" r="54%">
          <Stop offset="0" stopColor={theme.dialCenter} />
          <Stop offset="1" stopColor={theme.dialEdge} />
        </RadialGradient>

        {/* Polished frame of an applied index: bevel across its width. */}
        <LinearGradient id={id('steel')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={theme.steelShade} />
          <Stop offset="0.28" stopColor={theme.steelHighlight} />
          <Stop offset="0.62" stopColor={theme.steelMid} />
          <Stop offset="1" stopColor={theme.steelShade} />
        </LinearGradient>

        <Filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation={9} />
        </Filter>
        <Filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation={3} />
        </Filter>
      </Defs>

      {/* Face. Its edge colour matches the page, so it has no visible boundary;
          the rim is a separate hover-only layer (ClockRim). */}
      <Circle cx={CENTER} cy={CENTER} r={DIAL.faceRadius} fill={url('face')} />

      {/* Minute track — the hour positions are carried by the applied indices */}
      {MINUTES.filter((m) => m % 5 !== 0).map((m) => {
        const outer = polar(DIAL.tickOuter, m * 6);
        const inner = polar(DIAL.tickInner, m * 6);
        return (
          <Line
            key={`tick-${m}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={theme.scale}
            strokeWidth={4.6}
            strokeLinecap="round"
          />
        );
      })}

      {/* Lume halo behind every index */}
      <G filter={url('glow')} opacity={0.6}>
        {HOURS.map((h) => {
          const outer = polar(DIAL.indexOuter - 4, h * 30);
          const inner = polar(DIAL.indexInner + 4, h * 30);
          return (
            <Line
              key={`glow-${h}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={theme.lumeGlow}
              strokeWidth={INDEX_WIDTH + 6}
              strokeLinecap="round"
            />
          );
        })}
      </G>

      {/* Contact shadow: indices are applied, so they sit slightly above the face */}
      <G filter={url('soft')} opacity={0.08} transform="translate(2 4)">
        {HOURS.map((h) => {
          const outer = polar(DIAL.indexOuter, h * 30);
          const inner = polar(DIAL.indexInner, h * 30);
          return (
            <Line
              key={`shadow-${h}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={theme.shadow}
              strokeWidth={INDEX_WIDTH}
              strokeLinecap="round"
            />
          );
        })}
      </G>

      {/* Applied indices: steel frame with a lume insert */}
      {HOURS.map((h) => {
        const p = polar(INDEX_MID, h * 30);
        return (
          <G key={`index-${h}`} transform={`translate(${p.x} ${p.y}) rotate(${h * 30})`}>
            <Rect
              x={-INDEX_WIDTH / 2}
              y={-INDEX_LENGTH / 2}
              width={INDEX_WIDTH}
              height={INDEX_LENGTH}
              rx={INDEX_WIDTH / 2}
              fill={url('steel')}
              stroke={theme.steelEdge}
              strokeWidth={0.8}
            />
            <Rect
              x={-INDEX_LUME_WIDTH / 2}
              y={-INDEX_LENGTH / 2 + (INDEX_WIDTH - INDEX_LUME_WIDTH) / 2}
              width={INDEX_LUME_WIDTH}
              height={INDEX_LENGTH - (INDEX_WIDTH - INDEX_LUME_WIDTH)}
              rx={INDEX_LUME_WIDTH / 2}
              fill={theme.lume}
              stroke={theme.steelShade}
              strokeWidth={0.9}
            />
            <Rect
              x={-1.8}
              y={-INDEX_LENGTH / 2 + 9}
              width={2.4}
              height={INDEX_LENGTH - 18}
              rx={1.2}
              fill={theme.lumeHighlight}
              opacity={0.85}
            />
          </G>
        );
      })}

      {/* Outer minute scale, set radially */}
      {HOURS.map((h) => {
        const value = h * 5;
        const label = value === 0 ? '60' : String(value).padStart(2, '0');
        const p = polar(DIAL.outerScaleRadius, h * 30);
        return (
          <Numeral
            key={`minute-${value}`}
            text={label}
            x={p.x}
            y={p.y}
            height={17.5}
            strokeWidth={3.5}
            rotation={h * 30}
            color={theme.scale}
          />
        );
      })}

      {/* Hour numerals, upright */}
      {HOURS.map((h) => {
        const hour = h === 0 ? 12 : h;
        const p = polar(DIAL.hourNumeralRadius, h * 30);
        return (
          <Numeral
            key={`hour-${hour}`}
            text={String(hour)}
            x={p.x}
            y={p.y}
            height={38.5}
            strokeWidth={6.8}
            color={theme.numeral}
          />
        );
      })}
    </Svg>
  );
}

export const ClockDial = memo(ClockDialImpl);
