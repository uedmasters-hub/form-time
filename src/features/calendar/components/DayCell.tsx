import { forwardRef, memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Numeral } from '@/features/clock/components/Numeral';

import type { CalendarTheme } from '../calendar-theme';

type DayCellProps = {
  day: number;
  size: number;
  label: string;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  isWeekend: boolean;
  /** Only the selected day is in the tab order (roving focus). */
  isFocusTarget: boolean;
  theme: CalendarTheme;
  onPress: () => void;
};

/**
 * One day of the month grid. Drawn on the dial's geometry: the same monoline
 * numerals, a lume disc for the selected day, a teal ring for today.
 */
const DayCellImpl = forwardRef<View, DayCellProps>(function DayCell(
  {
    day,
    size,
    label,
    isToday,
    isSelected,
    isOutsideMonth,
    isWeekend,
    isFocusTarget,
    theme,
    onPress,
  },
  ref,
) {
  const color = isSelected ? theme.ink : isWeekend ? theme.accent : theme.ink;
  // Keyboard focus only (:focus-visible), so a click doesn't leave a ring.
  const [focusVisible, setFocusVisible] = useState(false);
  const onFocus = (event: NativeSyntheticEvent<unknown>) => {
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    setFocusVisible(Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible')));
  };

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={isSelected}
      focusable={isFocusTarget}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={() => setFocusVisible(false)}
      style={[styles.cell, { width: size, height: size }, isOutsideMonth && styles.outside]}
    >
      {({ hovered, pressed }) => (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {(hovered || pressed) && !isSelected ? (
            <Circle cx={50} cy={50} r={38} fill={theme.hover} />
          ) : null}
          {isSelected ? (
            <>
              <Circle cx={50} cy={50} r={42} fill={theme.lumeGlow} opacity={0.18} />
              <Circle
                cx={50}
                cy={50}
                r={38}
                fill={theme.lume}
                stroke={theme.lumeEdge}
                strokeWidth={1.2}
              />
            </>
          ) : null}
          {isToday ? (
            <Circle cx={50} cy={50} r={38} fill="none" stroke={theme.accent} strokeWidth={2.4} />
          ) : null}
          {focusVisible ? (
            <Circle cx={50} cy={50} r={46} fill="none" stroke={theme.ink} strokeWidth={2} />
          ) : null}
          <Numeral
            text={String(day)}
            x={50}
            y={50}
            height={19}
            strokeWidth={isToday || isSelected ? 4 : 3.4}
            color={color}
          />
        </Svg>
      )}
    </Pressable>
  );
});

export const DayCell = memo(DayCellImpl);

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outside: {
    opacity: 0.32,
  },
});
