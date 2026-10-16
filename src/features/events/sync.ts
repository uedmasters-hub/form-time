import type { SupabaseRest } from '@/features/sync/supabase-rest';

import type { CalendarItem, ItemKind } from './types';

/**
 * Mapping between items and calendar_items rows, and the merge that keeps
 * this device and the database in step. Last write wins per item, by
 * updated_at; a change made here that hasn't reached the server yet is never
 * overwritten by an older copy from the server.
 */
export const TABLE = 'calendar_items';

export type ItemRow = {
  id: string;
  kind: ItemKind;
  title: string;
  notes: string;
  local_date: string;
  local_time: string | null;
  time_zone: string;
  starts_at: string | null;
  remind_at: string | null;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);

export function toRow(item: CalendarItem): ItemRow {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    notes: item.notes,
    local_date: item.date,
    local_time: item.time,
    time_zone: item.timeZone,
    starts_at: item.startsAt,
    remind_at: item.remindAt,
    reminder_minutes: item.reminderMinutes,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt,
  };
}

export function fromRow(row: ItemRow): CalendarItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ?? '',
    notes: row.notes ?? '',
    date: row.local_date,
    // Postgres returns "15:27:00"; keep HH:MM:SS.
    time: row.local_time ? row.local_time.slice(0, 8) : null,
    timeZone: row.time_zone,
    startsAt: iso(row.starts_at),
    remindAt: iso(row.remind_at),
    reminderMinutes: row.reminder_minutes,
    createdAt: iso(row.created_at) as string,
    updatedAt: iso(row.updated_at) as string,
    deletedAt: iso(row.deleted_at),
  };
}

/**
 * Remote rows folded into local items. Items with unsent local changes
 * (`dirty`) keep the local copy unless the server's is newer.
 */
export function mergeRemote(
  local: CalendarItem[],
  remote: CalendarItem[],
  dirty: ReadonlySet<string>,
): CalendarItem[] {
  const byId = new Map(local.map((item) => [item.id, item]));
  for (const incoming of remote) {
    const mine = byId.get(incoming.id);
    if (!mine) {
      byId.set(incoming.id, incoming);
      continue;
    }
    const newer = Date.parse(incoming.updatedAt) > Date.parse(mine.updatedAt);
    if (newer || (!dirty.has(incoming.id) && incoming.updatedAt === mine.updatedAt)) {
      byId.set(incoming.id, incoming);
    }
  }
  return [...byId.values()];
}

/**
 * One round: send what changed here, then fetch what changed there since
 * the last round. Returns the merged items, the ids still unsent, and the
 * new high-water mark.
 */
export async function syncRound(
  client: SupabaseRest,
  items: CalendarItem[],
  dirty: ReadonlySet<string>,
  since: string | null,
): Promise<{ items: CalendarItem[]; dirty: Set<string>; since: string | null }> {
  const outgoing = items.filter((item) => dirty.has(item.id));
  await client.upsert(TABLE, outgoing.map(toRow));
  const sent = new Set(outgoing.map((item) => item.id));
  const stillDirty = new Set([...dirty].filter((id) => !sent.has(id)));

  const rows = await client.select<ItemRow>(TABLE, since ?? undefined);
  const remote = rows.map(fromRow);
  const merged = mergeRemote(items, remote, stillDirty);
  const latest = remote.reduce<string | null>(
    (max, item) => (!max || item.updatedAt > max ? item.updatedAt : max),
    since,
  );
  return { items: merged, dirty: stillDirty, since: latest };
}
