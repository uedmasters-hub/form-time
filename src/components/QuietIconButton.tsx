import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSettings } from '@/features/settings/SettingsProvider';
import { useCanHover } from '@/hooks/use-can-hover';

type QuietIconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  hint?: string;
  /** Resting opacity where a pointer can hover. */
  restOpacity?: number;
  /** Resting opacity on touch screens, which can't hover to reveal it. */
  touchRestOpacity?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Hit area meets the 44 × 44 pt minimum on every platform. */
const TARGET = 44;

/**
 * An outline icon that stays in the background until it's wanted:
 * faint at rest, full strength on hover, press or keyboard focus.
 */
export function QuietIconButton({
  icon: Icon,
  label,
  onPress,
  hint,
  restOpacity = 0.25,
  touchRestOpacity = 0.4,
  iconSize = 20,
  style,
}: QuietIconButtonProps) {
  const { uiTheme } = useSettings();
  const canHover = useCanHover();
  // Keyboard focus only (:focus-visible), so a mouse click doesn't leave a ring.
  const [focusVisible, setFocusVisible] = useState(false);

  const onFocus = (event: NativeSyntheticEvent<unknown>) => {
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    setFocusVisible(Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible')));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={() => setFocusVisible(false)}
      hitSlop={4}
      style={({ hovered, pressed }) => [
        styles.button,
        {
          opacity:
            hovered || pressed || focusVisible ? 1 : canHover ? restOpacity : touchRestOpacity,
        },
        pressed && [styles.pressed, { backgroundColor: uiTheme.hover }],
        focusVisible && { borderColor: uiTheme.accent },
        style,
      ]}
    >
      <Icon size={iconSize} color={uiTheme.ink} strokeWidth={1.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TARGET,
    height: TARGET,
    borderRadius: TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
