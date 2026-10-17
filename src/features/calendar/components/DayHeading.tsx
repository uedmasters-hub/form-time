import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { Numeral } from '@/features/clock/components/Numeral';
import { GLYPH_HEIGHT, layoutNumeral } from '@/features/clock/numerals';

import { formatDate, type CalendarDate } from '../calendar-date';
import type { CalendarSystem } from '../calendar-system';
import type { CalendarTheme } from '../calendar-theme';

/**
 * A day, set like the dial: the weekday in small tracked capitals, the
 * date as a large monoline numeral, then the month and year (and, in B.S.,
 * the Gregorian date). Shared by the calendar's day panel and the digital
 * watch, so a day reads the same everywhere.
 */
export function DayHeading({
  system,
  date,
  isToday,
  theme,
  numeralHeight,
  scale = 1,
  align = 'start',
  actions,
  todayPrefix = true,
}: {
  system: CalendarSystem;
  date: CalendarDate;
  isToday: boolean;
  theme: CalendarTheme;
  numeralHeight: number;
  /** Type scale; 1 at the base layout size. */
  scale?: number;
  /** 'end' sets it flush right. */
  align?: 'start' | 'end';
  /** Controls on the weekday line, at the far side (phones: Today, +). */
  actions?: ReactNode;
  /** "Today · Saturday"; off where it's always today (the watch). */
  todayPrefix?: boolean;
}) {
  const end = align === 'end';
  const type = Math.min(scale, 1.35);
  const stroke = Math.max(3, numeralHeight * 0.17);
  const text = String(system.dayOf(date) ?? date.day);
  const width = (layoutNumeral(text).width / GLYPH_HEIGHT) * numeralHeight + stroke * 2;
  const height = numeralHeight + stroke * 2;
  const weekdayName = formatDate(date, { weekday: 'long' });
  const month = system.monthOf(date);
  const monthYear = month
    ? system.monthLabel(month)
    : formatDate(date, { month: 'long', year: 'numeric' });
  const secondary = system.secondaryDate?.(date);

  return (
    <View style={end ? styles.end : styles.start}>
      <View style={[styles.weekdayRow, actions ? styles.weekdayRowSpread : null]}>
        <Text
          style={[
            styles.weekday,
            { color: isToday ? theme.accent : theme.muted, fontSize: 11 * type },
            end && styles.textEnd,
          ]}
        >
          {(isToday && todayPrefix ? `Today · ${weekdayName}` : weekdayName).toLocaleUpperCase()}
        </Text>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      <Svg width={width} height={height} style={[styles.numeral, { marginTop: 14 * scale }]}>
        <Numeral
          text={text}
          x={width / 2}
          y={height / 2}
          height={numeralHeight}
          strokeWidth={stroke}
          color={theme.ink}
        />
      </Svg>
      <Text
        style={[
          styles.monthYear,
          { color: theme.ink, fontSize: 15 * type, marginTop: 12 * scale },
          end && styles.textEnd,
        ]}
      >
        {monthYear}
      </Text>
      {secondary ? (
        <Text
          style={[
            styles.secondary,
            { color: theme.muted, fontSize: 12 * type, marginTop: 4 * scale },
            end && styles.textEnd,
          ]}
        >
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start', alignSelf: 'stretch' },
  end: { alignItems: 'flex-end', alignSelf: 'stretch' },
  textEnd: { textAlign: 'right' },
  weekdayRow: { flexDirection: 'row', alignItems: 'center' },
  weekdayRowSpread: { alignSelf: 'stretch', justifyContent: 'space-between' },
  // 44 pt targets on an 11 pt line: let them overhang so the line keeps its height.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: -16,
    marginRight: -12,
  },
  weekday: { fontWeight: '500', letterSpacing: 2 },
  numeral: { marginHorizontal: -2 },
  monthYear: { fontWeight: '300', letterSpacing: 0.3 },
  secondary: { letterSpacing: 0.3 },
});
