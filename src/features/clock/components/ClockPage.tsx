import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useComposer } from '@/features/events/ComposerProvider';
import { ClockTimePicker } from '@/features/events/components/ClockTimePicker';
import { UpNext } from '@/features/events/components/UpNext';
import { nextSlot, uses12Hour } from '@/features/events/item-time';
import { useSettings } from '@/features/settings/SettingsProvider';
import type { ClockSize } from '@/features/settings/settings';

import { AnalogClock } from './AnalogClock';
import { DigitalClock } from './DigitalClock';

const MAX_CLOCK_SIZE = 1000;
/** Compact shows the clock at this share of the classic size. */
const COMPACT_SCALE = 0.62;

/**
 * Size the clock from the space this page actually has, measured after
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

  const size = area.width > 0 ? clockSizeFor(area.width, area.height, settings.size) : 0;

  if (settings.face === 'digital') {
    return (
      <View style={[styles.page, { backgroundColor: dialTheme.page }]} onLayout={onLayout}>
        {area.width > 0 ? (
          <DigitalClock
            width={area.width}
            // Keep clear of the corner controls above and below.
            height={area.height - 120}
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
            aside={(now, { short }) => <UpNext now={now} short={short} />}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: dialTheme.page }]} onLayout={onLayout}>
      {size > 0 ? (
        // Point at the dial to add something at that time.
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
