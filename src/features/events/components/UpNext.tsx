import { Bell } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { DayHeading } from '@/features/calendar/components/DayHeading';
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
      <View style={[styles.heading, { borderColor: ui.hairline }]}>
        {next.more > 0 ? (
          <Text style={[styles.more, { color: ui.muted }]}>{`+${next.more} more`}</Text>
        ) : (
          <View />
        )}
        <Text style={[styles.label, { color: ui.muted }]} accessibilityRole="header">
          UP NEXT
        </Text>
      </View>

      {next.rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: ui.muted }]}>Nothing else today.</Text>
          <TextButton label="+ Add" tone="accent" onPress={addNew} a11yLabel="Add something" />
        </View>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${KIND_LABEL[item.kind]}, ${when}${relative ? `, ${relative}` : ''}: ${
        item.title
      }${place ? `, ${host ?? place}` : ''}`}
      accessibilityHint="Opens it"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.row,
        (hovered || pressed) && { backgroundColor: ui.hover },
      ]}
    >
      <View style={styles.meta}>
        {relative ? (
          <Text style={[styles.relative, { color: ui.accent }]}>
            {relative.toLocaleUpperCase()}
          </Text>
        ) : null}
        {item.remindAt ? <Bell size={11} color={ui.muted} strokeWidth={2} /> : null}
        <View style={[styles.mark, { backgroundColor: relative ? ui.accent : ui.ink }]} />
        <Text style={[styles.kind, { color: ui.muted }]} numberOfLines={1}>
          {`${KIND_LABEL[item.kind]} · ${when}`.toLocaleUpperCase()}
        </Text>
      </View>
      <Text style={[styles.title, { color: ui.ink }]} numberOfLines={1}>
        {item.title}
      </Text>
      {place ? (
        <Text style={[styles.place, { color: ui.muted }]} numberOfLines={1}>
          {host ?? place}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Height one row needs (meta line, title, place), for reserving space. */
export const UPCOMING_ROW_HEIGHT = 66;
/** The "UP NEXT" line above the rows. */
export const UPCOMING_HEADING_HEIGHT = 32;

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', alignItems: 'flex-end' },
  heading: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 12,
    marginBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6 },
  more: { fontSize: 12 },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: -12,
  },
  emptyText: { fontSize: 14 },
  row: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'flex-end' },
  mark: { width: 5, height: 5 },
  kind: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4 },
  relative: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  title: { fontSize: 16, marginTop: 3, textAlign: 'right' },
  place: { fontSize: 12, marginTop: 1, textAlign: 'right' },
});
