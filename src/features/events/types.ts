/**
 * The user's own calendar items: events, meetings, notes, follow-ups and
 * alarms. Kept apart from holidays (read-only reference data).
 *
 * Time is stored the way people mean it — a wall-clock date and time in a
 * named time zone — plus the instant that works out to, so the calendar can
 * place it and reminders can fire at the right moment wherever you are.
 */
export type ItemKind = 'event' | 'meeting' | 'note' | 'follow_up' | 'alarm';

export type CalendarItem = {
  /** UUID, made on the device so items can be created offline. */
  id: string;
  kind: ItemKind;
  title: string;
  notes: string;
  /** Where it happens: a place, or a meeting link. "" when not set. */
  place: string;
  /** Wall-clock date, "2026-10-16". */
  date: string;
  /** Wall-clock time "15:27:00", or null for an all-day or untimed item. */
  time: string | null;
  /** IANA zone the date and time are in. */
  timeZone: string;
  /** The instant (ISO, UTC) — null when untimed. */
  startsAt: string | null;
  /** When to remind (ISO, UTC), or null for no reminder. */
  remindAt: string | null;
  /** Minutes before the start the reminder was set for (null: none). */
  reminderMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  /** Set when deleted; kept so the deletion reaches other devices. */
  deletedAt: string | null;
};

export const ITEM_KINDS: readonly { id: ItemKind; label: string; placeholder: string }[] = [
  { id: 'event', label: 'Event', placeholder: 'What’s happening?' },
  { id: 'meeting', label: 'Meeting', placeholder: 'Meeting with…' },
  { id: 'note', label: 'Note', placeholder: 'Write a note' },
  { id: 'follow_up', label: 'Follow-up', placeholder: 'Follow up on…' },
  { id: 'alarm', label: 'Alarm', placeholder: 'Alarm' },
];

export const KIND_LABEL: Record<ItemKind, string> = {
  event: 'Event',
  meeting: 'Meeting',
  note: 'Note',
  follow_up: 'Follow-up',
  alarm: 'Alarm',
};

/** Reminder choices, in minutes before the start. */
export const REMINDERS: readonly { minutes: number | null; label: string }[] = [
  { minutes: null, label: 'None' },
  { minutes: 0, label: 'At time' },
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 1440, label: '1 day' },
];
