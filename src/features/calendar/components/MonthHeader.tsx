import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { QuietIconButton } from '@/components/QuietIconButton';
import { Numeral } from '@/features/clock/components/Numeral';
import { GLYPH_HEIGHT, layoutNumeral } from '@/features/clock/numerals';

import { formatDate } from '../calendar-date';
import type { CalendarTheme } from '../calendar-theme';

type MonthHeaderProps = {
  year: number;
  month: number;
  theme: CalendarTheme;
  showToday: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
};

const YEAR_HEIGHT = 17;
const YEAR_STROKE = 2.4;

/** Month name, the year in dial numerals, and quiet month controls. */
export function MonthHeader({
  year,
  month,
  theme,
  showToday,
  onPrevious,
  onNext,
  onToday,
}: MonthHeaderProps) {
  const monthName = formatDate({ year, month, day: 1 }, { month: 'long' });
  const yearText = String(year);
  const yearWidth = (layoutNumeral(yearText).width / GLYPH_HEIGHT) * YEAR_HEIGHT + YEAR_STROKE * 2;

  return (
    <View style={styles.header}>
      <View
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel={formatDate({ year, month, day: 1 }, { month: 'long', year: 'numeric' })}
        accessible
      >
        <Text style={[styles.month, { color: theme.ink }]}>{monthName}</Text>
        <Svg width={yearWidth} height={YEAR_HEIGHT + YEAR_STROKE * 2} style={styles.year}>
          <Numeral
            text={yearText}
            x={yearWidth / 2}
            y={(YEAR_HEIGHT + YEAR_STROKE * 2) / 2}
            height={YEAR_HEIGHT}
            strokeWidth={YEAR_STROKE}
            color={theme.accent}
          />
        </Svg>
      </View>

      <View style={styles.controls}>
        {showToday ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            onPress={onToday}
            style={({ hovered, pressed }) => [
              styles.today,
              { borderColor: theme.accent, opacity: hovered || pressed ? 1 : 0.75 },
              pressed && { backgroundColor: theme.hover },
            ]}
          >
            <Text style={[styles.todayText, { color: theme.accent }]}>Today</Text>
          </Pressable>
        ) : null}
        <QuietIconButton
          icon={ChevronLeft}
          label="Previous month"
          onPress={onPrevious}
          restOpacity={0.55}
          touchRestOpacity={0.7}
        />
        <QuietIconButton
          icon={ChevronRight}
          label="Next month"
          onPress={onNext}
          restOpacity={0.55}
          touchRestOpacity={0.7}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  month: {
    fontSize: 30,
    fontWeight: '300',
    letterSpacing: 0.2,
  },
  year: {
    marginLeft: 12,
    alignSelf: 'center',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  today: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  todayText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});
