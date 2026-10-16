import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSettings } from '@/features/settings/SettingsProvider';
import { useCanHover } from '@/hooks/use-can-hover';

import { regionLabel, regionOf } from '../regions';

type RegionButtonProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The region's code in the top-right corner: "IN", "IN-HR" for an Indian
 * state, or "US · ET" where a country has several time zones. Quiet at rest — but readable, since it
 * tells you whose time is shown — and full strength on hover, press or focus.
 */
export function RegionButton({ onPress, style }: RegionButtonProps) {
  const { settings, area, uiTheme: ui } = useSettings();
  const canHover = useCanHover();
  const [focusVisible, setFocusVisible] = useState(false);

  const region = regionOf(settings.region);
  const code = regionLabel(region, area);
  const areaName = region.areas.length > 1 && area.id !== region.code ? `, ${area.label}` : '';

  const onFocus = (event: NativeSyntheticEvent<unknown>) => {
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    setFocusVisible(Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible')));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Region: ${region.name}${areaName}`}
      accessibilityHint="Choose the country, time zone or state for the clock and holidays"
      onPress={onPress}
      onFocus={onFocus}
      onBlur={() => setFocusVisible(false)}
      hitSlop={6}
      style={({ hovered, pressed }) => [
        styles.button,
        {
          // Quieter than full strength, but legible: it carries information.
          opacity: hovered || pressed || focusVisible ? 1 : canHover ? 0.55 : 0.65,
          borderColor: focusVisible ? ui.accent : 'transparent',
        },
        pressed && { backgroundColor: ui.hover },
        style,
      ]}
    >
      <Text style={[styles.code, { color: ui.ink }]}>{code}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
});
