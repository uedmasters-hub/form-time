import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { DayHoliday, HolidayKind } from '@/features/holidays/types';
import { useSwipeAwarePress } from '@/features/pager/pager-context';

import {
  addDays,
  isSameDay,
  startOfWeek,
  toISODate,
  weekday,
  weekdayNames,
  weekdayOrder,
  type CalendarDate,
  type Weekday,
} from '../calendar-date';
import { sameMonth, type CalendarSystem, type MonthRef } from '../calendar-system';
import type { CalendarTheme } from '../calendar-theme';
import { DayCell, type DayMarks } from './DayCell';

/** The grid's DOM id; the pager leaves arrow keys alone inside it. */
export const MONTH_GRID_ID = 'ft-month-grid';

type MonthGridProps = {
  /** Gregorian or Bikram Sambat: which days form the month and their numbers. */
  system: CalendarSystem;
  month: MonthRef;
  /** The six weeks on screen. */
  days: CalendarDate[];
  selected: CalendarDate;
  today: CalendarDate;
  weekStart: Weekday;
  /** The region's weekly days off. */
  weekend: readonly number[];
  cellSize: number;
  /** Type scale for the weekday labels; 1 at the base layout size. */
  scale: number;
  theme: CalendarTheme;
  /** Holidays by ISO date for the visible weeks. */
  holidays: Map<string, DayHoliday[]>;
  kindLabels: Record<HolidayKind, string>;
  /** How many of the user's own items fall on each ISO date. */
  itemCounts: Map<string, number>;
  onSelect: (date: CalendarDate) => void;
};

/**
 * Six fixed weeks, so the grid never changes height between months.
 *
 * Keyboard (web): arrows move by day or week, PageUp/PageDown by month
 * (with Shift, by year), Home/End to the start or end of the week. Only the
 * selected day is in the tab order; focus follows the selection.
 */
export function MonthGrid({
  system,
  month,
  days,
  selected,
  today,
  weekStart,
  weekend,
  cellSize,
  scale,
  theme,
  holidays,
  kindLabels,
  itemCounts,
  onSelect,
}: MonthGridProps) {
  const headers = useMemo(() => weekdayNames(weekStart, 'narrow'), [weekStart]);
  const weekendColumns = useMemo(
    () => weekdayOrder(weekStart).map((wd) => weekend.includes(wd)),
    [weekStart, weekend],
  );

  const cellRefs = useRef(new Map<string, View>());
  const containerRef = useRef<View>(null);
  const focusAfterMove = useRef(false);

  const select = useSwipeAwarePress(onSelect);

  // Keyboard navigation (web only; native has no grid keyboard model here).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let next: CalendarDate | null = null;
      switch (event.key) {
        case 'ArrowLeft':
          next = addDays(selected, -1);
          break;
        case 'ArrowRight':
          next = addDays(selected, 1);
          break;
        case 'ArrowUp':
          next = addDays(selected, -7);
          break;
        case 'ArrowDown':
          next = addDays(selected, 7);
          break;
        case 'PageUp':
          next = system.shiftDate(selected, event.shiftKey ? -12 : -1);
          break;
        case 'PageDown':
          next = system.shiftDate(selected, event.shiftKey ? 12 : 1);
          break;
        case 'Home':
          next = startOfWeek(selected, weekStart);
          break;
        case 'End':
          next = addDays(startOfWeek(selected, weekStart), 6);
          break;
      }
      if (!next) return;
      event.preventDefault();
      // Past the end of the covered range: stay put.
      if (!system.monthOf(next)) return;
      focusAfterMove.current = true;
      onSelect(next);
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [selected, weekStart, onSelect, system]);

  // Keep keyboard focus on the selected day after arrow-key moves.
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    cellRefs.current.get(toISODate(selected))?.focus();
  }, [selected, month]);

  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const groupLabel = system.monthLabel(month);
  const showGregorian = system.id !== 'gregorian';

  return (
    <View
      ref={containerRef}
      nativeID={MONTH_GRID_ID}
      role="group"
      accessibilityLabel={groupLabel}
      style={{ width: cellSize * 7 }}
    >
      <View
        style={styles.row}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {headers.map((name, i) => (
          <View key={i} style={[styles.header, { width: cellSize, height: 28 * scale }]}>
            <Text
              style={[
                styles.headerText,
                {
                  color: weekendColumns[i] ? theme.accent : theme.muted,
                  fontSize: 11 * Math.min(scale, 1.35),
                },
              ]}
            >
              {name.toLocaleUpperCase()}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={toISODate(week[0])} style={styles.row}>
          {week.map((date) => {
            const isSelected = isSameDay(date, selected);
            const isToday = isSameDay(date, today);
            const wd = weekday(date);
            const iso = toISODate(date);
            const dayHolidays = holidays.get(iso) ?? [];
            const mine = itemCounts.get(iso) ?? 0;
            const label =
              system.longDate(date) +
              (system.secondaryDate ? ` (${system.secondaryDate(date)})` : '') +
              (isToday ? ', today' : '') +
              dayHolidays.map((h) => `, ${kindLabels[h.kind]}: ${h.name}`).join('') +
              (mine ? `, ${mine} ${mine === 1 ? 'item' : 'items'} of yours` : '');
            const marks: DayMarks | undefined =
              dayHolidays.length || mine
                ? {
                    public: dayHolidays.some((h) => h.kind === 'public'),
                    other: dayHolidays.some((h) => h.kind !== 'public'),
                    mine: mine > 0,
                  }
                : undefined;
            return (
              <DayCell
                key={toISODate(date)}
                ref={(node: View | null) => {
                  if (node) cellRefs.current.set(toISODate(date), node);
                  else cellRefs.current.delete(toISODate(date));
                }}
                day={system.dayOf(date) ?? date.day}
                subDay={showGregorian ? date.day : undefined}
                size={cellSize}
                label={label}
                isToday={isToday}
                isSelected={isSelected}
                isOutsideMonth={!sameMonth(system.monthOf(date), month)}
                isWeekend={weekend.includes(wd)}
                isFocusTarget={isSelected}
                marks={marks}
                theme={theme}
                onPress={() => select(date)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontWeight: '500',
    letterSpacing: 1.6,
  },
});
