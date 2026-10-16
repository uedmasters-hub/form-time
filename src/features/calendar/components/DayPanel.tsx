import { Bell } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { Numeral } from '@/features/clock/components/Numeral';
import type { DayHoliday, HolidayKind } from '@/features/holidays/types';
import { GLYPH_HEIGHT, layoutNumeral } from '@/features/clock/numerals';

import { formatDate, type CalendarDate } from '../calendar-date';
import type { CalendarSystem } from '../calendar-system';
import type { CalendarTheme } from '../calendar-theme';

/** One of the user's own items on this day, ready to show. */
export type DayItem = {
  id: string;
  /** "Meeting", "Alarm". */
  kindLabel: string;
  title: string;
  /** "9:30 AM", or "All day". */
  when: string;
  hasReminder: boolean;
};

type DayPanelProps = {
  /** Numbers and names the day in this calendar (Gregorian or B.S.). */
  system: CalendarSystem;
  date: CalendarDate;
  isToday: boolean;
  /** Holidays and festivals on this day, public first. */
  holidays: DayHoliday[];
  kindLabels: Record<HolidayKind, string>;
  theme: CalendarTheme;
  /** Large date numeral height. */
  numeralHeight: number;
  /** Type scale for the labels; 1 at the base layout size. */
  scale?: number;
  /** 'end' sets the panel flush right, for the page's right edge. */
  align?: 'start' | 'end';
  /** The user's events, notes and reminders on this day, in time order. */
  items?: DayItem[];
  onOpenItem?: (id: string) => void;
  /** Controls set on the weekday line, at the far side (phones: Today, +). */
  actions?: ReactNode;
};

/**
 * The selected day, set like the dial: a large monoline numeral, the weekday
 * above it, and the day's holidays and festivals below a hairline.
 */
export function DayPanel({
  system,
  date,
  isToday,
  holidays,
  kindLabels,
  theme,
  numeralHeight,
  scale = 1,
  align = 'start',
  items = [],
  onOpenItem,
  actions,
}: DayPanelProps) {
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
    <View
      style={[styles.panel, end && styles.panelEnd]}
      // One summary for screen readers, unless it holds items to open.
      accessible={items.length === 0 && !actions}
      accessibilityLabel={`${system.longDate(date)}${secondary ? ` (${secondary})` : ''}${
        isToday ? ', today' : ''
      }. ${
        holidays.length
          ? holidays.map((h) => `${kindLabels[h.kind]}: ${h.name}${describe(h)}`).join('. ')
          : 'No holidays or festivals'
      }.`}
    >
      <View style={[styles.weekdayRow, actions ? styles.weekdayRowSpread : null]}>
        <Text
          style={[
            styles.weekday,
            { color: isToday ? theme.accent : theme.muted, fontSize: 11 * type },
            end && styles.textEnd,
          ]}
        >
          {(isToday ? `Today · ${weekdayName}` : weekdayName).toLocaleUpperCase()}
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

      <View
        style={[
          styles.rule,
          { backgroundColor: theme.hairline, marginTop: 24 * scale, marginBottom: 16 * scale },
        ]}
      />
      {items.map((item, i) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.kindLabel}, ${item.when}: ${item.title}${
            item.hasReminder ? ', reminder set' : ''
          }`}
          accessibilityHint="Opens it to edit or delete"
          onPress={() => onOpenItem?.(item.id)}
          style={({ hovered, pressed }) => [
            styles.item,
            {
              marginTop: i === 0 ? -6 * scale : 4 * scale,
              backgroundColor: hovered || pressed ? theme.hover : 'transparent',
            },
            end ? styles.itemEnd : styles.itemStart,
          ]}
        >
          <View style={[styles.itemMeta, end && styles.rowEnd]}>
            <View style={[styles.itemSquare, { backgroundColor: theme.ink }]} />
            <Text
              style={[styles.kind, { color: theme.muted, fontSize: 10 * type }]}
              numberOfLines={1}
            >
              {`${item.kindLabel} · ${item.when}`.toLocaleUpperCase()}
            </Text>
            {item.hasReminder ? (
              <Bell size={11 * type} color={theme.muted} strokeWidth={2} />
            ) : null}
          </View>
          <Text
            style={[
              styles.holidayName,
              { color: theme.ink, fontSize: 15 * type },
              end && styles.textEnd,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </Pressable>
      ))}
      {items.length > 0 ? (
        <View
          style={[
            styles.rule,
            { backgroundColor: theme.hairline, marginTop: 14 * scale, marginBottom: 16 * scale },
          ]}
        />
      ) : null}
      {holidays.length === 0 ? (
        <Text
          style={[styles.empty, { color: theme.muted, fontSize: 13 * type }, end && styles.textEnd]}
        >
          No holidays or festivals
        </Text>
      ) : (
        holidays.map((h, i) => (
          <View
            key={`${h.name}-${i}`}
            style={[
              styles.holiday,
              { marginTop: i === 0 ? 0 : 14 * scale },
              end && styles.panelEnd,
            ]}
          >
            <Text
              style={[
                styles.kind,
                {
                  color: h.kind === 'public' ? theme.accent : theme.muted,
                  fontSize: 10 * type,
                },
                end && styles.textEnd,
              ]}
            >
              {kindLabels[h.kind].toLocaleUpperCase()}
            </Text>
            <Text
              style={[
                styles.holidayName,
                { color: theme.ink, fontSize: 15 * type },
                end && styles.textEnd,
              ]}
            >
              {h.name}
            </Text>
            {describe(h) ? (
              <Text
                style={[
                  styles.holidayNote,
                  { color: theme.muted, fontSize: 12 * type },
                  end && styles.textEnd,
                ]}
              >
                {describe(h).replace(/^, /, '')}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

/** ", day 6 of 9 · Kathmandu Valley only" — or "" when there's nothing to add. */
function describe(h: DayHoliday): string {
  const parts = [h.dayOf ? `day ${h.dayOf[0]} of ${h.dayOf[1]}` : '', h.note ?? ''].filter(Boolean);
  if (!parts.length) return '';
  const text = parts.join(' · ');
  return `, ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'flex-start',
  },
  panelEnd: {
    alignItems: 'flex-end',
  },
  textEnd: {
    textAlign: 'right',
  },
  weekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekdayRowSpread: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  // 44 pt targets on an 11 pt line: let them overhang so the line keeps its height.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: -16,
    marginRight: -12,
  },
  weekday: {
    fontWeight: '500',
    letterSpacing: 2,
  },
  numeral: {
    marginHorizontal: -2,
  },
  monthYear: {
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  secondary: {
    letterSpacing: 0.3,
  },
  rule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    letterSpacing: 0.3,
  },
  item: {
    alignSelf: 'stretch',
    paddingVertical: 6,
    borderRadius: 10,
  },
  // The hover wash reaches past the text, so the text stays on the date's line.
  itemStart: {
    alignItems: 'flex-start',
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  itemEnd: {
    alignItems: 'flex-end',
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowEnd: {
    justifyContent: 'flex-end',
  },
  itemSquare: {
    width: 5,
    height: 5,
  },
  holiday: {
    alignItems: 'flex-start',
  },
  kind: {
    fontWeight: '600',
    letterSpacing: 1.6,
  },
  holidayName: {
    marginTop: 3,
    fontWeight: '400',
  },
  holidayNote: {
    marginTop: 2,
    lineHeight: 17,
  },
});
