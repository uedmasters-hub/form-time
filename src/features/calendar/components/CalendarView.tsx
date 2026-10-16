import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useComposer } from '@/features/events/ComposerProvider';
import { useEvents } from '@/features/events/EventsProvider';
import { formatWallTime, instantToWall, placeIn } from '@/features/events/item-time';
import { KIND_LABEL, type CalendarItem } from '@/features/events/types';
import { holidaysByDay, kindLabels as kindLabelsFor } from '@/features/holidays/holidays';
import { QuietIconButton } from '@/components/QuietIconButton';
import { BottomFade } from '@/features/pager/BottomFade';
import { swipeFriendlyScroll } from '@/features/pager/swipe-friendly-scroll';
import { regionOf } from '@/features/region/regions';
import { useSettings } from '@/features/settings/SettingsProvider';

import { isSameDay, sixWeeksFrom, toISODate, type CalendarDate } from '../calendar-date';
import {
  calendarSystemFor,
  sameMonth,
  type CalendarSystemId,
  type MonthRef,
} from '../calendar-system';
import { useToday } from '../use-today';
import { NUMERAL_INSET } from './DayCell';
import { DayPanel, type DayItem } from './DayPanel';
import { MonthGrid } from './MonthGrid';
import { MonthHeader, TodayButton } from './MonthHeader';

type CalendarViewProps = {
  /** Space to keep clear for the overlaid controls (settings, page indicator). */
  bottomInset: number;
  topInset: number;
};

/** Sizes at scale 1, the reference layout with 76 pt day cells. */
const BASE_CELL = 76;
const PANEL_WIDTH = 240;
const COLUMN_GAP = 72;
const HEADER_BLOCK = 48 + 20 + 28; // header row, its margin, weekday labels
/** Lines the panel's first line up with the weekday labels' text. */
const WEEKDAY_TEXT_OFFSET = 8;
/**
 * Header type grows more slowly than the grid: big screens get bigger days,
 * not a shouting title.
 */
const HEADER_GROWTH = 0.3;
/** Grid width at which the narrow header's title is set at full size. */
const NARROW_TITLE_WIDTH = 400;
/** Height of the top-right region control, kept clear on narrow layouts. */
const TOP_CONTROL_BAND = 44;

/** Day-cell limits: wide layouts grow with the screen up to MAX_WIDE_CELL. */
const MIN_CELL = 44;
/** Below this, there's no room for a centred grid with the panel at the edge. */
const MIN_CENTERED_CELL = 60;
const MAX_WIDE_CELL = 124;
const MAX_NARROW_CELL = 84;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Month view centred on the page, with the selected day set apart at the
 * right edge (wide screens) or below the grid (narrow screens). "Today" and
 * the holidays follow the chosen region. Scrolls vertically when the screen
 * is short; horizontal swipes are left to the pager (Clock ↔ Calendar).
 */
export function CalendarView({ bottomInset, topInset }: CalendarViewProps) {
  const { uiTheme: theme, weekStart, settings, timeZone } = useSettings();
  const today = useToday(timeZone);
  // Nepal's calendar is Bikram Sambat: its months, not the Gregorian ones.
  const system = calendarSystemFor(settings.region, settings.nepalCalendar, today);

  const [selected, setSelected] = useState<CalendarDate>(today);
  // The month on screen, in the numbering of the system it was chosen in.
  const [view, setView] = useState<{ system: CalendarSystemId; month: MonthRef } | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });

  // After a switch of calendar, show the month holding the selected day (or
  // today, if the new calendar doesn't cover the selection).
  const coveredSelection = system.monthOf(selected) ? selected : today;
  const visible: MonthRef =
    view && view.system === system.id ? view.month : (system.monthOf(coveredSelection) as MonthRef);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
  };

  const select = useCallback(
    (date: CalendarDate) => {
      const month = system.monthOf(date);
      // Past the published range (Bikram Sambat), there's nothing to show.
      if (!month) return;
      setSelected(date);
      setView((v) =>
        v && v.system === system.id && sameMonth(v.month, month) ? v : { system: system.id, month },
      );
    },
    [system],
  );

  const previousMonth = system.shiftMonth(visible, -1);
  const nextMonth = system.shiftMonth(visible, 1);
  const showMonth = (month: MonthRef | null) => {
    if (month) setView({ system: system.id, month });
  };

  const goToday = () => select(today);

  // When "today" moves (midnight, or a region in another time zone) and the
  // selection was on the old today, follow it.
  const previousToday = useRef(today);
  useEffect(() => {
    const before = previousToday.current;
    previousToday.current = today;
    if (!isSameDay(before, today)) {
      setSelected((s) => (isSameDay(s, before) ? today : s));
      setView((v) =>
        v && sameMonth(v.month, system.monthOf(before))
          ? { system: system.id, month: system.monthOf(today) ?? v.month }
          : v,
      );
    }
  }, [today, system]);

  const filters = useMemo(
    () => ({
      public: settings.showPublicHolidays,
      restricted: settings.showRestrictedHolidays,
      festival: settings.showFestivals,
    }),
    [settings.showPublicHolidays, settings.showRestrictedHolidays, settings.showFestivals],
  );

  // Holidays for the six visible weeks, plus the selected day (which may be
  // in another month after paging).
  const { year: visibleYear, month: visibleMonth } = visible;
  const days = useMemo(
    () => sixWeeksFrom(system.firstDay({ year: visibleYear, month: visibleMonth }), weekStart),
    [system, visibleYear, visibleMonth, weekStart],
  );
  const gridHolidays = useMemo(
    () => holidaysByDay(settings.region, settings.area, days[0], days[41], filters),
    [days, settings.region, settings.area, filters],
  );
  const selectedHolidays = useMemo(
    () =>
      gridHolidays.get(toISODate(selected)) ??
      holidaysByDay(settings.region, settings.area, selected, selected, filters).get(
        toISODate(selected),
      ) ??
      [],
    [gridHolidays, selected, settings.region, settings.area, filters],
  );
  const kindLabels = kindLabelsFor(settings.region, settings.area);

  // The user's own items, placed on the days they fall on here.
  const { items } = useEvents();
  const { compose } = useComposer();
  const itemsByDay = useMemo(() => {
    const byDay = new Map<string, { item: CalendarItem; minutes: number; when: string }[]>();
    for (const item of items) {
      const placed = placeIn(item, timeZone);
      const list = byDay.get(placed.date) ?? [];
      list.push({
        item,
        minutes: placed.time ? placed.time.hours * 60 + placed.time.minutes : -1,
        when: placed.time ? formatWallTime(placed.time, placed.time.seconds !== 0) : 'All day',
      });
      byDay.set(placed.date, list);
    }
    for (const list of byDay.values()) list.sort((a, b) => a.minutes - b.minutes);
    return byDay;
  }, [items, timeZone]);
  const itemCounts = useMemo(
    () => new Map([...itemsByDay].map(([iso, list]) => [iso, list.length])),
    [itemsByDay],
  );
  const selectedItems: DayItem[] = (itemsByDay.get(toISODate(selected)) ?? []).map(
    ({ item, when }) => ({
      id: item.id,
      kindLabel: KIND_LABEL[item.kind],
      title: item.title,
      place: item.place,
      when,
      hasReminder: item.remindAt !== null,
    }),
  );
  const openItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) compose({ mode: 'edit', item });
  };
  // Today: the next whole hour (all day if that's tomorrow); other days: 9:00.
  const addToSelected = () => {
    let time: { hours: number; minutes: number; seconds: number } | null = {
      hours: 9,
      minutes: 0,
      seconds: 0,
    };
    if (isSameDay(selected, today)) {
      const next = instantToWall(Date.now(), timeZone).time.hours + 1;
      time = next < 24 ? { hours: next, minutes: 0, seconds: 0 } : null;
    }
    compose({ mode: 'new', date: selected, time });
  };

  // Wide: the grid is centred on the page and the day panel sits at the right
  // edge, so each side of the grid must leave room for panel + gap. Everything
  // beside the grid grows with the cells, so solve for the cell size that
  // fills the height, or the width, first.
  const widePadding = 56;
  const centeredCell = Math.floor(
    clamp(
      Math.min(
        (area.height - topInset - bottomInset - widePadding * 2) / (6 + HEADER_BLOCK / BASE_CELL),
        (area.width - widePadding * 2) / (7 + (2 * (PANEL_WIDTH + COLUMN_GAP)) / BASE_CELL),
      ),
      MIN_CELL,
      MAX_WIDE_CELL,
    ),
  );
  const wide = area.width >= 860 && area.height >= 560 && centeredCell >= MIN_CENTERED_CELL;
  const padding = wide ? widePadding : 20;

  const cellSize = wide
    ? centeredCell
    : Math.floor(clamp((area.width - padding * 2) / 7, 38, MAX_NARROW_CELL));

  // Type and spacing follow the cells: 1 at the reference size, larger on
  // big screens (phones keep the base size; tablets grow a little).
  const scale = wide ? clamp(cellSize / BASE_CELL, 1, 1.65) : clamp(cellSize / 64, 1, 1.3);
  // Phones: the title gives way so month, year and arrows fit on one line.
  const headerScale = wide
    ? 1 + (scale - 1) * HEADER_GROWTH
    : Math.min(1 + (scale - 1) * HEADER_GROWTH, (cellSize * 7) / NARROW_TITLE_WIDTH);
  // The title and panel start, and the month arrows end, where the dates do.
  const numeralInset = Math.round(cellSize * NUMERAL_INSET);
  const headerGap = 20 * headerScale;
  // Taller with a second line (B.S. months); the panel lines up below it.
  const subtitle = system.secondaryMonthLabel?.(visible);
  const headerHeight = (subtitle ? 54 : 48) * headerScale;

  const showToday = !sameMonth(visible, system.monthOf(today)) || !isSameDay(selected, today);

  return (
    <View style={[styles.fill, { backgroundColor: theme.page }]} onLayout={onLayout}>
      {area.width > 0 ? (
        <ScrollView
          style={[styles.fill, swipeFriendlyScroll]}
          contentContainerStyle={[
            styles.content,
            {
              // Narrow layouts: clear the region code in the top-right corner.
              paddingTop: topInset + padding + (wide ? 0 : TOP_CONTROL_BAND),
              paddingBottom: bottomInset + padding,
              paddingHorizontal: padding,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={wide ? styles.wideStage : styles.narrowColumn}>
            {/* The month — centred on the page */}
            <View style={{ width: cellSize * 7 }}>
              <MonthHeader
                title={system.monthName(visible)}
                year={visible.year}
                label={system.monthLabel(visible)}
                subtitle={subtitle}
                height={headerHeight}
                theme={theme}
                showToday={wide && showToday}
                scale={headerScale}
                insetStart={numeralInset}
                insetEnd={numeralInset}
                onPrevious={previousMonth ? () => showMonth(previousMonth) : undefined}
                onNext={nextMonth ? () => showMonth(nextMonth) : undefined}
                onToday={goToday}
                onAdd={wide ? addToSelected : undefined}
                addLabel={system.longDate(selected)}
              />
              <View style={{ height: headerGap }} />
              <MonthGrid
                system={system}
                month={visible}
                days={days}
                selected={selected}
                today={today}
                weekStart={weekStart}
                weekend={regionOf(settings.region).weekend}
                cellSize={cellSize}
                scale={scale}
                theme={theme}
                holidays={gridHolidays}
                kindLabels={kindLabels}
                itemCounts={itemCounts}
                onSelect={select}
              />
            </View>

            {/* The selected day — set apart at the right edge (wide) or below (narrow) */}
            <View
              style={
                wide
                  ? {
                      position: 'absolute',
                      right: 0,
                      top: headerHeight + headerGap + WEEKDAY_TEXT_OFFSET * scale,
                      width: PANEL_WIDTH * scale,
                    }
                  : {
                      width: cellSize * 7,
                      marginTop: 36 * scale,
                      paddingHorizontal: numeralInset,
                    }
              }
            >
              <DayPanel
                system={system}
                date={selected}
                isToday={isSameDay(selected, today)}
                holidays={selectedHolidays}
                kindLabels={kindLabels}
                theme={theme}
                numeralHeight={(wide ? 64 : 44) * scale}
                scale={scale}
                align={wide ? 'end' : 'start'}
                items={selectedItems}
                onOpenItem={openItem}
                actions={
                  wide ? undefined : (
                    <>
                      {showToday ? <TodayButton theme={theme} onPress={goToday} /> : null}
                      <QuietIconButton
                        icon={Plus}
                        label={`Add to ${system.longDate(selected)}`}
                        hint="Event, meeting, note, follow-up or alarm"
                        onPress={addToSelected}
                        restOpacity={0.8}
                        touchRestOpacity={0.85}
                      />
                    </>
                  )
                }
              />
            </View>
          </View>
        </ScrollView>
      ) : null}
      {/* Content scrolling under the overlaid controls fades out beneath them. */}
      <BottomFade height={bottomInset} color={theme.page} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideStage: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  narrowColumn: {
    alignItems: 'center',
  },
});
