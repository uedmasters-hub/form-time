import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { DayHeading } from '@/features/calendar/components/DayHeading';
import {
  InfoAside,
  InfoEmpty,
  InfoHeading,
  InfoRow,
} from '@/features/calendar/components/InfoList';
import { useSettings } from '@/features/settings/SettingsProvider';

import { useComposer } from '../ComposerProvider';
import { useEvents } from '../EventsProvider';
import { instantToWall, nextSlot, uses12Hour } from '../item-time';
import { KIND_LABEL } from '../types';
import { upNext, type Upcoming } from '../up-next';

/**
 * The digital watch's corners. Top right: today, set exactly like the
 * calendar's day panel. Bottom right: what's coming up, soonest first.
 * Both sit flush right and a step down from the time, so they read at a
 * glance and never move it.
 */
export function WatchDate({ now, numeralHeight }: { now: Date; numeralHeight: number }) {
  const { uiTheme: ui, timeZone, settings } = useSettings();
  const today = instantToWall(Math.floor(now.getTime() / 60_000) * 60_000, timeZone).date;
  const system = calendarSystemFor(settings.region, settings.nepalCalendar, today);
  const secondary = system.secondaryDate?.(today);
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${system.longDate(today)}${secondary ? ` (${secondary})` : ''}`}
    >
      <DayHeading
        system={system}
        date={today}
        isToday
        todayPrefix={false}
        theme={ui}
        numeralHeight={numeralHeight}
        align="end"
      />
    </View>
  );
}

export function WatchUpcoming({ now, limit }: { now: Date; limit: number }) {
  const { uiTheme: ui, timeZone } = useSettings();
  const { items } = useEvents();
  const { compose } = useComposer();
  const hour12 = uses12Hour();

  // Recomputed once a minute (and when items change), not every second.
  const minute = Math.floor(now.getTime() / 60_000);
  const next = useMemo(
    () => upNext(items, minute * 60_000, timeZone, { limit, hour12 }),
    [items, minute, timeZone, hour12, limit],
  );

  const addNew = () => {
    const { date, time } = nextSlot(Date.now(), timeZone);
    compose({ mode: 'new', date, time });
  };

  return (
    <View style={styles.list}>
      <InfoHeading
        label="Up next"
        theme={ui}
        aside={next.more > 0 ? <InfoAside text={`+${next.more} more`} theme={ui} /> : undefined}
      />

      {next.rows.length === 0 ? (
        <InfoEmpty text="Nothing else today." theme={ui}>
          <TextButton label="+ Add" tone="accent" onPress={addNew} a11yLabel="Add something" />
        </InfoEmpty>
      ) : (
        next.rows.map((row) => (
          <Row
            key={row.item.id}
            row={row}
            onPress={() => compose({ mode: 'edit', item: row.item })}
          />
        ))
      )}
    </View>
  );
}

/** One item, set like the calendar's day panel: "■ MEETING · 10:00 AM", then the title. */
function Row({ row, onPress }: { row: Upcoming; onPress: () => void }) {
  const { uiTheme: ui } = useSettings();
  const { item, when, relative } = row;
  const place = item.place.trim();
  const host = /^https?:\/\/([^/?#]+)/i.exec(place)?.[1]?.replace(/^www\./, '');
  return (
    <InfoRow
      kind={`${KIND_LABEL[item.kind]} · ${when}`}
      title={item.title}
      detail={place ? (host ?? place) : undefined}
      theme={ui}
      lead={relative ?? undefined}
      markColor={relative ? ui.accent : ui.ink}
      bell={!!item.remindAt}
      onPress={onPress}
      accessibilityLabel={`${KIND_LABEL[item.kind]}, ${when}${relative ? `, ${relative}` : ''}: ${
        item.title
      }${place ? `, ${host ?? place}` : ''}`}
      accessibilityHint="Opens it"
    />
  );
}

/** Height one row needs (meta line, title, place), for reserving space. */
export const UPCOMING_ROW_HEIGHT = 66;
/** The "UP NEXT" line above the rows. */
export const UPCOMING_HEADING_HEIGHT = 32;

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', alignItems: 'flex-end' },
});
