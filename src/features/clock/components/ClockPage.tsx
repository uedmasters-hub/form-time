import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { defaultDialTheme } from '../dial-theme';
import { AnalogClock } from './AnalogClock';

const MAX_CLOCK_SIZE = 1000;

/**
 * Size the clock from the space this page actually has, measured after
 * layout. Reading the window size during render broke static web output:
 * the server rendered at 0×0 and the client never corrected it.
 */
function clockSizeFor(width: number, height: number) {
  const available = Math.min(width, height);
  const gutter = Math.max(16, available * 0.04);
  return Math.floor(Math.min(MAX_CLOCK_SIZE, available - gutter * 2));
}

type ClockPageProps = {
  /** Stop redrawing the hands while the page is fully off screen. */
  paused?: boolean;
};

export function ClockPage({ paused = false }: ClockPageProps) {
  const [size, setSize] = useState(0);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const next = clockSizeFor(nativeEvent.layout.width, nativeEvent.layout.height);
    setSize((current) => (current === next ? current : next));
  };

  return (
    <View style={styles.page} onLayout={onLayout}>
      {size > 0 ? <AnalogClock size={size} paused={paused} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: defaultDialTheme.page,
  },
});
