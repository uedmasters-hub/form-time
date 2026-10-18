import { ArrowLeft, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { QuietIconButton } from '@/components/QuietIconButton';
import type { DayHoliday, HolidayKind } from '@/features/holidays/types';
import { BottomFade } from '@/features/pager/BottomFade';
import { swipeFriendlyScroll } from '@/features/pager/swipe-friendly-scroll';
import { RefreshScrollView } from '@/features/refresh/RefreshScrollView';
import type { RefreshOutcome } from '@/features/refresh/use-refresh-all';

import type { CalendarDate } from '../calendar-date';
import type { CalendarSystem } from '../calendar-system';
import type { CalendarTheme } from '../calendar-theme';
import { DayHeading } from './DayHeading';
import { describeHoliday, placeLabel, type DayItem } from './DayPanel';
import { InfoEmpty, InfoHeading, InfoRow } from './InfoList';

type DayDetailProps = {
  system: CalendarSystem;
  date: CalendarDate;
  isToday: boolean;
  holidays: DayHoliday[];
  kindLabels: Record<HolidayKind, string>;
  /** The user's own items on this day, in time order. */
  items: DayItem[];
  theme: CalendarTheme;
  topInset: number;
  /** Space kept clear at the foot for the page's controls. */
  bottomInset: number;
  reducedMotion: boolean;
  /**
   * Leave the day, once the closing transition is done: `toToday` from the
   * "Today" pill (the month comes back on today), else the day stays selected.
   */
  onClose: (toToday: boolean) => void;
  /** The day before (−1) or after (+1): the ← → keys. */
  onStep: (days: number) => void;
  onAdd: () => void;
  onOpenItem: (id: string) => void;
  onRefresh: () => Promise<RefreshOutcome>;
};

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const OPEN_MS = 280;
const CLOSE_MS = 220;
/** Drag right past this share of the width (or flick) to go back. */
const BACK_SHARE = 0.28;
const BACK_VELOCITY = 600;
/** The column's widest; wider screens centre it. */
const COLUMN_MAX = 560;
const SIDE = 20;
/** The top row, matching the corner controls' 44 pt band. */
const BAR = 44;
const PILL = 30;

/**
 * One day on its own page. Tapped in the month on a phone or tablet, it
 * slides in over the calendar: a "Today" pill to go back, the weekday, the
 * date as a large dial numeral and the month; then the day's events, with
 * a quiet + to add one, and its holidays and festivals. Back also with a
 * swipe to the right or Escape (the day stays selected). Pull down to refresh.
 */
export function DayDetail({
  system,
  date,
  isToday,
  holidays,
  kindLabels,
  items,
  theme,
  topInset,
  bottomInset,
  reducedMotion,
  onClose,
  onStep,
  onAdd,
  onOpenItem,
  onRefresh,
}: DayDetailProps) {
  const { width } = useWindowDimensions();
  const column = Math.min(COLUMN_MAX, width - SIDE * 2);
  // Type a step larger than the side panel's: this page is for reading.
  const scale = Math.min(1.3, Math.max(1.15, column / 360));
  const numeral = Math.round(Math.min(68, Math.max(48, column * 0.13)));

  // In from the right, out the same way.
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  const widthSv = useSharedValue(width);
  useEffect(() => {
    widthSv.set(width);
  }, [width, widthSv]);
  useEffect(() => {
    shown.set(reducedMotion ? 1 : withTiming(1, { duration: OPEN_MS, easing: EASE }));
  }, [shown, reducedMotion]);

  const closing = useRef(false);
  const close = useCallback(
    (toToday: boolean) => {
      if (closing.current) return;
      closing.current = true;
      if (reducedMotion) {
        onClose(toToday);
        return;
      }
      shown.set(
        withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onClose, toToday);
        }),
      );
    },
    [onClose, reducedMotion, shown],
  );
  const swipeBack = useCallback(() => close(false), [close]);

  const pageStyle = useAnimatedStyle(() => {
    const w = widthSv.get() || 1;
    const p = shown.get();
    const d = drag.get();
    return {
      opacity: p * (1 - (d / w) * 0.6),
      transform: [{ translateX: (1 - p) * 28 + d }],
    };
  });

  // Swipe right to go back (the pager is held while this page is open).
  const back = Gesture.Pan()
    .activeOffsetX(16)
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      drag.set(Math.max(0, event.translationX));
    })
    .onEnd((event) => {
      const w = widthSv.get();
      if (drag.get() > w * BACK_SHARE || event.velocityX > BACK_VELOCITY) {
        drag.set(withTiming(w * 0.6, { duration: 180, easing: EASE }));
        scheduleOnRN(swipeBack);
      } else {
        drag.set(withTiming(0, { duration: 220, easing: EASE }));
      }
    });

  // The day's content eases in when ← → change the day.
  const content = useSharedValue(1);
  const dayKey = `${date.year}-${date.month}-${date.day}`;
  const firstDay = useRef(dayKey);
  useEffect(() => {
    if (firstDay.current === dayKey || reducedMotion) return;
    firstDay.current = dayKey;
    content.set(0.35);
    content.set(withTiming(1, { duration: 220, easing: EASE }));
  }, [dayKey, content, reducedMotion]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.get() }));

  // Web: Escape goes back, ← → step the day — unless a sheet (the editor,
  // settings) is open over it, or the keys are for a text field.
  const backRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    (backRef.current as unknown as HTMLElement | null)?.focus?.({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') close(false);
      else if (event.key === 'ArrowLeft') onStep(-1);
      else if (event.key === 'ArrowRight') onStep(1);
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, onStep]);

  const longDate = system.longDate(date);
  const type = Math.min(scale, 1.35);
  const add = (
    <QuietIconButton
      icon={Plus}
      label={`Add event on ${longDate}`}
      hint="Event, meeting, note, follow-up or alarm"
      onPress={onAdd}
      iconSize={Math.round(22 * type)}
      style={items.length > 0 ? styles.addAside : styles.add}
    />
  );

  return (
    <Animated.View
      role="region"
      aria-label={`${longDate}${isToday ? ', today' : ''}`}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.page }, pageStyle]}
    >
      <GestureDetector gesture={back} touchAction="pan-y">
        <View style={styles.fill}>
          <RefreshScrollView
            onRefresh={onRefresh}
            theme={theme}
            indicatorTop={topInset + 12 + BAR}
            style={[styles.fill, swipeFriendlyScroll]}
            contentContainerStyle={[
              styles.content,
              { paddingTop: topInset + 12 + BAR + 28 * scale, paddingBottom: bottomInset + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[{ width: column }, contentStyle]}>
              <View
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${longDate}${isToday ? ', today' : ''}`}
              >
                <DayHeading
                  system={system}
                  date={date}
                  isToday={isToday}
                  theme={theme}
                  numeralHeight={numeral}
                  scale={scale}
                  align="start"
                />
              </View>

              <View style={{ marginTop: 36 * scale }}>
                <InfoHeading
                  label="Events"
                  theme={theme}
                  align="start"
                  scale={scale}
                  rule={false}
                  aside={items.length > 0 ? add : undefined}
                />
                {items.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <InfoEmpty text="Nothing planned." theme={theme} align="start" scale={scale} />
                    {add}
                  </View>
                ) : (
                  items.map((item) => (
                    <InfoRow
                      key={item.id}
                      kind={`${item.kindLabel} · ${item.when}`}
                      title={item.title}
                      detail={item.place ? placeLabel(item.place) : undefined}
                      theme={theme}
                      align="start"
                      scale={scale}
                      bell={item.hasReminder}
                      titleLines={2}
                      onPress={() => onOpenItem(item.id)}
                      accessibilityLabel={`${item.kindLabel}, ${item.when}: ${item.title}${
                        item.place ? `, ${item.place}` : ''
                      }${item.hasReminder ? ', reminder set' : ''}`}
                      accessibilityHint="Opens it to edit or delete"
                    />
                  ))
                )}
              </View>

              {holidays.length > 0 ? (
                <View style={{ marginTop: 24 * scale }}>
                  <InfoHeading
                    label="Holidays & festivals"
                    theme={theme}
                    align="start"
                    scale={scale}
                    rule={false}
                  />
                  {holidays.map((h, i) => (
                    <InfoRow
                      key={`${h.name}-${i}`}
                      kind={kindLabels[h.kind]}
                      title={h.name}
                      detail={describeHoliday(h).replace(/^, /, '') || undefined}
                      theme={theme}
                      align="start"
                      scale={scale}
                      titleLines={2}
                      kindColor={h.kind === 'public' ? theme.accent : theme.muted}
                      markColor={h.kind === 'public' ? theme.accent : theme.muted}
                      accessibilityLabel={`${kindLabels[h.kind]}: ${h.name}${describeHoliday(h)}`}
                    />
                  ))}
                </View>
              ) : null}
            </Animated.View>
          </RefreshScrollView>

          {/* "← Today": back to the month, on today. */}
          <View
            pointerEvents="box-none"
            style={[
              styles.bar,
              { paddingTop: topInset + 12, paddingBottom: 4, backgroundColor: theme.page },
            ]}
          >
            <View pointerEvents="box-none" style={[styles.barColumn, { width: column }]}>
              <Pressable
                ref={backRef}
                accessibilityRole="button"
                accessibilityLabel="Today"
                accessibilityHint="Back to the calendar, on today"
                onPress={() => close(true)}
                hitSlop={7}
                style={({ hovered, pressed }) => [
                  styles.pill,
                  {
                    borderColor: theme.accent,
                    opacity: hovered || pressed ? 1 : 0.8,
                  },
                  pressed && { backgroundColor: theme.hover },
                  pressed && styles.pressed,
                ]}
              >
                <ArrowLeft size={16} color={theme.accent} strokeWidth={1.5} />
                <Text style={[styles.pillText, { color: theme.accent }]}>Today</Text>
              </Pressable>
            </View>
          </View>

          <BottomFade height={bottomInset} color={theme.page} id="ft-day-fade" />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  barColumn: {
    height: BAR,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: PILL,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: PILL / 2,
    borderWidth: 1,
  },
  pillText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.6 },
  pressed: { transform: [{ scale: 0.97 }] },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // The 44 pt target overhangs, so the + lines up with the column's edge.
  add: { marginVertical: -12, marginRight: -12 },
  addAside: { marginVertical: -16, marginRight: -12 },
});
