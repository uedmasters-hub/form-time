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
import { Platform } from 'react-native';

import { readJSON, removeKey, writeJSON } from '@/lib/device-storage';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/features/sync/config';
import {
  createSupabaseRest,
  SyncError,
  type SupabaseRest,
  type TokenSource,
} from '@/features/sync/supabase-rest';

import {
  AuthError,
  createAuthApi,
  parseAuthRedirect,
  type AccountUser,
  type AuthRedirect,
  type AuthSession,
} from './auth-api';

/**
 * Who is signed in. Signed out, FORM / TIME works fully on this device;
 * signed in, items and settings are kept in the person's Supabase account
 * (private to them by row-level security) and synced between devices.
 *
 * The session lives on this device (localStorage on web, like Supabase's
 * own client) and is renewed before it expires. Tabs share it: a sign-in,
 * renewal or sign-out in one tab reaches the others.
 */
export type AccountState =
  | { status: 'loading' }
  /** `ended`: the last account, when its session ended rather than being signed out. */
  | { status: 'signed-out'; ended: AccountUser | null }
  | { status: 'signed-in'; user: AccountUser };

export type SheetMode =
  'sign-in' | 'sign-up' | 'forgot' | 'check-email' | 'new-password' | 'welcome' | 'link-error';

export type AccountSheet = { mode: SheetMode; email?: string; message?: string };

type AccountContextValue = {
  state: AccountState;
  /** The signed-in user, or null. */
  user: AccountUser | null;
  /** The user's tables; null when signed out. */
  rest: SupabaseRest | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** 'signed-in', or 'confirm' when the inbox link must be opened first. */
  signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm'>;
  signOut: () => void;
  recover: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  /** Whether items made on this device while signed out join the account. */
  keepDeviceItems: { current: boolean };
  sheet: AccountSheet | null;
  openSheet: (sheet: AccountSheet) => void;
  closeSheet: () => void;
};

const SESSION_KEY = 'formtime.account.v1';
/** The anonymous session from before accounts; no longer used. */
const LEGACY_SESSION_KEY = 'formtime.session.v1';
/** Renew a little before expiry so a request never carries a stale token. */
const EXPIRY_MARGIN_MS = 60_000;

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside <AccountProvider>');
  return value;
}

const api = createAuthApi(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/**
 * An email link's result. The page shell takes it out of the URL before the
 * router reads the address, so the tokens never go back into the address
 * bar or history; this picks it up once.
 */
let pendingLink: AuthRedirect | null = (() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  // Moved aside by the page shell before the router started (src/app/+html.tsx).
  const page = window as unknown as { __formtimeAuthLink?: string };
  const hash = page.__formtimeAuthLink ?? window.location.hash;
  delete page.__formtimeAuthLink;
  const link = parseAuthRedirect(hash);
  if (link && window.location.hash) {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
  }
  return link;
})();

/** Where email links come back to: this page (web), or the project's Site URL. */
function redirectUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>({ status: 'loading' });
  const [sheet, setSheet] = useState<AccountSheet | null>(null);
  const session = useRef<AuthSession | null>(null);
  const renewing = useRef<Promise<AuthSession | null> | null>(null);
  const keepDeviceItems = useRef(true);

  const adopt = useCallback((next: AuthSession | null, ended: AccountUser | null = null) => {
    session.current = next;
    if (next) writeJSON(SESSION_KEY, next);
    else removeKey(SESSION_KEY);
    setState((current) => {
      if (next) {
        return current.status === 'signed-in' &&
          current.user.id === next.user.id &&
          current.user.email === next.user.email
          ? current
          : { status: 'signed-in', user: next.user };
      }
      return { status: 'signed-out', ended };
    });
  }, []);

  /** Renews the session once, however many requests ask at the same time. */
  const renew = useCallback((): Promise<AuthSession | null> => {
    const current = session.current;
    if (!current) return Promise.resolve(null);
    if (!renewing.current) {
      renewing.current = (async () => {
        // Another tab may have renewed already (refresh tokens are single-use).
        const stored = readJSON<AuthSession>(SESSION_KEY);
        if (
          stored &&
          stored.user.id === current.user.id &&
          stored.refreshToken !== current.refreshToken &&
          stored.expiresAt - EXPIRY_MARGIN_MS > Date.now()
        ) {
          adopt(stored);
          return stored;
        }
        const next = await api.refresh(current.refreshToken);
        if (next) adopt(next);
        else adopt(null, current.user); // the session ended: sign in again
        return next;
      })().finally(() => {
        renewing.current = null;
      });
    }
    return renewing.current;
  }, [adopt]);

  const tokens = useMemo<TokenSource>(
    () => ({
      async accessToken() {
        const current = session.current;
        if (!current) throw new SyncError('unauthorized', 'Not signed in');
        if (current.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return current.accessToken;
        try {
          const next = await renew();
          if (!next) throw new SyncError('unauthorized', 'Your session ended');
          return next.accessToken;
        } catch (error) {
          if (error instanceof AuthError) {
            throw new SyncError(error.code === 'network' ? 'offline' : 'server', error.message);
          }
          throw error;
        }
      },
      async renew() {
        try {
          return (await renew())?.accessToken ?? null;
        } catch {
          return null;
        }
      },
    }),
    [renew],
  );

  const user = state.status === 'signed-in' ? state.user : null;
  const userId = user?.id ?? null;
  const rest = useMemo(
    () => (userId ? createSupabaseRest(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, tokens) : null),
    [userId, tokens],
  );

  /**
   * An email link's result in the URL: sign in with it (and ask for a new
   * password after a reset link), or say why it didn't work.
   */
  const followLink = useCallback(
    (link: AuthRedirect, onFail: () => void) => {
      // Take the tokens out of the address bar (and history) straight away.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (link.kind === 'error') {
        onFail();
        setSheet({ mode: 'link-error', message: link.message });
        return;
      }
      void (async () => {
        try {
          const linked = await api.getUser(link.accessToken);
          adopt({
            accessToken: link.accessToken,
            refreshToken: link.refreshToken,
            expiresAt: link.expiresAt,
            user: linked,
          });
          setSheet(
            link.type === 'recovery'
              ? { mode: 'new-password', email: linked.email }
              : { mode: 'welcome', email: linked.email },
          );
        } catch (error) {
          onFail();
          setSheet({
            mode: 'link-error',
            message: error instanceof Error ? error.message : 'That link didn’t work.',
          });
        }
      })();
    },
    [adopt],
  );

  // Start: an email link in the URL, else the saved session.
  useEffect(() => {
    removeKey(LEGACY_SESSION_KEY);
    const stored = readJSON<AuthSession>(SESSION_KEY);
    const saved = stored && stored.user?.id ? stored : null;
    const link = pendingLink;
    pendingLink = null;
    if (link) followLink(link, () => adopt(saved));
    else adopt(saved);
  }, [adopt, followLink]);

  // A link opened in this tab while it's already open.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onHash = () => {
      const link = parseAuthRedirect(window.location.hash);
      if (link) followLink(link, () => {});
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [followLink]);

  // Another tab signed in, renewed or signed out.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY) return;
      const next = readJSON<AuthSession>(SESSION_KEY);
      if (next?.user?.id) adopt(next);
      else if (session.current) adopt(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [adopt]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      adopt(await api.signIn(email.trim(), password));
    },
    [adopt],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const result = await api.signUp(email.trim(), password, redirectUrl());
      if ('session' in result) {
        adopt(result.session);
        return 'signed-in' as const;
      }
      return 'confirm' as const;
    },
    [adopt],
  );

  const signOut = useCallback(() => {
    const current = session.current;
    adopt(null);
    // Signing out here never waits for the network; the server is told if it can be.
    if (current) void api.signOut(current.accessToken).catch(() => {});
  }, [adopt]);

  const recover = useCallback((email: string) => api.recover(email.trim(), redirectUrl()), []);

  const setNewPassword = useCallback(
    async (password: string) => {
      await api.updatePassword(await tokens.accessToken(), password);
    },
    [tokens],
  );

  const openSheet = useCallback((next: AccountSheet) => setSheet(next), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const value = useMemo<AccountContextValue>(
    () => ({
      state,
      user,
      rest,
      signIn,
      signUp,
      signOut,
      recover,
      setNewPassword,
      keepDeviceItems,
      sheet,
      openSheet,
      closeSheet,
    }),
    [
      state,
      user,
      rest,
      signIn,
      signUp,
      signOut,
      recover,
      setNewPassword,
      sheet,
      openSheet,
      closeSheet,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
