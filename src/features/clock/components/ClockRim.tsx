import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { DialTheme } from '../dial-theme';
import { CENTER, DIAL, DIAL_SIZE } from '../geometry';

type ClockRimProps = {
  size: number;
  theme: DialTheme;
  visible: boolean;
  /** False when the user prefers reduced motion: switch instantly. */
  animate: boolean;
};

const FADE_IN_MS = 220;
const FADE_OUT_MS = 360;

/**
 * The dial's outer edge. Hidden by default so the face blends into the page;
 * it fades in while a pointer is over the clock.
 */
export function ClockRim({ size, theme, visible, animate }: ClockRimProps) {
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    const toValue = visible ? 1 : 0;
    if (!animate) {
      opacity.setValue(toValue);
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue,
      duration: visible ? FADE_IN_MS : FADE_OUT_MS,
      useNativeDriver: Platform.OS !== 'web',
    });
    fade.start();
    return () => fade.stop();
  }, [visible, animate, opacity]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={DIAL.faceRadius}
          fill="none"
          stroke={theme.dialRim}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
}
