import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { panelMaxWidth, type SidebarLayout } from '../sidebar-layout';

/**
 * The side panel, floated over the page: `date` at the top right and `list`
 * at the bottom right. Each is only as wide as its content, up to the
 * space beside the page's content (`contentWidth`, centred in
 * `layout.main`), so it never crowds or moves what the page shows.
 */
export function Sidebar({
  layout,
  contentWidth,
  date,
  list,
}: {
  layout: SidebarLayout;
  /** How wide the page's content actually is (a dial, the time, a month). */
  contentWidth: number;
  date?: ReactNode;
  list?: ReactNode;
}) {
  const box = layout.wide
    ? { right: layout.side, maxWidth: panelMaxWidth(layout, contentWidth) }
    : { right: layout.side, left: layout.side };
  return (
    <>
      {layout.showDate && date ? (
        <View style={[styles.corner, box, { top: layout.top }]}>{date}</View>
      ) : null}
      {layout.showEvents && list ? (
        <View style={[styles.corner, box, { bottom: layout.bottom }]}>{list}</View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Wide: no width of its own, so it takes its content's.
  corner: { position: 'absolute', alignItems: 'flex-end' },
});
