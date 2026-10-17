import { createHttp, NetworkError, readError, type Fetch } from './http';

/**
 * The signed-in user's tables over PostgREST. Every request carries the
 * user's access token, and row-level security in the database limits it to
 * that user's own rows.
 */

export type SyncProblem =
  /** No connection, or the server didn't answer in time. */
  | 'offline'
  /** A table or column is missing: a migration hasn't been run. */
  | 'table-missing'
  /** The session ended and couldn't be renewed: sign in again. */
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

/** Where requests get the user's access token. */
export type TokenSource = {
  /** A current access token, renewed first if it's about to expire. */
  accessToken: () => Promise<string>;
  /** Renews after a 401; null when the session can't be renewed. */
  renew: () => Promise<string | null>;
};

export function createSupabaseRest(
  url: string,
  key: string,
  tokens: TokenSource,
  fetchImpl?: Fetch,
) {
  const http = createHttp(url, key, fetchImpl);

  async function rest(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await http.request(`/rest/v1/${path}`, { ...init, token: await tokens.accessToken() });
      if (res.status === 401) {
        // Token revoked early: renew once and retry.
        const renewed = await tokens.renew();
        if (!renewed) throw new SyncError('unauthorized', 'Your session ended');
        res = await http.request(`/rest/v1/${path}`, { ...init, token: renewed });
      }
    } catch (error) {
      if (error instanceof NetworkError) throw new SyncError('offline', error.message);
      throw error;
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
      throw new SyncError('table-missing', 'A table isn’t set up, or a newer migration is missing');
    }
    if (res.status === 401 || res.status === 403) throw new SyncError('unauthorized', message);
    throw new SyncError('server', message);
  }

  return {
    /** Rows changed after `since` (ISO), or all of them. */
    async select<Row>(table: string, since?: string): Promise<Row[]> {
      const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : '';
      const res = await rest(`${table}?select=*${filter}&order=updated_at.asc`);
      return (await res.json()) as Row[];
    },
    /** Insert or update, matching on `onConflict`. */
    async upsert(table: string, rows: object[], onConflict = 'id'): Promise<void> {
      if (rows.length === 0) return;
      await rest(`${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    },
  };
}

export type SupabaseRest = ReturnType<typeof createSupabaseRest>;
