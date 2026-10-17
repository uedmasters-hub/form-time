import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useComposer } from '@/features/events/ComposerProvider';
import { ClockTimePicker } from '@/features/events/components/ClockTimePicker';
import { TodaySidebar } from '@/features/events/components/UpNext';
import { nextSlot, uses12Hour } from '@/features/events/item-time';
import { useSettings } from '@/features/settings/SettingsProvider';
import type { ClockSize } from '@/features/settings/settings';
import { sidebarLayout, type SidebarLayout } from '@/features/sidebar/sidebar-layout';

import { AnalogClock } from './AnalogClock';
import { DigitalClock } from './DigitalClock';

const MAX_CLOCK_SIZE = 1000;
/** Compact shows the clock at this share of the classic size. */
const COMPACT_SCALE = 0.62;
/** Phones: the dial keeps at least this share of the page's width. */
const MIN_PHONE_DIAL = 0.75;

/**
 * Size the clock from the space this page leaves it, measured after
 * layout. Reading the window size during render broke static web output:
 * the server rendered at 0×0 and the client never corrected it.
 */
function clockSizeFor(width: number, height: number, size: ClockSize) {
  const available = Math.min(width, height);
  const gutter = Math.max(16, available * 0.04);
  const classic = Math.min(MAX_CLOCK_SIZE, available - gutter * 2);
  return Math.floor(size === 'compact' ? classic * COMPACT_SCALE : classic);
}

type ClockPageProps = {
  /** Stop redrawing the hands while the page is fully off screen. */
  paused?: boolean;
};

export function ClockPage({ paused = false }: ClockPageProps) {
  const { settings, dialTheme, uiTheme, timeZone } = useSettings();
  const { compose } = useComposer();
  const [area, setArea] = useState({ width: 0, height: 0 });

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
  };

  // The clock is centred in `main`, which the side panel never changes; the
  // panel (today, what's next, festivals) floats beside it. The digital face
  // shows one upcoming item at a time, the analog up to three (two on
  // phones, or one where the dial would otherwise get too small).
  const digital = settings.face === 'digital';
  const panel = { showDate: settings.showDayDate, showEvents: settings.showDayEvents };
  let layout = sidebarLayout(area.width, area.height, { ...panel, eventRows: digital ? 1 : 3 });
  if (!digital && !layout.wide) {
    const dialIn = (l: SidebarLayout) =>
      clockSizeFor(
        area.width - l.main.left - l.main.right,
        area.height - l.main.top - l.main.bottom,
        'classic',
      );
    layout = sidebarLayout(area.width, area.height, { ...panel, eventRows: 2 });
    if (dialIn(layout) < (area.width - layout.side * 2) * MIN_PHONE_DIAL) {
      layout = sidebarLayout(area.width, area.height, { ...panel, eventRows: 1 });
    }
  }
  const { main } = layout;
  // The digital time reports its width once laid out; until then, assume it
  // fills its area, so the panel starts out clear of it.
  const [timeWidth, setTimeWidth] = useState(0);
  const size =
    area.width > 0
      ? clockSizeFor(
          area.width - main.left - main.right,
          area.height - main.top - main.bottom,
          settings.size,
        )
      : 0;

  if (settings.face === 'digital') {
    return (
      <View style={[styles.page, { backgroundColor: dialTheme.page }]} onLayout={onLayout}>
        {area.width > 0 ? (
          <DigitalClock
            width={area.width}
            height={area.height}
            layout={layout}
            theme={dialTheme}
            timeZone={timeZone}
            hour12={uses12Hour()}
            showSeconds={settings.secondHand}
            compact={settings.size === 'compact'}
            flat={!settings.depth}
            paused={paused}
            onPressTime={() => {
              const { date, time } = nextSlot(Date.now(), timeZone);
              compose({ mode: 'new', date, time });
            }}
            onTimeWidth={(w) => setTimeWidth((t) => (Math.abs(t - w) < 1 ? t : w))}
          />
        ) : null}
        {area.width > 0 ? (
          <TodaySidebar
            layout={layout}
            contentWidth={timeWidth || area.width - main.left - main.right}
            paused={paused}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: dialTheme.page }]} onLayout={onLayout}>
      {size > 0 ? (
        <View style={[styles.main, main]}>
          {/* Point at the dial to add something at that time. */}
          <ClockTimePicker size={size} dialTheme={dialTheme} ui={uiTheme} timeZone={timeZone}>
            <AnalogClock
              size={size}
              theme={dialTheme}
              movement={settings.movement}
              showSecondHand={settings.secondHand}
              timeZone={timeZone}
              paused={paused}
              flat={!settings.depth}
            />
          </ClockTimePicker>
        </View>
      ) : null}
      {area.width > 0 ? <TodaySidebar layout={layout} contentWidth={size} paused={paused} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The dial's own area, beside or between the side panel's halves. */
  main: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
