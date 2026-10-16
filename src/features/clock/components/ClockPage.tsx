import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useSettings } from '@/features/settings/SettingsProvider';
import type { ClockSize } from '@/features/settings/settings';

import { AnalogClock } from './AnalogClock';

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
  const { settings, dialTheme } = useSettings();
  const [area, setArea] = useState({ width: 0, height: 0 });

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
  };

  const size = area.width > 0 ? clockSizeFor(area.width, area.height, settings.size) : 0;

  return (
    <View style={[styles.page, { backgroundColor: dialTheme.page }]} onLayout={onLayout}>
      {size > 0 ? (
        <AnalogClock
          size={size}
          theme={dialTheme}
          movement={settings.movement}
          showSecondHand={settings.secondHand}
          paused={paused}
        />
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
