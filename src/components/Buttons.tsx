import { Pressable, StyleSheet, Text } from 'react-native';

import { useSettings } from '@/features/settings/SettingsProvider';

/**
 * The two kinds of text button: a quiet one ("Next", "Cancel", "Forgot
 * password?") and the one strong action on a surface ("Save", "Sign in").
 */
export function TextButton({
  label,
  onPress,
  a11yLabel,
  tone = 'ink',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  a11yLabel?: string;
  tone?: 'ink' | 'accent' | 'muted';
  disabled?: boolean;
}) {
  const { uiTheme: ui } = useSettings();
  const color = tone === 'accent' ? ui.accent : tone === 'muted' ? ui.muted : ui.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.text,
        { backgroundColor: !disabled && (hovered || pressed) ? ui.hover : 'transparent' },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.textLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  dim = false,
  busy = false,
  stretch = false,
}: {
  label: string;
  onPress: () => void;
  /** Faint but still pressable (it explains what's missing when pressed). */
  dim?: boolean;
  /** Working: ignores presses and says so to assistive tech. */
  busy?: boolean;
  /** Full width. */
  stretch?: boolean;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      aria-busy={busy}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        stretch && styles.stretch,
        { backgroundColor: ui.ink, opacity: dim || busy ? 0.4 : pressed ? 0.85 : 1 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.primaryLabel, { color: ui.surface }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center' },
  textLabel: { fontSize: 13, fontWeight: '500' },
  disabled: { opacity: 0.4 },
  primary: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stretch: { alignSelf: 'stretch' },
  primaryLabel: { fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },
  pressed: { transform: [{ scale: 0.97 }] },
});
