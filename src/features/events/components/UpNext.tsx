import { AlarmClock, Bell } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { formatDate } from '@/features/calendar/calendar-date';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { useSettings } from '@/features/settings/SettingsProvider';

import { useComposer } from '../ComposerProvider';
import { useEvents } from '../EventsProvider';
import { instantToWall, nextSlot, uses12Hour } from '../item-time';
import { KIND_LABEL } from '../types';
import { upNext, type Upcoming } from '../up-next';

/**
 * Beside the digital time: the date, the next alarm, and up to three
 * things coming up. A step down from the time in size and colour, so it
 * reads at a glance without competing. Tap an item to open it.
 */
export function UpNext({
  now,
  short = false,
}: {
  now: Date;
  /** Little height (a phone on its side): two items, without their places. */
  short?: boolean;
}) {
  const { uiTheme: ui, timeZone, settings } = useSettings();
  const { items } = useEvents();
  const { compose } = useComposer();
  const hour12 = uses12Hour();

  // Recomputed once a minute (and when items change), not every second.
  const minute = Math.floor(now.getTime() / 60_000);
  const next = useMemo(
    () => upNext(items, minute * 60_000, timeZone, { limit: short ? 2 : 3, hour12 }),
    [items, minute, timeZone, hour12, short],
  );

  const today = instantToWall(minute * 60_000, timeZone).date;
  const system = calendarSystemFor(settings.region, settings.nepalCalendar, today);
  const month = system.monthOf(today);
  const dayMonth =
    system.id === 'gregorian' || !month
      ? formatDate(today, { day: 'numeric', month: 'long' })
      : `${system.dayOf(today)} ${system.monthName(month)}`;
  const secondary = system.secondaryDate?.(today);
  const weekday = formatDate(today, { weekday: 'long' });

  const addNew = () => {
    const { date, time } = nextSlot(Date.now(), timeZone);
    compose({ mode: 'new', date, time });
  };

  return (
    <View style={styles.panel}>
      {/* The date */}
      <View accessible accessibilityRole="header" accessibilityLabel={`${weekday} ${dayMonth}`}>
        <Text style={[styles.weekday, { color: ui.accent }]}>{weekday.toLocaleUpperCase()}</Text>
        <Text style={[styles.date, { color: ui.ink }, short && styles.dateShort]}>{dayMonth}</Text>
        {secondary ? (
          <Text style={[styles.secondary, { color: ui.muted }]}>{secondary}</Text>
        ) : null}
      </View>

      {/* The next alarm */}
      {next.alarm ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next alarm ${next.alarm.when}${
            next.alarm.item.title && next.alarm.item.title !== 'Alarm'
              ? `, ${next.alarm.item.title}`
              : ''
          }`}
          onPress={() => next.alarm && compose({ mode: 'edit', item: next.alarm.item })}
          style={({ hovered, pressed }) => [
            styles.alarm,
            (hovered || pressed) && { backgroundColor: ui.hover },
          ]}
        >
          <AlarmClock size={15} color={ui.accent} strokeWidth={1.75} />
          <Text style={[styles.alarmTime, { color: ui.ink }]}>{next.alarm.when}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.rule, { backgroundColor: ui.hairline }, short && styles.ruleShort]} />

      <View style={styles.heading}>
        <Text style={[styles.label, { color: ui.muted }]} accessibilityRole="header">
          UP NEXT
        </Text>
        {next.more > 0 ? (
          <Text style={[styles.more, { color: ui.muted }]}>{`+${next.more} more`}</Text>
        ) : null}
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
            showPlace={!short}
            onPress={() => compose({ mode: 'edit', item: row.item })}
          />
        ))
      )}
    </View>
  );
}

function Row({
  row,
  showPlace,
  onPress,
}: {
  row: Upcoming;
  showPlace: boolean;
  onPress: () => void;
}) {
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
        <View style={[styles.mark, { backgroundColor: relative ? ui.accent : ui.ink }]} />
        <Text style={[styles.when, { color: ui.muted }]}>{when}</Text>
        {relative ? (
          <Text style={[styles.relative, { color: ui.accent }]}>
            {relative.toLocaleUpperCase()}
          </Text>
        ) : null}
        {item.remindAt ? <Bell size={11} color={ui.muted} strokeWidth={2} /> : null}
      </View>
      <Text style={[styles.title, { color: ui.ink }]} numberOfLines={1}>
        {item.title}
      </Text>
      {place && showPlace ? (
        <Text style={[styles.place, { color: ui.muted }]} numberOfLines={1}>
          {host ?? place}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch' },
  weekday: { fontSize: 11, fontWeight: '600', letterSpacing: 2 },
  date: { fontSize: 26, fontWeight: '300', letterSpacing: 0.2, marginTop: 4 },
  dateShort: { fontSize: 20, marginTop: 2 },
  secondary: { fontSize: 12, marginTop: 2 },
  alarm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: -8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alarmTime: { fontSize: 15, fontVariant: ['tabular-nums'] },
  rule: { height: StyleSheet.hairlineWidth, marginTop: 18, marginBottom: 14 },
  ruleShort: { marginTop: 10, marginBottom: 8 },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6 },
  more: { fontSize: 12 },
  empty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyText: { fontSize: 14 },
  row: { paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mark: { width: 6, height: 6 },
  when: { fontSize: 12, fontVariant: ['tabular-nums'] },
  relative: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  title: { fontSize: 16, marginTop: 3 },
  place: { fontSize: 12, marginTop: 1 },
});
