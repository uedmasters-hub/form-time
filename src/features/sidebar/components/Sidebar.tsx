import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomFade } from '@/features/pager/BottomFade';
import { swipeFriendlyScroll } from '@/features/pager/swipe-friendly-scroll';

import { SIDEBAR_BOTTOM, SIDEBAR_TOP, type SidebarLayout } from '../sidebar-layout';

/**
 * The side panel, placed by `sidebarLayout`: `date` at the top right and
 * `list` at the bottom right, flush with the page's right edge. Lay it over
 * the page; the page keeps its own content inside `layout.main`.
 */
export function Sidebar({
  layout,
  date,
  list,
  scrollList = false,
  pageColor,
}: {
  layout: SidebarLayout;
  date?: ReactNode;
  list?: ReactNode;
  /** Let a long list scroll in the space it has (wide), instead of sizing it to fit. */
  scrollList?: boolean;
  /** The page colour, for the fade that shows there's more below. */
  pageColor?: string;
}) {
  const box = { right: layout.side, width: layout.column };
  // A long list fades out at the foot while there's more below to scroll to.
  const [scroll, setScroll] = useState({ box: 0, content: 0, offset: 0 });
  const more = scroll.content - scroll.offset - scroll.box > 2;
  return (
    <>
      {layout.showDate && date ? (
        <View style={[styles.corner, box, { top: SIDEBAR_TOP }]}>{date}</View>
      ) : null}
      {layout.showEvents && list ? (
        <View
          style={[
            styles.corner,
            box,
            { bottom: SIDEBAR_BOTTOM },
            scrollList && { maxHeight: layout.listMax },
          ]}
        >
          {scrollList ? (
            <>
              <ScrollView
                style={[swipeFriendlyScroll, styles.bleed]}
                contentContainerStyle={styles.scrolled}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={32}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  setScroll((s) => (s.box === h ? s : { ...s, box: h }));
                }}
                onContentSizeChange={(_, h) =>
                  setScroll((s) => (s.content === h ? s : { ...s, content: h }))
                }
                onScroll={(e) => {
                  const y = e.nativeEvent.contentOffset.y;
                  setScroll((s) => (s.offset === y ? s : { ...s, offset: y }));
                }}
              >
                {list}
              </ScrollView>
              {more && pageColor ? (
                <BottomFade height={36} color={pageColor} id="ft-sidebar-fade" />
              ) : null}
            </>
          ) : (
            list
          )}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute' },
  // Room for the rows' hover wash, which reaches 8 pt past the text.
  bleed: { marginHorizontal: -8 },
  scrolled: { paddingHorizontal: 8 },
});
