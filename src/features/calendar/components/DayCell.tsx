import { forwardRef, memo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Numeral } from '@/features/clock/components/Numeral';

import type { CalendarTheme } from '../calendar-theme';

type DayCellProps = {
  day: number;
  /** The Gregorian day, set small in the corner when the grid is in B.S. */
  subDay?: number;
  size: number;
  label: string;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  isWeekend: boolean;
  /** Only the selected day is in the tab order (roving focus). */
  isFocusTarget: boolean;
  /** Holiday markers: a solid dot for a public holiday, a ring for others. */
  marks?: { public: boolean; other: boolean };
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
    subDay,
    size,
    label,
    isToday,
    isSelected,
    isOutsideMonth,
    isWeekend,
    isFocusTarget,
    marks,
    theme,
    onPress,
  },
  ref,
) {
  const color = isSelected ? theme.onLume : isWeekend ? theme.accent : theme.ink;
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
        <>
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
            {marks ? (
              <HolidayMarks marks={marks} color={isSelected ? theme.onLume : theme.accent} />
            ) : null}
          </Svg>
          {subDay !== undefined && size >= 40 ? (
            <Text
              style={[
                styles.subDay,
                {
                  color: theme.muted,
                  fontSize: Math.min(13, Math.max(9, size * 0.13)),
                  // In the corner, clear of the selection disc.
                  right: size * 0.02,
                  bottom: 0,
                },
              ]}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {subDay}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
});

/** Small marks under the numeral; two side by side when both kinds fall on the day. */
function HolidayMarks({
  marks,
  color,
}: {
  marks: { public: boolean; other: boolean };
  color: string;
}) {
  const both = marks.public && marks.other;
  return (
    <>
      {marks.public ? <Circle cx={both ? 45 : 50} cy={76} r={3.4} fill={color} /> : null}
      {marks.other ? (
        <Circle cx={both ? 55 : 50} cy={76} r={2.9} fill="none" stroke={color} strokeWidth={1.5} />
      ) : null}
    </>
  );
}

export const DayCell = memo(DayCellImpl);

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outside: {
    opacity: 0.32,
  },
  subDay: {
    position: 'absolute',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
});
