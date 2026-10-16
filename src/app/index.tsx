import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import SettingsButton from '@/components/SettingsButton';
import { AnalogClock } from '@/features/clock/components/AnalogClock';
import { defaultDialTheme } from '@/features/clock/dial-theme';

const MAX_CLOCK_SIZE = 1000;

/**
 * Size the clock from the space this screen actually has, measured after
 * layout. Reading the window size during render broke static web output:
 * the server rendered at 0×0 and the client never corrected it.
 */
function clockSizeFor(width: number, height: number) {
  const available = Math.min(width, height);
  const gutter = Math.max(16, available * 0.04);
  return Math.floor(Math.min(MAX_CLOCK_SIZE, available - gutter * 2));
}

export default function ClockScreen() {
  const [size, setSize] = useState(0);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const next = clockSizeFor(nativeEvent.layout.width, nativeEvent.layout.height);
    setSize((current) => (current === next ? current : next));
  };

  return (
    <View style={styles.screen} onLayout={onLayout}>
      {size > 0 ? <AnalogClock size={size} /> : null}
      <SettingsButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: defaultDialTheme.page,
    overflow: 'hidden',
  },
});
