import { forwardRef, memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

import { Numeral } from '@/features/clock/components/Numeral';

import type { CalendarTheme } from '../calendar-theme';

type DayCellProps = {
  day: number;
  /** The Gregorian day, set small under the B.S. day when the grid is in B.S. */
  subDay?: number;
  size: number;
  label: string;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  isWeekend: boolean;
  /** Only the selected day is in the tab order (roving focus). */
  isFocusTarget: boolean;
  /**
   * Markers under the numeral: a solid dot for a public holiday, a ring for
   * other holidays and festivals, a small square for the user's own items.
   */
  marks?: DayMarks;
  theme: CalendarTheme;
  onPress: () => void;
};

/**
 * How far in from either side of a cell the widest two-digit numeral
 * reaches, as a share of the cell. What lines up with the dates — the month
 * title, the arrows, the day panel — uses it.
 */
export const NUMERAL_INSET = 0.3;

export type DayMarks = { public: boolean; other: boolean; mine: boolean };

/**
 * Vertical layout in the cell's 100-unit box. A single date sits centred
 * with its holiday marks below; a B.S. date stacks the day, the marks and
 * the A.D. day, all centred, inside the selection disc.
 */
const SINGLE = { numeral: 50, marks: 76 };
const STACKED = { numeral: 38, marks: 57, subDay: 82 };

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
  const showSubDay = subDay !== undefined && size >= 40;
  const layout = showSubDay ? STACKED : SINGLE;
  // 9–13 px on screen, in the cell's 100-unit coordinates.
  const subDayUnits = (Math.min(13, Math.max(9, size * 0.13)) / size) * 100;
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
                {theme.flat ? null : (
                  <Circle cx={50} cy={50} r={42} fill={theme.lumeGlow} opacity={0.18} />
                )}
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
              y={layout.numeral}
              height={19}
              strokeWidth={isToday || isSelected ? 4 : 3.4}
              color={color}
            />
            {marks ? (
              <Marks
                marks={marks}
                y={layout.marks}
                color={isSelected ? theme.onLume : theme.accent}
                mineColor={isSelected ? theme.onLume : theme.ink}
              />
            ) : null}
            {showSubDay ? (
              <SvgText
                x={50}
                y={STACKED.subDay}
                textAnchor="middle"
                fontSize={subDayUnits}
                fill={isSelected ? theme.onLume : theme.muted}
                opacity={isSelected ? 0.75 : 1}
                letterSpacing={subDayUnits * 0.02}
              >
                {String(subDay)}
              </SvgText>
            ) : null}
          </Svg>
        </>
      )}
    </Pressable>
  );
});

/** Small marks in a centred row under the numeral, 10 units apart. */
function Marks({
  marks,
  y,
  color,
  mineColor,
}: {
  marks: DayMarks;
  y: number;
  color: string;
  mineColor: string;
}) {
  const shown = (['public', 'other', 'mine'] as const).filter((k) => marks[k]);
  const x = (i: number) => 50 + (i - (shown.length - 1) / 2) * 10;
  return (
    <>
      {shown.map((kind, i) =>
        kind === 'public' ? (
          <Circle key={kind} cx={x(i)} cy={y} r={3.4} fill={color} />
        ) : kind === 'other' ? (
          <Circle
            key={kind}
            cx={x(i)}
            cy={y}
            r={2.9}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
        ) : (
          <Rect key={kind} x={x(i) - 2.9} y={y - 2.9} width={5.8} height={5.8} fill={mineColor} />
        ),
      )}
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
});
