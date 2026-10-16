import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { holidaysByDay, KIND_LABELS } from '@/features/holidays/holidays';
import { BottomFade } from '@/features/pager/BottomFade';
import { swipeFriendlyScroll } from '@/features/pager/swipe-friendly-scroll';
import { useSettings } from '@/features/settings/SettingsProvider';

import {
  addMonths,
  isSameDay,
  isSameMonth,
  monthGrid,
  toISODate,
  type CalendarDate,
} from '../calendar-date';
import { useToday } from '../use-today';
import { DayPanel } from './DayPanel';
import { MonthGrid } from './MonthGrid';
import { MonthHeader } from './MonthHeader';

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
const PANEL_OFFSET = 76; // lines the panel's first line up with the weekday labels
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

  const [selected, setSelected] = useState<CalendarDate>(today);
  const [visible, setVisible] = useState({ year: today.year, month: today.month });
  const [area, setArea] = useState({ width: 0, height: 0 });

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
  };

  const select = useCallback((date: CalendarDate) => {
    setSelected(date);
    setVisible((v) =>
      v.year === date.year && v.month === date.month ? v : { year: date.year, month: date.month },
    );
  }, []);

  const shiftMonth = (months: number) =>
    setVisible((v) => {
      const next = addMonths({ ...v, day: 1 }, months);
      return { year: next.year, month: next.month };
    });

  const goToday = () => select(today);

  // When "today" moves (midnight, or a region in another time zone) and the
  // selection was on the old today, follow it.
  const previousToday = useRef(today);
  useEffect(() => {
    const before = previousToday.current;
    previousToday.current = today;
    if (!isSameDay(before, today)) {
      setSelected((s) => (isSameDay(s, before) ? today : s));
      setVisible((v) =>
        v.year === before.year && v.month === before.month
          ? { year: today.year, month: today.month }
          : v,
      );
    }
  }, [today]);

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
  const gridHolidays = useMemo(() => {
    const days = monthGrid(visible.year, visible.month, weekStart);
    return holidaysByDay(settings.region, settings.area, days[0], days[41], filters);
  }, [visible, weekStart, settings.region, settings.area, filters]);
  const selectedHolidays = useMemo(
    () =>
      gridHolidays.get(toISODate(selected)) ??
      holidaysByDay(settings.region, settings.area, selected, selected, filters).get(
        toISODate(selected),
      ) ??
      [],
    [gridHolidays, selected, settings.region, settings.area, filters],
  );
  const kindLabels = KIND_LABELS[settings.region];

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

  const showToday = !isSameMonth({ ...visible, day: 1 }, today) || !isSameDay(selected, today);

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
                year={visible.year}
                month={visible.month}
                theme={theme}
                showToday={showToday}
                scale={scale}
                onPrevious={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
                onToday={goToday}
              />
              <View style={{ height: 20 * scale }} />
              <MonthGrid
                year={visible.year}
                month={visible.month}
                selected={selected}
                today={today}
                weekStart={weekStart}
                cellSize={cellSize}
                scale={scale}
                theme={theme}
                holidays={gridHolidays}
                kindLabels={kindLabels}
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
                      top: PANEL_OFFSET * scale,
                      width: PANEL_WIDTH * scale,
                    }
                  : {
                      width: cellSize * 7,
                      marginTop: 36 * scale,
                      paddingHorizontal: cellSize * 0.18,
                    }
              }
            >
              <DayPanel
                date={selected}
                isToday={isSameDay(selected, today)}
                holidays={selectedHolidays}
                kindLabels={kindLabels}
                theme={theme}
                numeralHeight={(wide ? 64 : 44) * scale}
                scale={scale}
                align={wide ? 'end' : 'start'}
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
