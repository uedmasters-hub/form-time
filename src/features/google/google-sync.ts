import { toISODate } from '@/features/calendar/calendar-date';
import { instantToWall, parseISODate, parseTime, scheduleFor } from '@/features/events/item-time';
import type { CalendarItem } from '@/features/events/types';

import type { GoogleCalendarApi } from './google-api';
import {
  SYNC_FIELDS,
  SYNC_KINDS,
  eventToFields,
  fieldValue,
  googleIdFor,
  importedIdFor,
  isImportedId,
  itemIdFromGoogleId,
  newEventBody,
  patchBody,
  sameSnapshot,
  snapshotOf,
  snapshotOfFields,
  takeField,
  type GoogleEvent,
  type RemoteFields,
  type Snapshot,
  type SyncField,
} from './google-map';

/**
 * One round of two-way sync between the user's items and a Google calendar.
 *
 * For every item that's an event or a meeting, and every event in Google
 * from 30 days back to 180 days ahead, it works out what changed where since
 * they were last in step (the link's snapshot) and carries it across:
 *
 * - new on one side → created on the other, under ids that can't clash (see
 *   google-map), so a retry or a second device never makes a duplicate;
 * - changed on one side → changed on the other, only the fields that
 *   changed, so Google's own fields (guests, colour, recurrence, the end
 *   time, a description too long for FORM / TIME) are never overwritten;
 * - changed on both → merged field by field; where both changed the same
 *   field, the later edit wins;
 * - deleted on one side → deleted on the other, unless it was edited on the
 *   other side after that, in which case it's kept (nothing is lost).
 *
 * Writes to Google use the event's etag, so a change made in Google while
 * the round runs is never overwritten blind: the next round merges it.
 */

/** How an item and its Google event were when last in step. */
export type GoogleLink = {
  googleId: string;
  etag: string;
  /** Google's "updated" time then. */
  updated: string;
  /** Kept from Google, so moving an event keeps its length. */
  durationMs: number | null;
  days: number | null;
  snap: Snapshot;
};

export type GoogleLinks = Record<string, GoogleLink>;

/** A change for the item store; `base` is the updatedAt it was worked out from. */
export type ItemChange = { item: CalendarItem; base: string | null };

export type GoogleCounts = {
  /** Brought in from Google: new, changed, deleted. */
  imported: number;
  updated: number;
  deleted: number;
  /** Sent to Google: new, changed, deleted. */
  created: number;
  patched: number;
  removed: number;
};

export type GoogleRound = {
  changes: ItemChange[];
  links: GoogleLinks;
  /** The calendar's name (for the primary calendar, the account's address). */
  account: string;
  counts: GoogleCounts;
  /** Set when the round stopped early; what it did before that still counts. */
  error: unknown;
};

const DAY = 86_400_000;
export const WINDOW_PAST_DAYS = 30;
export const WINDOW_FUTURE_DAYS = 180;

const later = (a: string | undefined, b: string | undefined) =>
  Date.parse(a ?? '') > Date.parse(b ?? '');

/** An item with a snapshot's fields, its start and reminder worked out again. */
function withSnapshot(item: CalendarItem, snap: Snapshot, updatedAt: string): CalendarItem {
  const schedule = scheduleFor(
    parseISODate(snap.date),
    snap.time ? parseTime(snap.time) : null,
    snap.timeZone,
    item.reminderMinutes,
  );
  return { ...item, ...snap, ...schedule, updatedAt };
}

export async function syncGoogleRound({
  api,
  calendarId,
  items,
  links,
  now,
  timeZone,
  idFor = importedIdFor,
}: {
  api: GoogleCalendarApi;
  calendarId: string;
  /** Every item, deleted ones included. */
  items: CalendarItem[];
  links: GoogleLinks;
  now: number;
  /** The zone dates are reckoned in, and new imports fall back to. */
  timeZone: string;
  idFor?: (googleId: string) => Promise<string>;
}): Promise<GoogleRound> {
  const nowIso = new Date(now).toISOString();
  const byId = new Map(items.map((item) => [item.id, item]));
  const next: GoogleLinks = { ...links };
  const changed = new Map<string, ItemChange>();
  const counts: GoogleCounts = {
    imported: 0,
    updated: 0,
    deleted: 0,
    created: 0,
    patched: 0,
    removed: 0,
  };
  let account = '';
  let calendarZone = timeZone;

  const current = (id: string) => changed.get(id)?.item ?? byId.get(id);
  const put = (item: CalendarItem) =>
    changed.set(item.id, { item, base: byId.get(item.id)?.updatedAt ?? null });
  const fieldsOf = (event: GoogleEvent) => eventToFields(event, calendarZone, timeZone);
  const link = (event: GoogleEvent, fields: RemoteFields | null, snap: Snapshot): GoogleLink => ({
    googleId: event.id,
    etag: event.etag ?? '',
    updated: event.updated ?? nowIso,
    durationMs: fields?.durationMs ?? null,
    days: fields?.days ?? null,
    snap,
  });
  const day = (ms: number) => toISODate(instantToWall(ms, timeZone).date);

  /** Sends some fields of an item to its event; on a clash, leaves it for the next round. */
  async function send(
    itemId: string,
    googleId: string,
    snap: Snapshot,
    fields: ReadonlySet<SyncField>,
    remote: RemoteFields | null,
    etag: string | undefined,
  ) {
    const lengths = remote ?? next[itemId];
    const result = await api.patch(
      calendarId,
      googleId,
      patchBody(snap, fields, lengths?.durationMs ?? null, lengths?.days ?? null),
      etag || undefined,
    );
    if (result === 'conflict') return; // changed in Google meanwhile: merged next round
    if (result === 'gone') {
      delete next[itemId];
      return;
    }
    next[itemId] = link(result, fieldsOf(result), snap);
    counts.patched++;
  }

  /** Brings one Google event and its item into step. */
  async function reconcile(itemId: string, event: GoogleEvent) {
    const item = current(itemId);
    const known = next[itemId];

    if (event.status === 'cancelled') {
      if (!item || item.deletedAt || !SYNC_KINDS.has(item.kind)) {
        delete next[itemId];
        return;
      }
      const editedHere = known
        ? !sameSnapshot(snapshotOf(item), known.snap) && later(item.updatedAt, event.updated)
        : later(item.updatedAt, event.updated);
      if (!editedHere) {
        // Deleted in Google: delete it here too.
        put({ ...item, deletedAt: nowIso, remindAt: null, updatedAt: nowIso });
        delete next[itemId];
        counts.deleted++;
        return;
      }
      // Edited here after it was deleted in Google: keep it, and bring it back there.
      const snap = snapshotOf(item);
      const result = await api.patch(calendarId, event.id, {
        status: 'confirmed',
        ...patchBody(snap, new Set(SYNC_FIELDS), known?.durationMs ?? null, known?.days ?? null),
      });
      if (result === 'conflict' || result === 'gone') {
        delete next[itemId];
        return;
      }
      next[itemId] = link(result, fieldsOf(result), snap);
      counts.patched++;
      return;
    }

    const fields = fieldsOf(event);
    if (!fields) return;
    const remote = snapshotOfFields(fields);

    if (!item) {
      // New in Google.
      const schedule = scheduleFor(
        parseISODate(remote.date),
        remote.time ? parseTime(remote.time) : null,
        remote.timeZone,
        null,
      );
      put({
        id: itemId,
        kind: fields.kind,
        ...remote,
        ...schedule,
        reminderMinutes: null,
        createdAt: event.created ?? event.updated ?? nowIso,
        updatedAt: event.updated ?? nowIso,
        deletedAt: null,
      });
      next[itemId] = link(event, fields, remote);
      counts.imported++;
      return;
    }

    if (item.deletedAt) {
      if (known && event.etag !== known.etag && later(event.updated, item.deletedAt)) {
        // Edited in Google after it was deleted here: keep Google's.
        put(withSnapshot({ ...item, deletedAt: null }, remote, event.updated ?? nowIso));
        next[itemId] = link(event, fields, remote);
        counts.updated++;
        return;
      }
      if (!SYNC_KINDS.has(item.kind)) return;
      await api.remove(calendarId, event.id);
      delete next[itemId];
      counts.removed++;
      return;
    }

    const local = snapshotOf(item);

    if (!known) {
      // First meeting (another device linked them, or a retry): the newer copy wins.
      if (sameSnapshot(local, remote)) {
        next[itemId] = link(event, fields, remote);
        return;
      }
      if (later(event.updated, item.updatedAt)) {
        put(withSnapshot(item, remote, event.updated ?? nowIso));
        next[itemId] = link(event, fields, remote);
        counts.updated++;
        return;
      }
      const differ = SYNC_FIELDS.filter((f) => fieldValue(local, f) !== fieldValue(remote, f));
      await send(itemId, event.id, local, new Set(differ), fields, event.etag);
      return;
    }

    const remoteChanged = (event.etag ?? '') !== known.etag;
    const localChanged = !sameSnapshot(local, known.snap);
    if (!remoteChanged) {
      if (localChanged) {
        const differ = SYNC_FIELDS.filter(
          (f) => fieldValue(local, f) !== fieldValue(known.snap, f),
        );
        await send(itemId, event.id, local, new Set(differ), fields, event.etag);
      }
      return;
    }

    // Changed in Google (and maybe here): merge field by field against the
    // last shared copy. Where both changed a field, the later edit wins.
    const remoteLater = later(event.updated, item.updatedAt);
    let merged = local;
    const outgoing = new Set<SyncField>();
    let incoming = false;
    for (const f of SYNC_FIELDS) {
      const here = fieldValue(local, f);
      const there = fieldValue(remote, f);
      const before = fieldValue(known.snap, f);
      if (here === there) continue;
      if (here === before || (there !== before && remoteLater)) {
        merged = takeField(merged, remote, f);
        incoming = true;
      } else {
        outgoing.add(f);
      }
    }
    if (incoming) {
      put(withSnapshot(item, merged, outgoing.size ? nowIso : (event.updated ?? nowIso)));
      counts.updated++;
    }
    if (outgoing.size) await send(itemId, event.id, merged, outgoing, fields, event.etag);
    else next[itemId] = link(event, fields, merged);
  }

  try {
    const list = await api.listAll(
      calendarId,
      new Date(now - WINDOW_PAST_DAYS * DAY).toISOString(),
      new Date(now + WINDOW_FUTURE_DAYS * DAY).toISOString(),
    );
    account = list.summary;
    calendarZone = list.timeZone || timeZone;
    const events = [...list.events];

    // Linked events Google didn't list (deleted, or moved out of range): ask for each.
    const listed = new Set(events.map((event) => event.id));
    const from = day(now - WINDOW_PAST_DAYS * DAY);
    const to = day(now + WINDOW_FUTURE_DAYS * DAY);
    for (const known of Object.values(links)) {
      if (listed.has(known.googleId) || known.snap.date < from || known.snap.date > to) continue;
      const event = await api.get(calendarId, known.googleId);
      events.push(event ?? { id: known.googleId, status: 'cancelled' });
    }

    const byGoogle = new Map(Object.entries(links).map(([itemId, l]) => [l.googleId, itemId]));
    const seen = new Set<string>();
    for (const event of events) {
      if (event.eventType === 'workingLocation') continue;
      const itemId =
        byGoogle.get(event.id) ?? itemIdFromGoogleId(event.id) ?? (await idFor(event.id));
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      await reconcile(itemId, event);
    }

    // Items Google didn't show: new here, deleted here, or changed and out of range.
    const insertFrom = day(now - (WINDOW_PAST_DAYS - 1) * DAY);
    const insertTo = day(now + (WINDOW_FUTURE_DAYS - 1) * DAY);
    for (const original of items) {
      const item = current(original.id) as CalendarItem;
      if (seen.has(item.id) || !SYNC_KINDS.has(item.kind)) continue;
      const known = next[item.id];
      if (item.deletedAt) {
        if (known) {
          await api.remove(calendarId, known.googleId);
          delete next[item.id];
          counts.removed++;
        }
        continue;
      }
      if (known) {
        const snap = snapshotOf(item);
        if (sameSnapshot(snap, known.snap)) continue;
        const differ = SYNC_FIELDS.filter((f) => fieldValue(snap, f) !== fieldValue(known.snap, f));
        await send(item.id, known.googleId, snap, new Set(differ), null, known.etag);
        continue;
      }
      // Imported items are never sent back as new; others only within range.
      if (isImportedId(item.id) || item.date < insertFrom || item.date > insertTo) continue;
      const result = await api.insert(calendarId, newEventBody(item));
      if (result === 'exists') {
        // Already there (an earlier attempt, or another device): link it up.
        const event = await api.get(calendarId, googleIdFor(item.id));
        if (event) await reconcile(item.id, event);
        continue;
      }
      next[item.id] = link(result, fieldsOf(result), snapshotOf(item));
      counts.created++;
    }
    return { changes: [...changed.values()], links: next, account, counts, error: null };
  } catch (error) {
    return { changes: [...changed.values()], links: next, account, counts, error };
  }
}
