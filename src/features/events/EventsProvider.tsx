import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAccount } from '@/features/account/AccountProvider';
import { isImportedId } from '@/features/google/google-map';
import { carryGoogleLinks } from '@/features/google/google-store';
import { readJSON, writeJSON } from '@/lib/device-storage';
import { SyncError, type SyncProblem } from '@/features/sync/supabase-rest';

import { newId } from './item-time';
import { carryReminders } from './reminder-state';
import { mergeRemote, syncRound } from './sync';
import type { CalendarItem } from './types';

/**
 * The user's items, kept on this device first and, when signed in, synced
 * to their Supabase account in the background. Saving never waits for the network: a change is stored here,
 * marked unsent, and pushed on the next sync round (after a change, on
 * reconnect, when the app comes back to the foreground, and every few
 * minutes). The sync status says plainly where things stand.
 */
export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'synced'; at: number }
  | { state: 'device-only'; reason: string }
  | { state: 'problem'; problem: SyncProblem; message: string; unsent: number };

type EventsContextValue = {
  /** Items not deleted, in no particular order. */
  items: CalendarItem[];
  loaded: boolean;
  status: SyncStatus;
  save: (item: CalendarItem) => void;
  remove: (id: string) => void;
  syncNow: () => void;
  /** Syncs now and resolves with how many changes still haven't reached the account. */
  flush: () => Promise<number>;
  /** Changes not yet in the account. */
  unsent: number;
  /** Every item as stored, deleted ones included (for calendar sync). */
  getAll: () => CalendarItem[];
  /**
   * Changes from another calendar (Google), stored like the user's own and
   * sent on to the account. Each applies only if the item still has the
   * `base` updatedAt it was worked out from; the ids of any that changed in
   * the meantime come back, untouched, for the next round.
   */
  applyExternal: (changes: { item: CalendarItem; base: string | null }[]) => string[];
  /**
   * Pull to refresh: a sync round now (signed in), or this device's stored
   * copy read again (signed out — another tab may have changed it). Merges
   * by id, so nothing doubles, and unsent changes here are kept.
   */
  refresh: () => Promise<EventsRefresh>;
};

export type EventsRefresh = {
  /** Checked with the account (false: this device only). */
  remote: boolean;
  /** What went wrong, in a sentence; null when it worked. */
  problem: string | null;
};

const ITEMS_KEY = 'formtime.items.v1';
const PERIODIC_MS = 5 * 60_000;
const DEBOUNCE_MS = 600;

/**
 * `owner`: the account these items belong to, or null for items made while
 * signed out. Another account's items never show here.
 */
type Stored = { owner?: string | null; items: CalendarItem[]; dirty: string[] };

const EventsContext = createContext<EventsContextValue | null>(null);

export function useEvents(): EventsContextValue {
  const value = useContext(EventsContext);
  if (!value) throw new Error('useEvents must be used inside <EventsProvider>');
  return value;
}

const PROBLEM_TEXT: Record<SyncProblem, string> = {
  offline: 'Offline — saved on this device; will sync when you’re back online',
  'table-missing': 'Saved on this device — run the Supabase migrations to sync',
  unauthorized: 'Your session ended — sign in again to sync',
  server: 'Saved on this device — the server reported a problem',
};

const SIGNED_OUT: SyncStatus = {
  state: 'device-only',
  reason: 'On this device only — sign in to keep them in your account',
};

export function EventsProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<CalendarItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' });
  const [unsent, setUnsent] = useState(0);
  const { state: account, rest, keepDeviceItems } = useAccount();

  const allRef = useRef<CalendarItem[]>([]);
  const ownerRef = useRef<string | null>(null);
  const dirtyRef = useRef(new Set<string>());
  const editedDuringSync = useRef(new Set<string>());
  const syncing = useRef(false);
  const again = useRef(false);
  const clientRef = useRef(rest);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** How the last sync round ended: null, or what went wrong. */
  const lastProblem = useRef<string | null>(null);

  const commit = useCallback((items: CalendarItem[]) => {
    allRef.current = items;
    setAll(items);
    setUnsent(dirtyRef.current.size);
    writeJSON(ITEMS_KEY, {
      owner: ownerRef.current,
      items,
      dirty: [...dirtyRef.current],
    } satisfies Stored);
  }, []);

  const runSync = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    if (syncing.current) {
      again.current = true;
      return;
    }
    syncing.current = true;
    editedDuringSync.current.clear();
    setStatus({ state: 'syncing' });
    try {
      const owner = ownerRef.current;
      const result = await syncRound(client, allRef.current, dirtyRef.current, null);
      // Signed out (or switched account) while the round was in flight.
      if (ownerRef.current !== owner || clientRef.current !== client) return;
      // Changes made while the round was in flight win over what it brought back.
      const edited = editedDuringSync.current;
      const current = new Map(allRef.current.map((item) => [item.id, item]));
      const merged = result.items.map((item) =>
        edited.has(item.id) ? (current.get(item.id) ?? item) : item,
      );
      for (const id of edited) {
        if (!merged.some((item) => item.id === id) && current.has(id)) {
          merged.push(current.get(id) as CalendarItem);
        }
      }
      dirtyRef.current = new Set([...result.dirty, ...edited]);
      commit(merged);
      lastProblem.current = null;
      setStatus({ state: 'synced', at: Date.now() });
    } catch (error) {
      const problem = error instanceof SyncError ? error.problem : 'server';
      lastProblem.current = PROBLEM_TEXT[problem];
      setStatus({
        state: 'problem',
        problem,
        message: PROBLEM_TEXT[problem],
        unsent: dirtyRef.current.size,
      });
    } finally {
      syncing.current = false;
      if (again.current) {
        again.current = false;
        void runSync();
      }
    }
  }, [commit]);

  const scheduleSync = useCallback(
    (delay = DEBOUNCE_MS) => {
      if (!clientRef.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void runSync(), delay);
    },
    [runSync],
  );

  // Load after mount (the static web render has no storage).
  useEffect(() => {
    const stored = readJSON<Stored>(ITEMS_KEY);
    if (stored && Array.isArray(stored.items)) {
      // Items saved before a field existed get its empty value.
      const items = stored.items.map((item) => ({
        ...item,
        place: item.place ?? '',
      }));
      allRef.current = items;
      ownerRef.current = stored.owner ?? null;
      dirtyRef.current = new Set(stored.dirty ?? []);
      setAll(items);
      setUnsent(dirtyRef.current.size);
    }
    setLoaded(true);
  }, []);

  // Declared before the account effect below, so the client is current when it syncs.
  useEffect(() => {
    clientRef.current = rest;
  }, [rest]);

  // Follow the account: take this device's items into it on sign-in, keep
  // another account's items off the screen, clear them on sign-out.
  const accountUser = account.status === 'signed-in' ? account.user.id : null;
  const ended = account.status === 'signed-out' ? account.ended : null;
  useEffect(() => {
    if (!loaded || account.status === 'loading') return;
    const owner = ownerRef.current;
    if (accountUser) {
      if (owner !== accountUser) {
        let items: CalendarItem[] = [];
        if (owner === null && keepDeviceItems.current) {
          // Made here while signed out: they join the account under new ids,
          // so they can't collide with rows from an earlier session. Events
          // imported from Google keep theirs: the same event has the same id
          // everywhere, so it merges with the account's copy, never doubles.
          const now = new Date().toISOString();
          const renamed: Record<string, string> = {};
          items = allRef.current
            .filter((item) => !item.deletedAt)
            .map((item) => {
              const id = isImportedId(item.id) ? item.id : newId();
              if (id !== item.id) renamed[item.id] = id;
              return { ...item, id, updatedAt: now };
            });
          carryReminders(renamed);
          carryGoogleLinks(renamed);
        }
        keepDeviceItems.current = true;
        ownerRef.current = accountUser;
        dirtyRef.current = new Set(items.map((item) => item.id));
        commit(items);
      }
      void runSync();
      return;
    }
    if (ended && owner === ended.id) {
      // The session ended: keep everything (and the unsent changes) until
      // the same account signs in again.
      setStatus({
        state: 'problem',
        problem: 'unauthorized',
        message: PROBLEM_TEXT.unauthorized,
        unsent: dirtyRef.current.size,
      });
      return;
    }
    if (owner !== null) {
      // Signed out: the account's items leave this device.
      ownerRef.current = null;
      dirtyRef.current = new Set();
      commit([]);
    }
    setStatus(SIGNED_OUT);
  }, [loaded, account.status, accountUser, ended, keepDeviceItems, commit, runSync]);

  // Sync again on reconnect, on return to the foreground, and periodically.
  useEffect(() => {
    if (!loaded || !rest) return;
    const interval = setInterval(() => void runSync(), PERIODIC_MS);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleSync(0);
    });
    const online = () => scheduleSync(0);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', online);
    }
    return () => {
      clearInterval(interval);
      app.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', online);
      }
    };
  }, [loaded, rest, runSync, scheduleSync]);

  const save = useCallback(
    (item: CalendarItem) => {
      const stamped = { ...item, updatedAt: new Date().toISOString() };
      const rest = allRef.current.filter((existing) => existing.id !== item.id);
      dirtyRef.current.add(item.id);
      if (syncing.current) editedDuringSync.current.add(item.id);
      commit([...rest, stamped]);
      scheduleSync();
    },
    [commit, scheduleSync],
  );

  const remove = useCallback(
    (id: string) => {
      const target = allRef.current.find((item) => item.id === id);
      if (!target) return;
      const now = new Date().toISOString();
      save({ ...target, deletedAt: now, remindAt: null });
    },
    [save],
  );

  const syncNow = useCallback(() => scheduleSync(0), [scheduleSync]);

  const getAll = useCallback(() => allRef.current, []);

  const applyExternal = useCallback(
    (changes: { item: CalendarItem; base: string | null }[]) => {
      if (changes.length === 0) return [];
      const current = new Map(allRef.current.map((item) => [item.id, item]));
      const skipped: string[] = [];
      for (const { item, base } of changes) {
        const existing = current.get(item.id);
        if (existing && existing.updatedAt !== base) {
          skipped.push(item.id); // edited here while the other calendar synced
          continue;
        }
        current.set(item.id, item);
        dirtyRef.current.add(item.id);
        if (syncing.current) editedDuringSync.current.add(item.id);
      }
      commit([...current.values()]);
      scheduleSync();
      return skipped;
    },
    [commit, scheduleSync],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await runSync();
    // A round already in flight finishes (and runs again) on its own.
    for (let i = 0; syncing.current && i < 150; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return dirtyRef.current.size;
  }, [runSync]);

  const refresh = useCallback(async (): Promise<EventsRefresh> => {
    if (clientRef.current) {
      lastProblem.current = null;
      await flush();
      return { remote: true, problem: lastProblem.current };
    }
    // Signed in once, but the session ended: nothing to ask until sign-in.
    if (ownerRef.current !== null) return { remote: false, problem: PROBLEM_TEXT.unauthorized };
    const stored = readJSON<Stored>(ITEMS_KEY);
    if (stored && (stored.owner ?? null) === null && Array.isArray(stored.items)) {
      const fromStore = stored.items.map((item) => ({
        ...item,
        place: item.place ?? '',
      }));
      const merged = mergeRemote(allRef.current, fromStore, dirtyRef.current);
      const key = (items: CalendarItem[]) =>
        items
          .map((item) => `${item.id}@${item.updatedAt}`)
          .sort()
          .join(',');
      if (key(merged) !== key(allRef.current)) commit(merged);
    }
    return { remote: false, problem: null };
  }, [flush, commit]);

  const value = useMemo<EventsContextValue>(
    () => ({
      items: all.filter((item) => !item.deletedAt),
      loaded,
      status,
      save,
      remove,
      syncNow,
      flush,
      unsent,
      getAll,
      applyExternal,
      refresh,
    }),
    [all, loaded, status, save, remove, syncNow, flush, unsent, getAll, applyExternal, refresh],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}
