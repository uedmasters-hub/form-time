import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SettingsButton from '@/components/SettingsButton';
import { CalendarView } from '@/features/calendar/components/CalendarView';
import { calendarTheme } from '@/features/calendar/calendar-theme';
import { ClockPage } from '@/features/clock/components/ClockPage';
import { PageIndicator } from '@/features/pager/PageIndicator';
import { PagerGestureProvider } from '@/features/pager/pager-context';
import { SwipePager } from '@/features/pager/SwipePager';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const VIEWS = ['Clock', 'Calendar'] as const;
const CLOCK = 0;

/** Space at the bottom of each view kept clear for the overlaid controls. */
const CONTROL_BAND = 64;
const EDGE = 12;

/**
 * Home: the clock, with the calendar one swipe to the right. No navigation
 * bar — a settings icon and a two-capsule indicator sit quietly at the foot.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  const [page, setPage] = useState(CLOCK);
  // True while a finger/pointer is moving the pages, so the clock keeps
  // running whenever any part of it can be on screen.
  const [swiping, setSwiping] = useState(false);

  const onIndexChange = useCallback((next: number) => {
    setPage(next);
    setSwiping(false);
  }, []);
  const onSwipeStart = useCallback(() => setSwiping(true), []);

  return (
    <PagerGestureProvider>
      <View style={styles.screen}>
        <SwipePager
          index={page}
          onIndexChange={onIndexChange}
          onSwipeStart={onSwipeStart}
          progress={progress}
          reducedMotion={reducedMotion}
        >
          <ClockPage paused={page !== CLOCK && !swiping} />
          <CalendarView topInset={insets.top} bottomInset={insets.bottom + CONTROL_BAND} />
        </SwipePager>

        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <SettingsButton
            style={{
              position: 'absolute',
              left: insets.left + EDGE,
              bottom: insets.bottom + EDGE,
            }}
          />
          <View
            pointerEvents="box-none"
            style={[styles.indicatorRow, { bottom: insets.bottom + EDGE }]}
          >
            <PageIndicator
              labels={[...VIEWS]}
              index={page}
              progress={progress}
              onSelect={onIndexChange}
              activeColor={calendarTheme.accent}
              idleColor={calendarTheme.lumeEdge}
            />
          </View>
        </View>
      </View>
    </PagerGestureProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: calendarTheme.page,
    overflow: 'hidden',
  },
  indicatorRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
