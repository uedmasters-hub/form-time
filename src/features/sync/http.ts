/**
 * The one way FORM / TIME talks to Supabase: plain `fetch` with a timeout,
 * so it runs on web and native without the SDK and its polyfills.
 *
 * The publishable key goes only in the `apikey` header. `Authorization`
 * carries a signed-in user's access token, never the key: Supabase's
 * publishable keys aren't JWTs, and a Bearer key can be refused as one.
 */
export type Fetch = typeof fetch;

export class NetworkError extends Error {
  constructor() {
    super('Couldn’t reach the server');
    this.name = 'NetworkError';
  }
}

const TIMEOUT_MS = 12_000;

export type Http = {
  request: (path: string, init?: RequestInit & { token?: string }) => Promise<Response>;
};

export function createHttp(
  url: string,
  key: string,
  fetchImpl: Fetch = (...a) => fetch(...a),
): Http {
  return {
    async request(path, init = {}) {
      const { token, headers, ...rest } = init;
      const controller = typeof AbortController === 'undefined' ? null : new AbortController();
      const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
      try {
        return await fetchImpl(`${url}${path}`, {
          ...rest,
          signal: controller?.signal,
          headers: {
            apikey: key,
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : null),
            ...(headers as Record<string, string> | undefined),
          },
        });
      } catch {
        throw new NetworkError();
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

/** The error code and message from an Auth or PostgREST error body. */
export async function readError(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    return {
      code: String(body.error_code ?? body.code ?? body.error ?? ''),
      message: String(
        body.msg ??
          body.message ??
          body.error_description ??
          res.statusText ??
          `HTTP ${res.status}`,
      ),
    };
  } catch {
    return { code: '', message: res.statusText || `HTTP ${res.status}` };
  }
}
