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

import { hasDeviceStorage, readJSON, writeJSON } from '@/lib/device-storage';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/features/sync/config';
import {
  createSupabaseRest,
  SyncError,
  type Session,
  type SupabaseRest,
  type SyncProblem,
} from '@/features/sync/supabase-rest';

import { syncRound } from './sync';
import type { CalendarItem } from './types';

/**
 * The user's items, kept on this device first and synced to Supabase in the
 * background. Saving never waits for the network: a change is stored here,
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
};

const ITEMS_KEY = 'formtime.items.v1';
const SESSION_KEY = 'formtime.session.v1';
const PERIODIC_MS = 5 * 60_000;
const DEBOUNCE_MS = 600;

type Stored = { items: CalendarItem[]; dirty: string[] };

const EventsContext = createContext<EventsContextValue | null>(null);

export function useEvents(): EventsContextValue {
  const value = useContext(EventsContext);
  if (!value) throw new Error('useEvents must be used inside <EventsProvider>');
  return value;
}

function makeClient(): SupabaseRest | null {
  // Without device storage the anonymous identity would change every launch
  // and earlier items would be unreachable — so sync only where it persists.
  if (!hasDeviceStorage() || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  return createSupabaseRest(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    load: () => readJSON<Session>(SESSION_KEY),
    save: (session) => writeJSON(SESSION_KEY, session),
  });
}

const PROBLEM_TEXT: Record<SyncProblem, string> = {
  offline: 'Offline — saved on this device; will sync when you’re back online',
  'auth-disabled': 'Saved on this device — turn on anonymous sign-ins in Supabase to sync',
  'table-missing': 'Saved on this device — run the calendar_items migrations in Supabase to sync',
  unauthorized: 'Saved on this device — the sync session was refused',
  server: 'Saved on this device — the server reported a problem',
};

export function EventsProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<CalendarItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' });

  const allRef = useRef<CalendarItem[]>([]);
  const dirtyRef = useRef(new Set<string>());
  const editedDuringSync = useRef(new Set<string>());
  const syncing = useRef(false);
  const again = useRef(false);
  const clientRef = useRef<SupabaseRest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback((items: CalendarItem[]) => {
    allRef.current = items;
    setAll(items);
    writeJSON(ITEMS_KEY, { items, dirty: [...dirtyRef.current] } satisfies Stored);
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
      const result = await syncRound(client, allRef.current, dirtyRef.current, null);
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
      setStatus({ state: 'synced', at: Date.now() });
    } catch (error) {
      const problem = error instanceof SyncError ? error.problem : 'server';
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

  // Load after mount (the static web render has no storage), then sync.
  useEffect(() => {
    const stored = readJSON<Stored>(ITEMS_KEY);
    if (stored && Array.isArray(stored.items)) {
      // Items saved before a field existed get its empty value.
      const items = stored.items.map((item) => ({ ...item, place: item.place ?? '' }));
      allRef.current = items;
      dirtyRef.current = new Set(stored.dirty ?? []);
      setAll(items);
    }
    setLoaded(true);
    clientRef.current = makeClient();
    if (!clientRef.current) {
      setStatus({
        state: 'device-only',
        reason:
          Platform.OS === 'web'
            ? 'This browser blocks site storage, so items last for this visit only'
            : 'Kept for this session — saving on the device comes with the native build',
      });
      return;
    }
    void runSync();
  }, [runSync]);

  // Sync again on reconnect, on return to the foreground, and periodically.
  useEffect(() => {
    if (!loaded || !clientRef.current) return;
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
  }, [loaded, runSync, scheduleSync]);

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

  const value = useMemo<EventsContextValue>(
    () => ({
      items: all.filter((item) => !item.deletedAt),
      loaded,
      status,
      save,
      remove,
      syncNow,
    }),
    [all, loaded, status, save, remove, syncNow],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}
