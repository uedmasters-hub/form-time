import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { toISODate } from '@/features/calendar/calendar-date';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { DayHeading } from '@/features/calendar/components/DayHeading';
import { HolidayList } from '@/features/calendar/components/DayPanel';
import {
  InfoAside,
  InfoEmpty,
  InfoHeading,
  InfoRow,
} from '@/features/calendar/components/InfoList';
import { holidaysByDay, kindLabels } from '@/features/holidays/holidays';
import { useSettings } from '@/features/settings/SettingsProvider';
import { Sidebar } from '@/features/sidebar/components/Sidebar';
import type { SidebarLayout } from '@/features/sidebar/sidebar-layout';
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
export function TodaySidebar({ layout, paused }: { layout: SidebarLayout; paused: boolean }) {
  const now = useMinute(paused);
  return (
    <Sidebar
      layout={layout}
      date={<WatchDate now={now} numeralHeight={layout.dateNumeral} />}
      list={<WatchUpcoming now={now} limit={layout.rows} />}
    />
  );
}

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

/**
 * "Up next" and today's "Holidays & festivals", in `limit` rows' space
 * (the layout reserves room for both headings).
 */
export function WatchUpcoming({ now, limit }: { now: Date; limit: number }) {
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
  // The layout keeps room for a second heading; a festival takes one row of
  // `limit` (two when there's plenty), and up next keeps the rest.
  const festivalRows =
    holidays.length === 0 || limit < 2 ? 0 : limit >= 4 ? Math.min(2, holidays.length) : 1;
  const upNextRows = limit - festivalRows;
  const next = useMemo(
    () => upNext(items, minute * 60_000, timeZone, { limit: upNextRows, hour12 }),
    [items, minute, timeZone, hour12, upNextRows],
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

      {festivalRows > 0 ? (
        <HolidayList
          holidays={holidays}
          kindLabels={kindLabels(region, area)}
          theme={ui}
          limit={festivalRows}
          style={styles.festivals}
        />
      ) : null}
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

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', alignItems: 'flex-end' },
  festivals: { marginTop: 8 },
});
