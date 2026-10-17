import type { SupabaseRest } from '@/features/sync/supabase-rest';

import { sanitizeSettings, type Settings } from './settings';

/**
 * Settings follow the account: one row per user in user_settings, last
 * write wins. The first time a device meets an account, the account's
 * saved settings win, so signing in on a new device brings your clock and
 * calendar with you.
 */
export const SETTINGS_TABLE = 'user_settings';

/** When settings last changed here, and which account they were last synced with. */
export type SettingsMeta = { updatedAt: string; owner: string | null };

/** Settings that were never changed on this device are older than any saved copy. */
export const NEVER = '1970-01-01T00:00:00.000Z';

export type RemoteSettings = { settings: Settings; updatedAt: string };

export type Reconcile =
  | { action: 'apply'; settings: Settings; updatedAt: string }
  | { action: 'push' }
  | { action: 'none' };

export function reconcile(
  meta: SettingsMeta,
  remote: RemoteSettings | null,
  userId: string,
): Reconcile {
  if (!remote) return { action: 'push' };
  const remoteAt = Date.parse(remote.updatedAt);
  const localAt = Date.parse(meta.updatedAt);
  if (meta.owner !== userId || remoteAt > localAt) {
    return { action: 'apply', settings: remote.settings, updatedAt: remote.updatedAt };
  }
  return localAt > remoteAt ? { action: 'push' } : { action: 'none' };
}

type Row = { settings: unknown; updated_at: string };

export async function pullSettings(rest: SupabaseRest): Promise<RemoteSettings | null> {
  const rows = await rest.select<Row>(SETTINGS_TABLE);
  const row = rows[0];
  if (!row) return null;
  return {
    settings: sanitizeSettings(row.settings),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function pushSettings(rest: SupabaseRest, settings: Settings, updatedAt: string) {
  // user_id defaults to the signed-in user (auth.uid()) in the database.
  return rest.upsert(SETTINGS_TABLE, [{ settings, updated_at: updatedAt }], 'user_id');
}
