import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarTheme } from '@/features/calendar/calendar-theme';

type Option<T extends string> = {
  id: T;
  label: string;
  detail?: string;
  icon?: LucideIcon;
};

type OptionGroupProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  theme: CalendarTheme;
  /** Compact tiles for short labels (e.g. weekdays). */
  dense?: boolean;
};

/**
 * One choice from a few — a row of equal tiles, the selected one outlined in
 * ink. Exposed as a radio group to assistive tech.
 */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  theme,
  dense = false,
}: OptionGroupProps<T>) {
  return (
    <View role="radiogroup" accessibilityLabel={label} style={styles.row}>
      {options.map((option) => {
        const selected = option.id === value;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityHint={option.detail}
            aria-checked={selected}
            onPress={() => onChange(option.id)}
            style={({ hovered, pressed }) => [
              styles.tile,
              dense && styles.dense,
              {
                borderColor: selected ? theme.ink : theme.hairline,
                borderWidth: selected ? 1.5 : 1,
                backgroundColor: hovered || pressed ? theme.hover : 'transparent',
              },
            ]}
          >
            {Icon ? (
              <Icon
                size={18}
                color={selected ? theme.ink : theme.muted}
                strokeWidth={1.5}
                style={styles.icon}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                { color: selected ? theme.ink : theme.muted, fontWeight: selected ? '600' : '400' },
              ]}
            >
              {option.label}
            </Text>
            {option.detail ? (
              <Text style={[styles.detail, { color: theme.muted }]}>{option.detail}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dense: {
    minHeight: 40,
    paddingVertical: 8,
  },
  icon: {
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  detail: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
});
