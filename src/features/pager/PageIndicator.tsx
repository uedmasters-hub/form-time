import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  QUIET,
  quietOpacity,
  quietTransition,
  usePointerAwake,
  withAlpha,
} from '@/components/quiet-control';
import { useCanHover } from '@/hooks/use-can-hover';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

type PageIndicatorProps = {
  labels: string[];
  index: number;
  progress: SharedValue<number>;
  onSelect: (index: number) => void;
  activeColor: string;
  idleColor: string;
  /** Ink, for the focus ring and pressed tint (as on the icon buttons). */
  inkColor: string;
  style?: StyleProp<ViewStyle>;
};

const ACTIVE_WIDTH = 18;
const IDLE_WIDTH = 6;
const HEIGHT = 4;

/**
 * Two small capsules — the dial's index shape, laid flat — that follow the
 * swipe. Quiet like the icon buttons (see quiet-control): barely there at
 * rest, stronger while the pointer moves, full on hover, press or focus.
 * Doubles as an accessible way to switch views without swiping (tabs for
 * screen readers and keyboards).
 */
export function PageIndicator({
  labels,
  index,
  progress,
  onSelect,
  activeColor,
  idleColor,
  inkColor,
  style,
}: PageIndicatorProps) {
  const canHover = useCanHover();
  const awake = usePointerAwake();
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressing, setPressing] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);

  // Keyboard focus only (:focus-visible), so a click doesn't leave a ring.
  const onFocus = (i: number) => (event: NativeSyntheticEvent<unknown>) => {
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    const visible = Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible'));
    setFocused(visible ? i : null);
  };

  const state = { active: hovered || pressing !== null || focused !== null, canHover, awake };

  return (
    <View
      role="tablist"
      accessibilityLabel="Views"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={[
        styles.group,
        { opacity: quietOpacity(state) },
        quietTransition(state, reducedMotion),
        style,
      ]}
    >
      {labels.map((label, i) => (
        <Pressable
          key={label}
          accessibilityRole="tab"
          accessibilityLabel={label}
          aria-selected={i === index}
          onPress={() => onSelect(i)}
          onPressIn={() => setPressing(i)}
          onPressOut={() => setPressing(null)}
          onFocus={onFocus(i)}
          onBlur={() => setFocused(null)}
          style={[
            styles.hit,
            quietTransition(state, reducedMotion),
            pressing === i && [
              styles.pressed,
              { backgroundColor: withAlpha(inkColor, QUIET.tint) },
            ],
            focused === i && { borderColor: inkColor },
          ]}
        >
          <Capsule
            position={i}
            progress={progress}
            activeColor={activeColor}
            idleColor={idleColor}
          />
        </Pressable>
      ))}
    </View>
  );
}

function Capsule({
  position,
  progress,
  activeColor,
  idleColor,
}: {
  position: number;
  progress: SharedValue<number>;
  activeColor: string;
  idleColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(progress.get() - position));
    return {
      width: interpolate(distance, [0, 1], [ACTIVE_WIDTH, IDLE_WIDTH]),
      backgroundColor: interpolateColor(distance, [0, 1], [activeColor, idleColor]),
    };
  });
  return <Animated.View style={[styles.capsule, style]} />;
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hit: {
    width: 32,
    height: 44,
    borderRadius: 16,
    borderWidth: QUIET.ring,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: QUIET.pressedScale }],
  },
  capsule: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
  },
});
