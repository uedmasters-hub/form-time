import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { toISODate } from '@/features/calendar/calendar-date';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { DayHeading } from '@/features/calendar/components/DayHeading';
import { useDayNav } from '@/features/calendar/day-nav';
import { useSwipeAwarePress } from '@/features/pager/pager-context';
import { HolidayList } from '@/features/calendar/components/DayPanel';
import {
  InfoAside,
  InfoEmpty,
  InfoHeading,
  InfoRow,
} from '@/features/calendar/components/InfoList';
import { holidaysByDay, kindLabels } from '@/features/holidays/holidays';
import { useSettings } from '@/features/settings/SettingsProvider';
import { ScrollRows } from '@/features/sidebar/components/ScrollRows';
import { Sidebar } from '@/features/sidebar/components/Sidebar';
import { FESTIVAL_ROWS, type SidebarLayout } from '@/features/sidebar/sidebar-layout';
import { useMinute } from '@/features/sidebar/use-minute';

import { useComposer } from '../ComposerProvider';
import { useEvents } from '../EventsProvider';
import { instantToWall, nextSlot, uses12Hour } from '../item-time';
import { KIND_LABEL } from '../types';
import { upNext, type Upcoming } from '../up-next';

/**
 * The clock's side panel, for the analog and digital faces alike. Top
 * right: today, set exactly like the calendar's selected day. Bottom right:
 * what's coming up, soonest first, then today's holidays and festivals.
 * Placed by `sidebarLayout`, so the clock beside it never moves.
 */
export function TodaySidebar({
  layout,
  contentWidth,
  paused,
}: {
  layout: SidebarLayout;
  /** The dial's or the time's width, so the panel keeps clear of it. */
  contentWidth: number;
  paused: boolean;
}) {
  const now = useMinute(paused);
  return (
    <Sidebar
      layout={layout}
      contentWidth={contentWidth}
      date={<WatchDate now={now} numeralHeight={layout.dateNumeral} />}
      list={<WatchUpcoming now={now} visible={layout.eventRows} />}
    />
  );
}

export function WatchDate({ now, numeralHeight }: { now: Date; numeralHeight: number }) {
  const { uiTheme: ui, timeZone, settings } = useSettings();
  const nav = useDayNav();
  const today = instantToWall(Math.floor(now.getTime() / 60_000) * 60_000, timeZone).date;
  const system = calendarSystemFor(settings.region, settings.nepalCalendar, today);
  const secondary = system.secondaryDate?.(today);
  const label = `${system.longDate(today)}${secondary ? ` (${secondary})` : ''}`;
  // On the home screen, the date opens today in the calendar.
  const open = useSwipeAwarePress(() => nav?.openDay(today));
  const heading = (
    <DayHeading
      system={system}
      date={today}
      isToday
      todayPrefix={false}
      theme={ui}
      numeralHeight={numeralHeight}
      align="end"
    />
  );
  if (!nav) {
    return (
      <View accessible accessibilityRole="header" accessibilityLabel={label}>
        {heading}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens today in the calendar"
      onPress={open}
      style={({ hovered, pressed }) => [
        styles.date,
        { opacity: pressed ? 0.55 : hovered ? 0.8 : 1 },
        pressed && styles.datePressed,
      ]}
    >
      {heading}
    </Pressable>
  );
}

/**
 * "Up next", `visible` rows at a time (the rest scroll), then today's
 * "Holidays & festivals", one at a time.
 */
export function WatchUpcoming({ now, visible }: { now: Date; visible: number }) {
  const { uiTheme: ui, timeZone, settings } = useSettings();
  const { items } = useEvents();
  const { compose } = useComposer();
  const hour12 = uses12Hour();

  // Recomputed once a minute (and when items change), not every second.
  const minute = Math.floor(now.getTime() / 60_000);
  // Today's holidays, looked up again only when the day (or a filter) changes.
  const { year, month, day } = instantToWall(minute * 60_000, timeZone).date;
  const { region, area, showPublicHolidays, showRestrictedHolidays, showFestivals } = settings;
  const holidays = useMemo(() => {
    const today = { year, month, day };
    return (
      holidaysByDay(region, area, today, today, {
        public: showPublicHolidays,
        restricted: showRestrictedHolidays,
        festival: showFestivals,
      }).get(toISODate(today)) ?? []
    );
  }, [year, month, day, region, area, showPublicHolidays, showRestrictedHolidays, showFestivals]);
  const next = useMemo(
    () => upNext(items, minute * 60_000, timeZone, { limit: MAX_UPCOMING, hour12 }),
    [items, minute, timeZone, hour12],
  );
  const hidden = next.rows.length - visible + next.more;

  const addNew = () => {
    const { date, time } = nextSlot(Date.now(), timeZone);
    compose({ mode: 'new', date, time });
  };

  return (
    <View style={styles.list}>
      <InfoHeading
        label="Up next"
        theme={ui}
        aside={hidden > 0 ? <InfoAside text={`+${hidden} more`} theme={ui} /> : undefined}
      />

      {next.rows.length === 0 ? (
        <InfoEmpty text="Nothing else today." theme={ui}>
          <TextButton label="+ Add" tone="accent" onPress={addNew} a11yLabel="Add something" />
        </InfoEmpty>
      ) : (
        <ScrollRows visible={visible} pageColor={ui.page}>
          {next.rows.map((row) => (
            <Row
              key={row.item.id}
              row={row}
              onPress={() => compose({ mode: 'edit', item: row.item })}
            />
          ))}
        </ScrollRows>
      )}

      {holidays.length > 0 ? (
        <HolidayList
          holidays={holidays}
          kindLabels={kindLabels(region, area)}
          theme={ui}
          visible={FESTIVAL_ROWS}
          style={styles.festivals}
        />
      ) : null}
    </View>
  );
}

/** Most upcoming items listed (the rest are counted in "+N more"). */
const MAX_UPCOMING = 30;

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

const styles = StyleSheet.create({
  // Eases between rest, hover and press (web; native changes at once).
  date: (Platform.OS === 'web'
    ? { transitionProperty: 'opacity, transform', transitionDuration: '160ms' }
    : {}) as object,
  datePressed: { transform: [{ scale: 0.98 }] },
  list: { alignSelf: 'stretch', alignItems: 'flex-end' },
  festivals: { marginTop: 8 },
});
