import { useId } from 'react';
import { StyleSheet, View } from 'react-native';

import { defaultDialTheme, type DialTheme } from '../dial-theme';
import { getHandAngles } from '../geometry';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { SECOND_STEP, useClockTime, type ClockMovement } from '../use-clock-time';
import { ClockDial } from './ClockDial';
import { ClockHands } from './ClockHands';

type AnalogClockProps = {
  /** Diameter in points. */
  size: number;
  theme?: DialTheme;
  /** Second-hand movement. Reduce motion always uses the one-second quartz step. */
  movement?: ClockMovement;
  showSecondHand?: boolean;
  /** IANA time zone to show; defaults to the device's. */
  timeZone?: string;
  /** Stop redrawing, e.g. while another view covers the clock. */
  paused?: boolean;
  /** No shadows, glow or bevels (the "Shadows & glow" setting, off). */
  flat?: boolean;
};

const timeLabels = new Map<string, Intl.DateTimeFormat>();
function formatTime(date: Date, timeZone?: string) {
  const key = timeZone ?? 'local';
  let f = timeLabels.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
    timeLabels.set(key, f);
  }
  return f.format(date);
}

/**
 * Live analog clock, drawn as stacked SVG layers: a static dial that renders
 * once, and a hands layer that is the only thing redrawn each frame. The
 * face has no outline: it blends into the page.
 */
export function AnalogClock({
  size,
  theme = defaultDialTheme,
  movement = 'smooth',
  showSecondHand = true,
  timeZone,
  paused = false,
  flat = false,
}: AnalogClockProps) {
  // SVG ids are document-global on web; React ids can contain characters
  // that aren't valid in url(#…) references, so keep only safe ones.
  const idPrefix = `ft${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const reducedMotion = useReducedMotion();
  // Without a second hand nothing moves faster than the minute hand, so
  // a once-a-second update is plenty.
  const effectiveMovement: ClockMovement = reducedMotion || !showSecondHand ? 'quartz' : movement;
  const now = useClockTime(effectiveMovement, paused);
  const angles = getHandAngles(now, { secondStep: SECOND_STEP[effectiveMovement], timeZone });

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Clock showing ${formatTime(now, timeZone)}`}
    >
      <ClockDial size={size} theme={theme} idPrefix={idPrefix} flat={flat} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ClockHands
          size={size}
          angles={angles}
          theme={theme}
          idPrefix={idPrefix}
          showSecondHand={showSecondHand}
          flat={flat}
        />
      </View>
    </View>
  );
}
