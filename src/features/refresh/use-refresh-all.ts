import { useCallback } from 'react';

import { useEvents } from '@/features/events/EventsProvider';
import type { CalendarItem } from '@/features/events/types';
import { useGoogleSync } from '@/features/google/GoogleSyncProvider';
import { useSettings } from '@/features/settings/SettingsProvider';

/** How a pull to refresh went, for the note that answers it. */
export type RefreshOutcome =
  | { kind: 'updated'; changes: number }
  | { kind: 'current'; deviceOnly: boolean }
  | { kind: 'failed'; message: string };

/** One short line for the note. */
export function refreshMessage(outcome: RefreshOutcome): string {
  switch (outcome.kind) {
    case 'updated':
      return outcome.changes > 0
        ? `Updated · ${outcome.changes} ${outcome.changes === 1 ? 'change' : 'changes'}`
        : 'Updated';
    case 'current':
      return outcome.deviceOnly ? 'Up to date · on this device' : 'Up to date';
    case 'failed':
      return outcome.message;
  }
}

/** id → when it last changed (deleted ones included), to count what a refresh brought. */
function snapshot(items: CalendarItem[]) {
  return new Map(items.map((item) => [item.id, `${item.updatedAt}|${item.deletedAt ?? ''}`]));
}

function changesBetween(before: Map<string, string>, after: Map<string, string>) {
  let changes = 0;
  for (const [id, stamp] of after) if (before.get(id) !== stamp) changes++;
  for (const id of before.keys()) if (!after.has(id)) changes++;
  return changes;
}

/**
 * Everything a pull to refresh brings up to date: the user's items (and so
 * their reminders, which follow the items), Google Calendar when connected,
 * and the account's settings. Each source merges by id and keeps changes
 * made here that haven't been sent, so a refresh never doubles an event or
 * drops an edit; nothing on screen is reset.
 */
export function useRefreshAll(): () => Promise<RefreshOutcome> {
  const events = useEvents();
  const google = useGoogleSync();
  const { syncSettings } = useSettings();
  const { getAll, refresh: refreshEvents } = events;
  const { refresh: refreshGoogle } = google;

  return useCallback(async () => {
    const before = snapshot(getAll());
    const [items, settings] = await Promise.all([
      refreshEvents().catch(() => ({
        remote: true,
        problem: 'Couldn’t refresh — try again',
      })),
      syncSettings().catch(() => 'failed' as const),
    ]);
    // After the account round, so Google works from the latest items.
    const calendar = await refreshGoogle().catch(() => ({
      connected: true,
      problem: 'Couldn’t sync with Google Calendar',
    }));
    const changes = changesBetween(before, snapshot(getAll()));

    const problem =
      items.problem ??
      calendar.problem ??
      (settings === 'failed' ? 'Couldn’t reach your account — try again' : null);
    if (problem && changes === 0) return { kind: 'failed', message: problem };
    if (changes > 0 || settings === 'applied') return { kind: 'updated', changes };
    return {
      kind: 'current',
      deviceOnly: !items.remote && !calendar.connected,
    };
  }, [getAll, refreshEvents, refreshGoogle, syncSettings]);
}
