import { useId } from 'react';
import { StyleSheet, View } from 'react-native';

import { defaultDialTheme, type DialTheme } from '../dial-theme';
import { getHandAngles } from '../geometry';
import { useClockTime, useReducedMotion, type ClockMovement } from '../use-clock-time';
import { ClockDial } from './ClockDial';
import { ClockHands } from './ClockHands';

type AnalogClockProps = {
  /** Diameter in points. */
  size: number;
  theme?: DialTheme;
  /** Defaults to a sweep, or a one-second tick when reduce motion is on. */
  movement?: ClockMovement;
};

const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Live analog clock, drawn as two stacked SVG layers: a static dial that
 * renders once, and a hands layer that is the only thing redrawn each frame.
 */
export function AnalogClock({ size, theme = defaultDialTheme, movement }: AnalogClockProps) {
  // SVG ids are document-global on web; React ids can contain characters
  // that aren't valid in url(#…) references, so keep only safe ones.
  const idPrefix = `ft${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const reducedMotion = useReducedMotion();
  const effectiveMovement = movement ?? (reducedMotion ? 'tick' : 'sweep');
  const now = useClockTime(effectiveMovement);
  const angles = getHandAngles(now, { smoothSeconds: effectiveMovement === 'sweep' });

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Clock showing ${timeLabel.format(now)}`}
    >
      <ClockDial size={size} theme={theme} idPrefix={idPrefix} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ClockHands size={size} angles={angles} theme={theme} idPrefix={idPrefix} />
      </View>
    </View>
  );
}
