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
  /** Type and control scale; 1 at the base layout size. */
  scale: number;
  /** Row height; the calendar uses it to line up the day panel. */
  height: number;
  /** Space before the title and after the arrows, to line up with the dates. */
  insetStart?: number;
  insetEnd?: number;
  /** Omitted at the ends of the covered range. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** Back to today's month and date; given while another day or month is shown. */
  onToday?: () => void;
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
  scale,
  height,
  insetStart = 0,
  insetEnd = 0,
  onPrevious,
  onNext,
  onToday,
}: MonthHeaderProps) {
  const yearText = String(year);
  const yearHeight = YEAR_HEIGHT * scale;
  const yearStroke = YEAR_STROKE * scale;
  const yearWidth = (layoutNumeral(yearText).width / GLYPH_HEIGHT) * yearHeight + yearStroke * 2;
  const iconSize = Math.round(20 * Math.min(Math.max(scale, 1), 1.3));
  // The arrow icon sits centred in a 44 pt target; end the icon, not the
  // target, at the inset.
  const iconInset = (44 - iconSize) / 2;

  return (
    <View
      style={[
        styles.header,
        {
          height,
          paddingLeft: insetStart,
          paddingRight: Math.max(0, insetEnd - iconInset),
        },
      ]}
    >
      {/* The month's name; while another month or day is shown, a tap returns to today. */}
      <Pressable
        style={({ hovered, pressed }) => [
          styles.titleBlock,
          onToday && (hovered || pressed) ? { opacity: 0.72 } : null,
        ]}
        accessibilityRole={onToday ? 'button' : 'header'}
        accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
        accessibilityHint={onToday ? 'Goes to today' : undefined}
        accessible
        disabled={!onToday}
        onPress={onToday}
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
      </Pressable>

      <View style={styles.controls}>
        <QuietIconButton
          icon={ChevronLeft}
          label="Previous month"
          onPress={onPrevious}
          disabled={!onPrevious}
          iconSize={iconSize}
        />
        <QuietIconButton
          icon={ChevronRight}
          label="Next month"
          onPress={onNext}
          disabled={!onNext}
          iconSize={iconSize}
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
});
