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

import { useCanHover } from '@/hooks/use-can-hover';

type PageIndicatorProps = {
  labels: string[];
  index: number;
  progress: SharedValue<number>;
  onSelect: (index: number) => void;
  activeColor: string;
  idleColor: string;
  style?: StyleProp<ViewStyle>;
};

const ACTIVE_WIDTH = 18;
const IDLE_WIDTH = 6;
const HEIGHT = 4;

/**
 * Two small capsules — the dial's index shape, laid flat — that follow the
 * swipe. Quiet like the settings icon, and doubles as an accessible way to
 * switch views without swiping (tabs for screen readers and keyboards).
 */
export function PageIndicator({
  labels,
  index,
  progress,
  onSelect,
  activeColor,
  idleColor,
  style,
}: PageIndicatorProps) {
  const canHover = useCanHover();
  const [hovered, setHovered] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  const onFocus = (event: NativeSyntheticEvent<unknown>) => {
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    setFocusVisible(Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible')));
  };

  const opacity = hovered || pressing || focusVisible ? 1 : canHover ? 0.25 : 0.4;

  return (
    <View
      role="tablist"
      accessibilityLabel="Views"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={[styles.group, { opacity }, style]}
    >
      {labels.map((label, i) => (
        <Pressable
          key={label}
          accessibilityRole="tab"
          accessibilityLabel={label}
          aria-selected={i === index}
          onPress={() => onSelect(i)}
          onPressIn={() => setPressing(true)}
          onPressOut={() => setPressing(false)}
          onFocus={onFocus}
          onBlur={() => setFocusVisible(false)}
          style={styles.hit}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
  },
});
