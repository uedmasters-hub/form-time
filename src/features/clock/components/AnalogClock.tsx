import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { defaultDialTheme, type DialTheme } from '../dial-theme';
import { getHandAngles } from '../geometry';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { useClockTime, type ClockMovement } from '../use-clock-time';
import { ClockDial } from './ClockDial';
import { ClockHands } from './ClockHands';
import { ClockRim } from './ClockRim';

type AnalogClockProps = {
  /** Diameter in points. */
  size: number;
  theme?: DialTheme;
  /** Defaults to a sweep, or a one-second tick when reduce motion is on. */
  movement?: ClockMovement;
  /** Stop redrawing, e.g. while another view covers the clock. */
  paused?: boolean;
};

const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Live analog clock, drawn as stacked SVG layers: a static dial that renders
 * once, a rim that appears only on hover, and a hands layer that is the only
 * thing redrawn each frame.
 */
export function AnalogClock({
  size,
  theme = defaultDialTheme,
  movement,
  paused = false,
}: AnalogClockProps) {
  // SVG ids are document-global on web; React ids can contain characters
  // that aren't valid in url(#…) references, so keep only safe ones.
  const idPrefix = `ft${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const reducedMotion = useReducedMotion();
  const effectiveMovement = movement ?? (reducedMotion ? 'tick' : 'sweep');
  const now = useClockTime(effectiveMovement, paused);
  const angles = getHandAngles(now, { smoothSeconds: effectiveMovement === 'sweep' });

  // Pointer hover (mouse, trackpad, stylus). Touch screens never hover, so the
  // rim simply stays hidden there.
  const [hovered, setHovered] = useState(false);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Clock showing ${timeLabel.format(now)}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <ClockDial size={size} theme={theme} idPrefix={idPrefix} />
      <ClockRim size={size} theme={theme} visible={hovered} animate={!reducedMotion} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ClockHands size={size} angles={angles} theme={theme} idPrefix={idPrefix} />
      </View>
    </View>
  );
}
