import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { QuietIconButton } from '@/components/QuietIconButton';
import { Numeral } from '@/features/clock/components/Numeral';
import { GLYPH_HEIGHT, layoutNumeral } from '@/features/clock/numerals';

import type { CalendarTheme } from '../calendar-theme';

type MonthHeaderProps = {
  /** Month name: "October", "Asoj". */
  title: string;
  year: number;
  /** Full name for assistive tech: "Asoj 2083". */
  label: string;
  /** A quieter second line, e.g. the Gregorian months a B.S. month spans. */
  subtitle?: string;
  theme: CalendarTheme;
  showToday: boolean;
  /** Type and control scale; 1 at the base layout size. */
  scale: number;
  /** Omitted at the ends of the covered range. */
  onPrevious?: () => void;
  onNext?: () => void;
  onToday: () => void;
};

const MONTH_SIZE = 30;
const YEAR_HEIGHT = 17;
const YEAR_STROKE = 2.4;

/** Month name, the year in dial numerals, and quiet month controls. */
export function MonthHeader({
  title,
  year,
  label,
  subtitle,
  theme,
  showToday,
  scale,
  onPrevious,
  onNext,
  onToday,
}: MonthHeaderProps) {
  const yearText = String(year);
  const yearHeight = YEAR_HEIGHT * scale;
  const yearStroke = YEAR_STROKE * scale;
  const yearWidth = (layoutNumeral(yearText).width / GLYPH_HEIGHT) * yearHeight + yearStroke * 2;
  const iconSize = Math.round(20 * Math.min(scale, 1.3));

  return (
    <View style={[styles.header, { minHeight: 48 * scale }]}>
      <View
        style={styles.titleBlock}
        accessibilityRole="header"
        accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
        accessible
      >
        <View style={styles.title}>
          <Text style={[styles.month, { color: theme.ink, fontSize: MONTH_SIZE * scale }]}>
            {title}
          </Text>
          <Svg
            width={yearWidth}
            height={yearHeight + yearStroke * 2}
            style={[styles.year, { marginLeft: 12 * scale, marginTop: 4 * scale }]}
          >
            <Numeral
              text={yearText}
              x={yearWidth / 2}
              y={(yearHeight + yearStroke * 2) / 2}
              height={yearHeight}
              strokeWidth={yearStroke}
              color={theme.accent}
            />
          </Svg>
        </View>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              { color: theme.muted, fontSize: 12 * Math.min(scale, 1.35), marginTop: 2 * scale },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
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
            <Text
              style={[
                styles.todayText,
                { color: theme.accent, fontSize: 13 * Math.min(scale, 1.3) },
              ]}
            >
              Today
            </Text>
          </Pressable>
        ) : null}
        <QuietIconButton
          icon={ChevronLeft}
          label="Previous month"
          onPress={onPrevious}
          disabled={!onPrevious}
          iconSize={iconSize}
          restOpacity={0.55}
          touchRestOpacity={0.7}
        />
        <QuietIconButton
          icon={ChevronRight}
          label="Next month"
          onPress={onNext}
          disabled={!onNext}
          iconSize={iconSize}
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
  },
  titleBlock: {
    flexShrink: 1,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  subtitle: {
    letterSpacing: 0.4,
  },
  month: {
    fontWeight: '300',
    letterSpacing: 0.2,
  },
  year: {
    alignSelf: 'center',
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
