import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { DayHoliday, HolidayKind } from '@/features/holidays/types';

import type { CalendarDate } from '../calendar-date';
import type { CalendarSystem } from '../calendar-system';
import type { CalendarTheme } from '../calendar-theme';
import { DayHeading } from './DayHeading';
import { InfoAside, InfoEmpty, InfoHeading, InfoRow } from './InfoList';

/** One of the user's own items on this day, ready to show. */
export type DayItem = {
  id: string;
  /** "Meeting", "Alarm". */
  kindLabel: string;
  title: string;
  /** Where, or a meeting link; "" when not set. */
  place: string;
  /** "9:30 AM", or "All day". */
  when: string;
  hasReminder: boolean;
};

type DayPanelProps = {
  /** Numbers and names the day in this calendar (Gregorian or B.S.). */
  system: CalendarSystem;
  date: CalendarDate;
  isToday: boolean;
  /** Holidays and festivals on this day, public first. */
  holidays: DayHoliday[];
  kindLabels: Record<HolidayKind, string>;
  theme: CalendarTheme;
  /** Large date numeral height. */
  numeralHeight: number;
  /** Type scale for the labels; 1 at the base layout size. */
  scale?: number;
  /** 'end' sets the panel flush right, for the page's right edge. */
  align?: 'start' | 'end';
  /** The user's events, notes and reminders on this day, in time order. */
  items?: DayItem[];
  onOpenItem?: (id: string) => void;
  /** Controls set on the weekday line, at the far side (phones: Today, +). */
  actions?: ReactNode;
  /** The weekday, numeral and month (Settings → Day & date). */
  showDate?: boolean;
  /** The day's items, holidays and festivals (Settings → Events & festivals). */
  showEvents?: boolean;
};

/**
 * The selected day, set like the digital watch's corner: the weekday, a
 * large monoline numeral and the month on top, then the day's own items and
 * its holidays and festivals in the watch's hairline-headed lists. Either
 * half can be hidden in Settings.
 */
export function DayPanel({
  system,
  date,
  isToday,
  holidays,
  kindLabels,
  theme,
  numeralHeight,
  scale = 1,
  align = 'start',
  items = [],
  onOpenItem,
  actions,
  showDate = true,
  showEvents = true,
}: DayPanelProps) {
  const end = align === 'end';
  const secondary = system.secondaryDate?.(date);

  const summary = [
    showDate
      ? `${system.longDate(date)}${secondary ? ` (${secondary})` : ''}${isToday ? ', today' : ''}`
      : '',
    showEvents
      ? holidays.length
        ? holidays.map((h) => `${kindLabels[h.kind]}: ${h.name}${describe(h)}`).join('. ')
        : 'No holidays or festivals'
      : '',
  ]
    .filter(Boolean)
    .join('. ');

  // Phones keep Today and + on the first line that's shown.
  if (!showDate && !showEvents) {
    return actions ? <View style={styles.actionsAlone}>{actions}</View> : null;
  }

  return (
    <View
      style={[styles.panel, end && styles.panelEnd]}
      // One summary for screen readers, unless it holds items to open.
      accessible={items.length === 0 && !actions}
      accessibilityLabel={`${summary}.`}
    >
      {showDate ? (
        <DayHeading
          system={system}
          date={date}
          isToday={isToday}
          theme={theme}
          numeralHeight={numeralHeight}
          scale={scale}
          align={align}
          actions={actions}
        />
      ) : null}

      {showEvents ? (
        <View style={[styles.lists, showDate && { marginTop: 24 * scale }]}>
          <DayLists
            items={items}
            holidays={holidays}
            kindLabels={kindLabels}
            theme={theme}
            align={align}
            scale={scale}
            onOpenItem={onOpenItem}
            aside={
              showDate || !actions ? undefined : (
                <View style={[styles.actions, styles.asideActions]}>{actions}</View>
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The lists under a day: "Events" (its own items, or "Nothing planned.")
 * and, when it has any, "Holidays & festivals". The calendar's day panel
 * and its side panel both use it.
 */
export function DayLists({
  items,
  holidays,
  kindLabels,
  theme,
  align = 'end',
  scale = 1,
  onOpenItem,
  aside,
}: {
  items: DayItem[];
  holidays: DayHoliday[];
  kindLabels: Record<HolidayKind, string>;
  theme: CalendarTheme;
  align?: 'start' | 'end';
  scale?: number;
  onOpenItem?: (id: string) => void;
  /** Beside the "Events" heading (phones: Today, +). */
  aside?: ReactNode;
}) {
  return (
    <View style={styles.lists}>
      <InfoHeading label="Events" theme={theme} align={align} scale={scale} aside={aside} />
      {items.length === 0 ? (
        <InfoEmpty text="Nothing planned." theme={theme} align={align} scale={scale} />
      ) : (
        items.map((item) => (
          <InfoRow
            key={item.id}
            kind={`${item.kindLabel} · ${item.when}`}
            title={item.title}
            detail={item.place ? placeLabel(item.place) : undefined}
            theme={theme}
            align={align}
            scale={scale}
            bell={item.hasReminder}
            titleLines={2}
            onPress={() => onOpenItem?.(item.id)}
            accessibilityLabel={`${item.kindLabel}, ${item.when}: ${item.title}${
              item.place ? `, ${item.place}` : ''
            }${item.hasReminder ? ', reminder set' : ''}`}
            accessibilityHint="Opens it to edit or delete"
          />
        ))
      )}

      {holidays.length > 0 ? (
        <HolidayList
          holidays={holidays}
          kindLabels={kindLabels}
          theme={theme}
          align={align}
          scale={scale}
          style={{ marginTop: 14 * scale }}
        />
      ) : null}
    </View>
  );
}

/**
 * "Holidays & festivals" and a day's observances, `limit` of them at most
 * (with "+N more" beside the heading). Shared by the calendar and the clock.
 */
export function HolidayList({
  holidays,
  kindLabels,
  theme,
  align = 'end',
  scale = 1,
  limit = Infinity,
  style,
}: {
  holidays: DayHoliday[];
  kindLabels: Record<HolidayKind, string>;
  theme: CalendarTheme;
  align?: 'start' | 'end';
  scale?: number;
  limit?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shown = holidays.slice(0, limit);
  const more = holidays.length - shown.length;
  return (
    <View style={[styles.lists, style]}>
      <InfoHeading
        label="Holidays & festivals"
        theme={theme}
        align={align}
        scale={scale}
        aside={
          more > 0 ? <InfoAside text={`+${more} more`} theme={theme} scale={scale} /> : undefined
        }
      />
      {shown.map((h, i) => (
        <InfoRow
          key={`${h.name}-${i}`}
          kind={kindLabels[h.kind]}
          title={h.name}
          detail={describe(h).replace(/^, /, '') || undefined}
          theme={theme}
          align={align}
          scale={scale}
          // Official holidays in the accent; observances stay quiet.
          kindColor={h.kind === 'public' ? theme.accent : theme.muted}
          markColor={h.kind === 'public' ? theme.accent : theme.muted}
          titleLines={limit === Infinity ? 2 : 1}
          accessibilityLabel={`${kindLabels[h.kind]}: ${h.name}${describe(h)}`}
        />
      ))}
    </View>
  );
}

/** A link shows as its host ("meet.google.com"); a place as written. */
function placeLabel(place: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(place.trim());
  return m ? m[1].replace(/^www\./, '') : place;
}

/** ", day 6 of 9 · Kathmandu Valley only" — or "" when there's nothing to add. */
function describe(h: DayHoliday): string {
  const parts = [h.dayOf ? `day ${h.dayOf[0]} of ${h.dayOf[1]}` : '', h.note ?? ''].filter(Boolean);
  if (!parts.length) return '';
  const text = parts.join(' · ');
  return `, ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

const styles = StyleSheet.create({
  panel: { alignItems: 'flex-start' },
  panelEnd: { alignItems: 'flex-end' },
  lists: { alignSelf: 'stretch' },
  // 44 pt targets on a small line: they overhang so the line keeps its height.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: -16,
    marginRight: -12,
  },
  // Centred on the heading's line rather than its baseline.
  asideActions: { alignSelf: 'center' },
  actionsAlone: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
    marginRight: -12,
  },
});
