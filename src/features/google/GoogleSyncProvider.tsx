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

import { useEvents } from '@/features/events/EventsProvider';
import { useSettings } from '@/features/settings/SettingsProvider';

import { GoogleApiError, createGoogleCalendar } from './google-api';
import {
  GoogleAuthError,
  loadGis,
  loadedGis,
  requestGoogleToken,
  revokeGoogleToken,
} from './google-auth';
import { GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_ID } from './google-config';
import { SYNC_KINDS } from './google-map';
import { clearGoogle, readGoogle, writeGoogle } from './google-store';
import { syncGoogleRound, type GoogleCounts } from './google-sync';

/**
 * Two-way sync with the user's Google Calendar, while FORM / TIME is open:
 * after a change here (a few seconds later), when the app comes back to the
 * foreground, every five minutes, and on "Sync now". The access token from
 * Google lasts about an hour; when it runs out, syncing pauses and Settings
 * offers Reconnect (a click, so the browser allows Google's window).
 */
export type GoogleStatus =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'synced'; at: number; counts: GoogleCounts | null }
  | { state: 'reconnect'; message: string }
  | { state: 'problem'; message: string };

type GoogleContextValue = {
  /** Set up for this build (web, with a client ID). */
  available: boolean;
  connected: boolean;
  /** The connected Google account (the primary calendar's name). */
  account: string;
  status: GoogleStatus;
  /** A Google window is open. */
  busy: boolean;
  /** Load Google's sign-in script ahead of a click. */
  prepare: () => void;
  connect: () => void;
  disconnect: () => void;
  syncNow: () => void;
  /**
   * Pull to refresh: a round now, once any round in flight has finished.
   * `connected` false when there's no Google calendar to ask.
   */
  refresh: () => Promise<{ connected: boolean; problem: string | null }>;
};

const GoogleContext = createContext<GoogleContextValue | null>(null);

export function useGoogleSync(): GoogleContextValue {
  const value = useContext(GoogleContext);
  if (!value) throw new Error('useGoogleSync must be used inside <GoogleSyncProvider>');
  return value;
}

const PERIODIC_MS = 5 * 60_000;
const AFTER_CHANGE_MS = 2500;
/** Treat a token as spent a minute early, so a round never starts on a dying one. */
const TOKEN_MARGIN_MS = 60_000;

const available = Platform.OS === 'web' && GOOGLE_CLIENT_ID !== '';

const EXPIRED = 'Google access has run out — reconnect to keep syncing';

/** Changes to syncable items, in a few characters, to tell when to sync. */
function fingerprint(items: { id: string; kind: string; updatedAt: string }[]) {
  return items
    .filter((item) => SYNC_KINDS.has(item.kind as never))
    .map((item) => `${item.id}@${item.updatedAt}`)
    .sort()
    .join(',');
}

export function GoogleSyncProvider({ children }: { children: ReactNode }) {
  const { items, loaded, getAll, applyExternal } = useEvents();
  const { timeZone } = useSettings();
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [status, setStatus] = useState<GoogleStatus>({ state: 'off' });
  const [busy, setBusy] = useState(false);

  const running = useRef(false);
  /** How the last round ended: null, or what went wrong. */
  const lastProblem = useRef<string | null>(null);
  const again = useRef(false);
  const synced = useRef<string | null>(null);
  const zone = useRef(timeZone);
  useEffect(() => {
    zone.current = timeZone;
  }, [timeZone]);

  const round = useCallback(async () => {
    if (!available) return;
    if (running.current) {
      again.current = true;
      return;
    }
    const stored = readGoogle();
    if (!stored.connected) return;
    if (!stored.token || stored.token.expiresAt - TOKEN_MARGIN_MS < Date.now()) {
      lastProblem.current = EXPIRED;
      setStatus({ state: 'reconnect', message: EXPIRED });
      return;
    }
    running.current = true;
    setStatus({ state: 'syncing' });
    try {
      const result = await syncGoogleRound({
        api: createGoogleCalendar(stored.token.accessToken),
        calendarId: GOOGLE_CALENDAR_ID,
        items: getAll(),
        links: stored.links,
        now: Date.now(),
        timeZone: zone.current,
      });
      // Items edited here while the round ran keep their edit, and their old
      // link, so the next round merges them properly.
      const skipped = applyExternal(result.changes);
      const links = { ...result.links };
      for (const id of skipped) {
        if (stored.links[id]) links[id] = stored.links[id];
        else delete links[id];
      }
      const latest = readGoogle();
      if (!latest.connected) return; // disconnected meanwhile
      writeGoogle({
        ...latest,
        links,
        account: result.account || latest.account,
        lastSync: result.error ? latest.lastSync : Date.now(),
      });
      setAccount(result.account || latest.account);
      synced.current = fingerprint(getAll());

      const error = result.error;
      lastProblem.current = error
        ? error instanceof GoogleApiError && error.problem === 'offline'
          ? 'Offline — will sync with Google when you’re back'
          : error instanceof GoogleApiError &&
              (error.problem === 'unauthorized' || error.problem === 'forbidden')
            ? EXPIRED
            : 'Couldn’t sync with Google Calendar'
        : null;
      if (!error) {
        setStatus({ state: 'synced', at: Date.now(), counts: result.counts });
      } else if (error instanceof GoogleApiError) {
        if (error.problem === 'unauthorized') {
          writeGoogle({ ...readGoogle(), token: null });
          setStatus({ state: 'reconnect', message: EXPIRED });
        } else if (error.problem === 'forbidden') {
          setStatus({
            state: 'reconnect',
            message: 'Google didn’t allow access to your calendar — reconnect and allow it',
          });
        } else if (error.problem === 'offline') {
          setStatus({
            state: 'problem',
            message: 'Offline — will sync with Google when you’re back',
          });
        } else {
          setStatus({
            state: 'problem',
            message: `Google Calendar: ${error.message}`,
          });
        }
      } else {
        setStatus({
          state: 'problem',
          message: 'Couldn’t sync with Google Calendar',
        });
      }
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void round();
      }
    }
  }, [getAll, applyExternal]);

  // Pick up a connection made earlier, once the items have loaded.
  useEffect(() => {
    if (!available || !loaded) return;
    const stored = readGoogle();
    setConnected(stored.connected);
    setAccount(stored.account);
    if (stored.connected) void round();
  }, [loaded, round]);

  // Every few minutes, and on return to the app.
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => void round(), PERIODIC_MS);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void round();
    });
    return () => {
      clearInterval(interval);
      app.remove();
    };
  }, [connected, round]);

  // A few seconds after events or meetings change here.
  useEffect(() => {
    if (!connected || !loaded) return;
    if (fingerprint(getAll()) === synced.current) return;
    const timer = setTimeout(() => void round(), AFTER_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [items, connected, loaded, getAll, round]);

  const prepare = useCallback(() => {
    if (available) void loadGis().catch(() => undefined);
  }, []);

  const connect = useCallback(() => {
    if (!available) return;
    const ask = async () => {
      setBusy(true);
      try {
        const gis = loadedGis() ?? (await loadGis());
        const token = await requestGoogleToken(gis, '');
        writeGoogle({ ...readGoogle(), connected: true, token });
        setConnected(true);
        void round();
      } catch (error) {
        if (error instanceof GoogleAuthError && error.cancelled) return;
        setStatus({
          state: 'problem',
          message: error instanceof Error ? error.message : 'Google didn’t connect',
        });
      } finally {
        setBusy(false);
      }
    };
    void ask();
  }, [round]);

  const disconnect = useCallback(() => {
    const stored = readGoogle();
    if (stored.token) revokeGoogleToken(stored.token.accessToken);
    clearGoogle();
    synced.current = null;
    setConnected(false);
    setAccount('');
    setStatus({ state: 'off' });
  }, []);

  const syncNow = useCallback(() => void round(), [round]);

  const refresh = useCallback(async () => {
    if (!available || !readGoogle().connected) return { connected: false, problem: null };
    const settle = async () => {
      for (let i = 0; running.current && i < 150; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    await settle();
    lastProblem.current = null;
    await round();
    await settle();
    return { connected: true, problem: lastProblem.current };
  }, [round]);

  const value = useMemo<GoogleContextValue>(
    () => ({
      available,
      connected,
      account,
      status,
      busy,
      prepare,
      connect,
      disconnect,
      syncNow,
      refresh,
    }),
    [connected, account, status, busy, prepare, connect, disconnect, syncNow, refresh],
  );

  return <GoogleContext.Provider value={value}>{children}</GoogleContext.Provider>;
}
