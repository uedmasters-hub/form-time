import { addDays, toISODate } from '@/features/calendar/calendar-date';
import {
  instantToWall,
  parseISODate,
  parseTime,
  timeString,
  wallToInstant,
} from '@/features/events/item-time';
import type { CalendarItem, ItemKind } from '@/features/events/types';

/**
 * Converting between FORM / TIME items and Google Calendar events, and the
 * ids that tie them together. Pure functions.
 *
 * Ids are what keep the two calendars free of duplicates, however often a
 * sync is retried or how many devices run it:
 * - an item made in FORM / TIME goes to Google under an id derived from its
 *   own ("ft" + its UUID's hex — Google allows a-v and 0-9), so a second
 *   attempt meets the first ("already exists") instead of making a copy;
 * - an event made in Google comes into FORM / TIME under an id derived from
 *   Google's (a SHA-256 UUID, version 8), so every device imports it as the
 *   same item, and it's never sent back to Google as something new.
 */

export type GoogleTime = { date?: string; dateTime?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  etag?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  conferenceData?: unknown;
  attendees?: unknown[];
  start?: GoogleTime;
  end?: GoogleTime;
  recurringEventId?: string;
  eventType?: string;
};

/** Kinds that are calendar events; notes, follow-ups and alarms stay here. */
export const SYNC_KINDS: ReadonlySet<ItemKind> = new Set<ItemKind>(['event', 'meeting']);

/** Length limits of the calendar_items table (see supabase/migrations). */
const LIMITS = { title: 200, notes: 4000, place: 500 };
/** A new timed event lasts an hour (FORM / TIME items have no end yet). */
export const DEFAULT_DURATION_MS = 3_600_000;

// ── Ids ──────────────────────────────────────────────────────────────────

/** Google's id for an item made in FORM / TIME. */
export function googleIdFor(itemId: string): string {
  return `ft${itemId.replace(/-/g, '').toLowerCase()}`;
}

/** The item behind an id made by googleIdFor, or null for Google's own ids. */
export function itemIdFromGoogleId(googleId: string): string | null {
  const m = /^ft([0-9a-f]{32})$/.exec(googleId);
  if (!m) return null;
  const h = m[1];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Items imported from Google have version-8 ids; FORM / TIME's own are version 4. */
export function isImportedId(itemId: string): boolean {
  return itemId[14] === '8';
}

/** The item id for an event made in Google: the same on every device. */
export async function importedIdFor(googleId: string): Promise<string> {
  const data = new TextEncoder().encode(`google:${googleId}`);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80; // version 8 (custom)
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── Fields ───────────────────────────────────────────────────────────────

/** The parts of an item that sync, as they were when last in step. */
export type Snapshot = {
  title: string;
  notes: string;
  place: string;
  date: string;
  /** "HH:MM:SS", or null for all day. */
  time: string | null;
  timeZone: string;
};

export function snapshotOf(item: CalendarItem): Snapshot {
  return {
    title: item.title,
    notes: item.notes,
    place: item.place,
    date: item.date,
    time: item.time,
    timeZone: item.timeZone,
  };
}

/** What an event says, in item terms, plus how long it lasts. */
export type RemoteFields = Snapshot & {
  /** Timed events: the length, so moving one keeps it. */
  durationMs: number | null;
  /** All-day events: how many days. */
  days: number | null;
  kind: ItemKind;
};

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

function validZone(zone: string | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

/** Google descriptions can hold simple HTML (line breaks, links); keep the text. */
export function plainText(html: string): string {
  if (!/[<&]/.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * An event's fields as a FORM / TIME item would hold them, or null when it
 * has no usable start. Timed events keep the zone they were made in (or the
 * calendar's); all-day events keep their dates.
 */
export function eventToFields(
  event: GoogleEvent,
  calendarZone: string,
  fallbackZone: string,
): RemoteFields | null {
  const timeZone = validZone(event.start?.timeZone) ?? validZone(calendarZone) ?? fallbackZone;
  const kind: ItemKind =
    event.hangoutLink || event.conferenceData || (event.attendees?.length ?? 0) > 1
      ? 'meeting'
      : 'event';
  const text = {
    title: clip((event.summary ?? '').trim() || '(No title)', LIMITS.title),
    notes: clip(plainText(event.description ?? ''), LIMITS.notes),
    place: clip((event.location ?? '').trim() || event.hangoutLink || '', LIMITS.place),
  };

  if (event.start?.date) {
    const date = event.start.date;
    const end = event.end?.date;
    const days = end ? Math.max(1, daysBetween(date, end)) : 1;
    return { ...text, date, time: null, timeZone, durationMs: null, days, kind };
  }
  if (event.start?.dateTime) {
    const start = Date.parse(event.start.dateTime);
    if (Number.isNaN(start)) return null;
    const wall = instantToWall(start, timeZone);
    const end = event.end?.dateTime ? Date.parse(event.end.dateTime) : NaN;
    return {
      ...text,
      date: toISODate(wall.date),
      time: timeString(wall.time),
      timeZone,
      durationMs: Number.isNaN(end) || end < start ? DEFAULT_DURATION_MS : end - start,
      days: null,
      kind,
    };
  }
  return null;
}

export function snapshotOfFields(fields: RemoteFields): Snapshot {
  return {
    title: fields.title,
    notes: fields.notes,
    place: fields.place,
    date: fields.date,
    time: fields.time,
    timeZone: fields.timeZone,
  };
}

/**
 * Google's start and end for a snapshot. Timed: wall time in the item's
 * zone, ending `durationMs` later. All day: `days` whole days (Google's end
 * date is the day after). `clearing` adds explicit nulls, so a PATCH that
 * turns a timed event into an all-day one (or back) drops the other form.
 */
export function eventTimes(
  snap: Snapshot,
  durationMs: number | null,
  days: number | null,
  clearing: boolean,
): { start: Record<string, string | null>; end: Record<string, string | null> } {
  if (snap.time === null) {
    const end = toISODate(addDays(parseISODate(snap.date), Math.max(1, days ?? 1)));
    const extra: Record<string, null> = clearing ? { dateTime: null, timeZone: null } : {};
    return { start: { date: snap.date, ...extra }, end: { date: end, ...extra } };
  }
  const start = wallToInstant(parseISODate(snap.date), parseTime(snap.time), snap.timeZone);
  const length = durationMs && durationMs > 0 ? durationMs : DEFAULT_DURATION_MS;
  const endWall = instantToWall(start + length, snap.timeZone);
  const extra: Record<string, null> = clearing ? { date: null } : {};
  return {
    start: { dateTime: `${snap.date}T${snap.time}`, timeZone: snap.timeZone, ...extra },
    end: {
      dateTime: `${toISODate(endWall.date)}T${timeString(endWall.time)}`,
      timeZone: snap.timeZone,
      ...extra,
    },
  };
}

/** The body of a new Google event for an item. */
export function newEventBody(item: CalendarItem): Record<string, unknown> {
  const snap = snapshotOf(item);
  return {
    id: googleIdFor(item.id),
    summary: snap.title,
    description: snap.notes,
    location: snap.place,
    ...eventTimes(snap, null, null, false),
  };
}

/** A PATCH body carrying only the fields in `changed`. */
export function patchBody(
  snap: Snapshot,
  changed: ReadonlySet<SyncField>,
  durationMs: number | null,
  days: number | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (changed.has('title')) body.summary = snap.title;
  if (changed.has('notes')) body.description = snap.notes;
  if (changed.has('place')) body.location = snap.place;
  if (changed.has('when')) Object.assign(body, eventTimes(snap, durationMs, days, true));
  return body;
}

/** Fields compared one by one when merging; date, time and zone move together. */
export type SyncField = 'title' | 'notes' | 'place' | 'when';
export const SYNC_FIELDS: readonly SyncField[] = ['title', 'notes', 'place', 'when'];

export function fieldValue(snap: Snapshot, field: SyncField): string {
  // An all-day item's zone doesn't change when it is, so it isn't compared.
  if (field === 'when') return `${snap.date}|${snap.time ?? ''}|${snap.time ? snap.timeZone : ''}`;
  return snap[field];
}

export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return SYNC_FIELDS.every((f) => fieldValue(a, f) === fieldValue(b, f));
}

/** Copies one field's value from `from` into `into`. */
export function takeField(into: Snapshot, from: Snapshot, field: SyncField): Snapshot {
  if (field === 'when')
    return { ...into, date: from.date, time: from.time, timeZone: from.timeZone };
  return { ...into, [field]: from[field] };
}
