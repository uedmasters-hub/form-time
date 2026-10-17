import { Children, useId, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { BottomFade } from '@/features/pager/BottomFade';
import { swipeFriendlyScroll } from '@/features/pager/swipe-friendly-scroll';

import { SIDEBAR_ROW } from '../sidebar-layout';

/**
 * A short window onto a list: `visible` rows show, the rest scroll
 * vertically, a row at a time. Rows are all one height, so the window
 * always ends on a whole row; a soft fade at its foot says there's more.
 */
export function ScrollRows({
  visible,
  pageColor,
  align = 'end',
  rowHeight = SIDEBAR_ROW,
  children,
}: {
  visible: number;
  /** The page colour, for the fade. */
  pageColor: string;
  align?: 'start' | 'end';
  /** Every row's height (the layout's row, scaled with the type). */
  rowHeight?: number;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  const shown = Math.min(rows.length, visible);
  const [offset, setOffset] = useState(0);
  // One gradient id per list (React's ids hold characters an SVG url() can't).
  const fadeId = `ft-rows-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const more = rows.length > visible && offset < (rows.length - visible) * rowHeight - 2;
  const cells = rows.map((row, i) => (
    <View
      key={i}
      style={[styles.cell, { height: rowHeight }, align === 'end' ? styles.end : styles.start]}
    >
      {row}
    </View>
  ));

  if (rows.length <= visible) return <View style={styles.list}>{cells}</View>;

  return (
    <View style={[styles.list, { height: shown * rowHeight }]}>
      <ScrollView
        style={[swipeFriendlyScroll, styles.bleed]}
        contentContainerStyle={styles.bleedContent}
        showsVerticalScrollIndicator={false}
        // Web: CSS snapping, a row at a time. Native: the same by interval.
        pagingEnabled={Platform.OS === 'web'}
        snapToInterval={Platform.OS === 'web' ? undefined : rowHeight}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.y)}
      >
        {cells}
      </ScrollView>
      {more ? <BottomFade height={10} color={pageColor} id={fadeId} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch' },
  cell: { justifyContent: 'center' },
  end: { alignItems: 'flex-end' },
  start: { alignItems: 'flex-start' },
  // Room for the rows' hover wash, which reaches 8 pt past the text.
  bleed: { marginHorizontal: -8 },
  bleedContent: { paddingHorizontal: 8 },
});
