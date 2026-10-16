import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { BottomFade } from '@/features/pager/BottomFade';
import { swipeFriendlyScroll } from '@/features/pager/swipe-friendly-scroll';

import {
  addMonths,
  defaultWeekStart,
  isSameDay,
  isSameMonth,
  type CalendarDate,
} from '../calendar-date';
import { calendarTheme } from '../calendar-theme';
import { useToday } from '../use-today';
import { DayPanel } from './DayPanel';
import { MonthGrid } from './MonthGrid';
import { MonthHeader } from './MonthHeader';

type CalendarViewProps = {
  /** Space to keep clear for the overlaid controls (settings, page indicator). */
  bottomInset: number;
  topInset: number;
};

const PANEL_WIDTH = 240;
const COLUMN_GAP = 72;
const HEADER_BLOCK = 48 + 20 + 28; // header row, its margin, weekday labels

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Month view with the selected day beside it (wide screens) or below it
 * (narrow screens). Scrolls vertically when the screen is short; horizontal
 * swipes are left to the pager that switches between Clock and Calendar.
 */
export function CalendarView({ bottomInset, topInset }: CalendarViewProps) {
  const theme = calendarTheme;
  const today = useToday();
  const weekStart = useMemo(() => defaultWeekStart(), []);

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

  const wide = area.width >= 860 && area.height >= 560;
  const padding = wide ? 56 : 20;
  const usableHeight = area.height - topInset - bottomInset - padding * 2;

  const cellSize = wide
    ? Math.floor(
        clamp(
          Math.min(
            (area.width - padding * 2 - PANEL_WIDTH - COLUMN_GAP) / 7,
            (usableHeight - HEADER_BLOCK) / 6,
          ),
          44,
          76,
        ),
      )
    : Math.floor(clamp((area.width - padding * 2) / 7, 38, 84));

  const showToday = !isSameMonth({ ...visible, day: 1 }, today) || !isSameDay(selected, today);

  return (
    <View style={[styles.fill, { backgroundColor: theme.page }]} onLayout={onLayout}>
      {area.width > 0 ? (
        <ScrollView
          style={[styles.fill, swipeFriendlyScroll]}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topInset + padding,
              paddingBottom: bottomInset + padding,
              paddingHorizontal: padding,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={wide ? styles.wideRow : styles.narrowColumn}>
            <View style={{ width: cellSize * 7 }}>
              <MonthHeader
                year={visible.year}
                month={visible.month}
                theme={theme}
                showToday={showToday}
                onPrevious={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
                onToday={goToday}
              />
              <View style={styles.gridGap} />
              <MonthGrid
                year={visible.year}
                month={visible.month}
                selected={selected}
                today={today}
                weekStart={weekStart}
                cellSize={cellSize}
                theme={theme}
                onSelect={select}
              />
            </View>

            <View
              style={
                wide
                  ? { width: PANEL_WIDTH, marginLeft: COLUMN_GAP, paddingTop: 76 }
                  : { width: cellSize * 7, marginTop: 36, paddingHorizontal: cellSize * 0.18 }
              }
            >
              <DayPanel
                date={selected}
                isToday={isSameDay(selected, today)}
                theme={theme}
                numeralHeight={wide ? 64 : 44}
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
  wideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  narrowColumn: {
    alignItems: 'center',
  },
  gridGap: {
    height: 20,
  },
});
