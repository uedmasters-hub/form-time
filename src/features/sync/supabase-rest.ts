/**
 * A minimal Supabase client over its HTTP APIs — Auth (GoTrue) for an
 * anonymous session and PostgREST for the calendar_items table. Plain
 * `fetch`, so it runs on web and native without the SDK's polyfills.
 */

export type SyncProblem =
  /** No connection, or the server didn't answer in time. */
  | 'offline'
  /** Anonymous sign-ins are switched off in the project. */
  | 'auth-disabled'
  /** The calendar_items table hasn't been created (run the migration). */
  | 'table-missing'
  /** The session was refused and couldn't be renewed. */
  | 'unauthorized'
  /** Anything else the server reported. */
  | 'server';

export class SyncError extends Error {
  constructor(
    readonly problem: SyncProblem,
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  userId: string;
};

export type SessionStore = {
  load: () => Session | null;
  save: (session: Session | null) => void;
};

type Fetch = typeof fetch;

const TIMEOUT_MS = 12_000;
/** Renew a little before expiry so a request never carries a stale token. */
const EXPIRY_MARGIN_MS = 60_000;

export function createSupabaseRest(
  url: string,
  key: string,
  sessions: SessionStore,
  fetchImpl: Fetch = (...args) => fetch(...args),
) {
  let session = sessions.load();
  let pending: Promise<Session> | null = null;

  async function request(path: string, init: RequestInit & { token?: string }) {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
    try {
      return await fetchImpl(`${url}${path}`, {
        ...init,
        signal: controller?.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${init.token ?? key}`,
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } catch {
      throw new SyncError('offline', 'Couldn’t reach the server');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function readError(res: Response): Promise<{ code?: string; message: string }> {
    try {
      const body = (await res.json()) as Record<string, unknown>;
      const code = String(body.error_code ?? body.code ?? '');
      const message = String(body.msg ?? body.message ?? body.error_description ?? res.statusText);
      return { code, message };
    } catch {
      return { message: res.statusText || `HTTP ${res.status}` };
    }
  }

  function fromAuthResponse(body: Record<string, unknown>): Session {
    const user = body.user as { id?: string } | undefined;
    const expiresAt =
      typeof body.expires_at === 'number'
        ? body.expires_at * 1000
        : Date.now() + Number(body.expires_in ?? 3600) * 1000;
    if (!body.access_token || !body.refresh_token || !user?.id) {
      throw new SyncError('server', 'Unexpected sign-in response');
    }
    return {
      accessToken: String(body.access_token),
      refreshToken: String(body.refresh_token),
      expiresAt,
      userId: user.id,
    };
  }

  async function signInAnonymously(): Promise<Session> {
    const res = await request('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ data: {} }),
    });
    if (!res.ok) {
      const { code, message } = await readError(res);
      if (
        code === 'anonymous_provider_disabled' ||
        /anonymous sign-ins are disabled/i.test(message)
      ) {
        throw new SyncError('auth-disabled', 'Anonymous sign-ins are turned off in Supabase');
      }
      throw new SyncError('server', message);
    }
    return fromAuthResponse((await res.json()) as Record<string, unknown>);
  }

  async function refresh(current: Session): Promise<Session | null> {
    const res = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });
    if (res.ok) return fromAuthResponse((await res.json()) as Record<string, unknown>);
    if (res.status >= 500) throw new SyncError('server', (await readError(res)).message);
    return null; // revoked or expired refresh token
  }

  /** A valid session: the stored one, renewed if needed, or a new anonymous one. */
  async function ensureSession(): Promise<Session> {
    if (session && session.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return session;
    if (!pending) {
      pending = (async () => {
        let next = session ? await refresh(session) : null;
        if (!next) {
          if (session) {
            // The old identity is gone; its rows can't be reached any more.
            throw new SyncError('unauthorized', 'The saved session expired');
          }
          next = await signInAnonymously();
        }
        session = next;
        sessions.save(next);
        return next;
      })().finally(() => {
        pending = null;
      });
    }
    return pending;
  }

  async function rest(path: string, init: RequestInit = {}): Promise<Response> {
    const { accessToken } = await ensureSession();
    let res = await request(`/rest/v1/${path}`, { ...init, token: accessToken });
    if (res.status === 401 && session) {
      // Token revoked early: renew once and retry.
      session = { ...session, expiresAt: 0 };
      const renewed = await ensureSession();
      res = await request(`/rest/v1/${path}`, { ...init, token: renewed.accessToken });
    }
    if (res.ok) return res;
    const { code, message } = await readError(res);
    if (
      code === 'PGRST205' ||
      code === '42P01' ||
      // A column the app sends isn't there yet: a newer migration hasn't run.
      code === 'PGRST204' ||
      code === '42703' ||
      (res.status === 404 && /relation|table/i.test(message))
    ) {
      throw new SyncError(
        'table-missing',
        'The calendar_items table isn’t set up, or is missing a newer migration',
      );
    }
    if (res.status === 401 || res.status === 403) throw new SyncError('unauthorized', message);
    throw new SyncError('server', message);
  }

  return {
    ensureSession,
    /** Signed-in user id, if any. */
    userId: () => session?.userId ?? null,
    /** Rows changed after `since` (ISO), or all rows. */
    async select<Row>(table: string, since?: string): Promise<Row[]> {
      const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : '';
      const res = await rest(`${table}?select=*${filter}&order=updated_at.asc`);
      return (await res.json()) as Row[];
    },
    /** Insert or update by primary key. */
    async upsert(table: string, rows: object[]): Promise<void> {
      if (rows.length === 0) return;
      await rest(`${table}?on_conflict=id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    },
  };
}

export type SupabaseRest = ReturnType<typeof createSupabaseRest>;
