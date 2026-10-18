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
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import {
  QUIET,
  quietTouchable,
  quietOpacity,
  quietTransition,
  revealControls,
  useQuietAwake,
  withAlpha,
} from './quiet-control';

type QuietIconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  /** Shown very faintly and ignored (e.g. "Next month" at the end of a range). */
  disabled?: boolean;
  hint?: string;
  iconSize?: number;
  /** One of the page's own controls: hidden on touch screens until the screen is touched. */
  hideOnTouch?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Hit area meets the 44 × 44 pt minimum on every platform. */
const TARGET = 44;

/**
 * An outline icon that stays in the background until it's wanted, like the
 * desktop app's full-screen ✕ (see quiet-control): barely there at rest,
 * stronger for a moment while the pointer moves (and always a little
 * stronger on touch screens), full strength on hover, press or keyboard
 * focus — fading in quickly and back slowly. Pressed: a light ink tint and
 * a slight press-in; keyboard focus: a thin ink ring.
 */
export function QuietIconButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
  hint,
  iconSize = 20,
  hideOnTouch = false,
  style,
}: QuietIconButtonProps) {
  const { uiTheme } = useSettings();
  const canHover = useCanHover();
  const { awake, ready } = useQuietAwake(canHover);
  const reducedMotion = useReducedMotion();
  // Any focus (a keyboard, a screen reader) shows a hidden control and keeps it.
  const [focused, setFocused] = useState(false);
  // Keyboard focus only (:focus-visible), so a mouse click doesn't leave a ring.
  const [focusVisible, setFocusVisible] = useState(false);

  const onFocus = (event: NativeSyntheticEvent<unknown>) => {
    setFocused(true);
    if (hideOnTouch) revealControls();
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    setFocusVisible(Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible')));
  };

  const touchable = quietTouchable(
    {
      active: focusVisible || (!canHover && hideOnTouch && focused),
      disabled,
      canHover,
      awake,
      hideable: hideOnTouch,
    },
    ready,
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={() => {
        setFocused(false);
        setFocusVisible(false);
      }}
      hitSlop={4}
      pointerEvents={touchable ? 'auto' : 'none'}
      style={({ hovered, pressed }) => {
        const state = {
          active: hovered || pressed || focusVisible || (!canHover && hideOnTouch && focused),
          disabled,
          canHover,
          awake,
          hideable: hideOnTouch,
        };
        return [
          styles.button,
          { opacity: quietOpacity(state) },
          quietTransition(state, reducedMotion),
          pressed && [styles.pressed, { backgroundColor: withAlpha(uiTheme.ink, QUIET.tint) }],
          focusVisible && { borderColor: uiTheme.ink },
          style,
        ];
      }}
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
    borderWidth: QUIET.ring,
    borderColor: 'transparent',
  },
  pressed: {
    transform: [{ scale: QUIET.pressedScale }],
  },
});
