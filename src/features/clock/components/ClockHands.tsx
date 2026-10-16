import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import type { DialTheme } from '../dial-theme';
import { CENTER, DIAL_SIZE, type HandAngles } from '../geometry';
import { HOUR_HAND, MINUTE_HAND, handOutline, secondHandOutline, type HandSpec } from '../hands';

type ClockHandsProps = {
  size: number;
  angles: HandAngles;
  theme: DialTheme;
  idPrefix: string;
};

// Outlines never change, so build them once.
const HOUR_PATH = handOutline(HOUR_HAND);
const MINUTE_PATH = handOutline(MINUTE_HAND);
const SECOND_PATH = secondHandOutline();

/**
 * Cast-shadow offsets in screen space (light from the upper left). Hands
 * stacked higher above the dial cast a longer shadow.
 */
const SHADOW = {
  hour: { dx: 5, dy: 11 },
  minute: { dx: 7, dy: 14 },
  second: { dx: 8, dy: 16 },
  hub: { dx: 4, dy: 12 },
} as const;

/** Widening, faint strokes that together read as a soft blur. */
const SHADOW_PASSES = [
  { width: 56, opacity: 0.035 },
  { width: 46, opacity: 0.045 },
  { width: 36, opacity: 0.05 },
  { width: 27, opacity: 0.06 },
  { width: 18, opacity: 0.065 },
  { width: 10, opacity: 0.075 },
] as const;

/**
 * Soft, lume-tinted glow cast onto the dial, without an SVG filter. Filters
 * on the hands would re-rasterise every frame on native; this costs a few
 * extra paths.
 */
function SoftShadow({
  d,
  angle,
  offset,
  color,
  strength = 1,
}: {
  d: string;
  angle: number;
  offset: { dx: number; dy: number };
  color: string;
  strength?: number;
}) {
  return (
    <G transform={`translate(${CENTER + offset.dx} ${CENTER + offset.dy}) rotate(${angle})`}>
      {SHADOW_PASSES.map((pass) => (
        <Path
          key={pass.width}
          d={d}
          fill="none"
          stroke={color}
          strokeOpacity={pass.opacity * strength}
          strokeWidth={pass.width * Math.min(1, 0.5 + strength / 2)}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </G>
  );
}

function SculptedHand({
  d,
  spec,
  angle,
  theme,
  steel,
}: {
  d: string;
  spec: HandSpec;
  angle: number;
  theme: DialTheme;
  steel: string;
}) {
  return (
    <G transform={`translate(${CENTER} ${CENTER}) rotate(${angle})`}>
      <Path d={d} fill={steel} stroke={theme.steelEdge} strokeWidth={1.1} strokeLinejoin="round" />
      {/* Recessed channel, lume, and a catch-light along the lume */}
      <Line
        x1={0}
        y1={-spec.lumeStart}
        x2={0}
        y2={-spec.lumeEnd}
        stroke={theme.steelShade}
        strokeWidth={spec.lumeHalf * 2 + 1.8}
        strokeLinecap="round"
      />
      <Line
        x1={0}
        y1={-spec.lumeStart}
        x2={0}
        y2={-spec.lumeEnd}
        stroke={theme.lume}
        strokeWidth={spec.lumeHalf * 2}
        strokeLinecap="round"
      />
      <Line
        x1={-spec.lumeHalf * 0.3}
        y1={-(spec.lumeStart + 6)}
        x2={-spec.lumeHalf * 0.3}
        y2={-(spec.lumeEnd - 6)}
        stroke={theme.lumeHighlight}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.9}
      />
    </G>
  );
}

/** The moving layer: hands, hub and their shadows. Drawn over ClockDial. */
export function ClockHands({ size, angles, theme, idPrefix }: ClockHandsProps) {
  const id = (name: string) => `${idPrefix}-hands-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} pointerEvents="none">
      <Defs>
        {/* Faceted steel: a bright ridge down the centre of each hand */}
        <LinearGradient id={id('steel')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={theme.steelMid} />
          <Stop offset="0.3" stopColor={theme.steelHighlight} />
          <Stop offset="0.62" stopColor={theme.steelLight} />
          <Stop offset="1" stopColor={theme.steelMid} />
        </LinearGradient>
        <RadialGradient id={id('screw')} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor={theme.steelMid} />
          <Stop offset="0.6" stopColor={theme.screw} />
          <Stop offset="1" stopColor={theme.steelEdge} />
        </RadialGradient>
        <RadialGradient id={id('dome')} cx="42%" cy="38%" r="65%">
          <Stop offset="0" stopColor={theme.steelHighlight} />
          <Stop offset="0.55" stopColor={theme.steelLight} />
          <Stop offset="1" stopColor={theme.steelShade} />
        </RadialGradient>
      </Defs>

      {/* Shadows first, so no hand is ever shaded by its own shadow */}
      <SoftShadow d={HOUR_PATH} angle={angles.hour} offset={SHADOW.hour} color={theme.lumeGlow} />
      <SoftShadow
        d={MINUTE_PATH}
        angle={angles.minute}
        offset={SHADOW.minute}
        color={theme.lumeGlow}
      />
      <SoftShadow
        d={SECOND_PATH}
        angle={angles.second}
        offset={SHADOW.second}
        color={theme.lumeGlow}
        strength={0.5}
      />
      <G transform={`translate(${CENTER + SHADOW.hub.dx} ${CENTER + SHADOW.hub.dy})`}>
        <Circle r={42} fill={theme.lumeGlow} opacity={0.08} />
        <Circle r={34} fill={theme.lumeGlow} opacity={0.1} />
        <Circle r={29} fill={theme.shadow} opacity={0.08} />
      </G>

      <SculptedHand
        d={HOUR_PATH}
        spec={HOUR_HAND}
        angle={angles.hour}
        theme={theme}
        steel={url('steel')}
      />
      <SculptedHand
        d={MINUTE_PATH}
        spec={MINUTE_HAND}
        angle={angles.minute}
        theme={theme}
        steel={url('steel')}
      />

      {/* Hub: hour and minute collars stacked under the second hand. Each lower
          collar peeks out below the one above, so the stack reads as depth. */}
      <Circle
        cx={CENTER}
        cy={CENTER + 5}
        r={26}
        fill={url('dome')}
        stroke={theme.steelEdge}
        strokeWidth={0.9}
      />
      <Circle
        cx={CENTER}
        cy={CENTER + 2.5}
        r={25}
        fill={url('dome')}
        stroke={theme.steelEdge}
        strokeWidth={0.9}
      />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={24}
        fill={url('dome')}
        stroke={theme.steelEdge}
        strokeWidth={1}
      />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={16}
        fill="none"
        stroke={theme.steelShade}
        strokeWidth={1.2}
        opacity={0.6}
      />

      <G transform={`translate(${CENTER} ${CENTER}) rotate(${angles.second})`}>
        <Path
          d={SECOND_PATH}
          fill={url('steel')}
          stroke={theme.steelEdge}
          strokeWidth={0.7}
          strokeLinejoin="round"
        />
      </G>

      {/* Cap: a polished domed screw */}
      <Circle cx={CENTER + 0.5} cy={CENTER + 1.5} r={10} fill={theme.steelShade} opacity={0.6} />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={9}
        fill={url('dome')}
        stroke={theme.steelEdge}
        strokeWidth={0.9}
      />
      <Circle cx={CENTER} cy={CENTER} r={6.4} fill={url('screw')} />
      <Circle
        cx={CENTER - 1.8}
        cy={CENTER - 2.2}
        r={1.8}
        fill={theme.steelHighlight}
        opacity={0.8}
      />
    </Svg>
  );
}
