import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { Numeral } from '@/features/clock/components/Numeral';
import { GLYPH_HEIGHT, layoutNumeral } from '@/features/clock/numerals';

import { formatDate, type CalendarDate } from '../calendar-date';
import type { CalendarTheme } from '../calendar-theme';

type DayPanelProps = {
  date: CalendarDate;
  isToday: boolean;
  theme: CalendarTheme;
  /** Large date numeral height. */
  numeralHeight: number;
};

/**
 * The selected day, set like the dial: a large monoline numeral, the weekday
 * above it, and its (currently empty) agenda below a hairline.
 */
export function DayPanel({ date, isToday, theme, numeralHeight }: DayPanelProps) {
  const stroke = Math.max(3, numeralHeight * 0.17);
  const text = String(date.day);
  const width = (layoutNumeral(text).width / GLYPH_HEIGHT) * numeralHeight + stroke * 2;
  const height = numeralHeight + stroke * 2;
  const weekdayName = formatDate(date, { weekday: 'long' });
  const monthYear = formatDate(date, { month: 'long', year: 'numeric' });

  return (
    <View
      style={styles.panel}
      accessible
      accessibilityLabel={`${formatDate(date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}${isToday ? ', today' : ''}. No events.`}
    >
      <Text style={[styles.weekday, { color: isToday ? theme.accent : theme.muted }]}>
        {(isToday ? `Today · ${weekdayName}` : weekdayName).toLocaleUpperCase()}
      </Text>
      <Svg width={width} height={height} style={styles.numeral}>
        <Numeral
          text={text}
          x={width / 2}
          y={height / 2}
          height={numeralHeight}
          strokeWidth={stroke}
          color={theme.ink}
        />
      </Svg>
      <Text style={[styles.monthYear, { color: theme.ink }]}>{monthYear}</Text>

      <View style={[styles.rule, { backgroundColor: theme.hairline }]} />
      <Text style={[styles.empty, { color: theme.muted }]}>No events</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'flex-start',
  },
  weekday: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
  },
  numeral: {
    marginTop: 14,
    marginLeft: -2,
  },
  monthYear: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  rule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginTop: 24,
    marginBottom: 16,
  },
  empty: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
