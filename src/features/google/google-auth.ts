import { GOOGLE_CLIENT_ID, GOOGLE_GIS_SRC, GOOGLE_SCOPE } from './google-config';

/**
 * Google sign-in for calendar access, through Google Identity Services in
 * the browser (the "token model"): a popup asks once for permission, then
 * hands back a short-lived access token (about an hour). There is no refresh
 * token in the browser; when the token runs out, a click on Reconnect gets a
 * new one, usually without asking again.
 */
export type GoogleToken = { accessToken: string; expiresAt: number };

type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type Gis = {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }): { requestAccessToken(options?: { prompt?: string }): void };
      hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
      revoke(token: string, done?: () => void): void;
    };
  };
};

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    /** The person closed the popup: no need to show an error. */
    readonly cancelled = false,
  ) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

const gisWindow = () =>
  typeof window === 'undefined' ? null : (window as unknown as { google?: Gis });

let loading: Promise<Gis> | null = null;

/** Google's sign-in script, once it has loaded (null before). */
export function loadedGis(): Gis | null {
  return gisWindow()?.google?.accounts?.oauth2 ? (gisWindow()?.google as Gis) : null;
}

/** Loads Google's sign-in script (once). Load it early: the popup must open on a click. */
export function loadGis(): Promise<Gis> {
  const ready = loadedGis();
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;
  loading = new Promise<Gis>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new GoogleAuthError('Google sign-in needs a browser'));
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_GIS_SRC;
    script.async = true;
    script.onload = () => {
      const gis = loadedGis();
      if (gis) resolve(gis);
      else reject(new GoogleAuthError('Google sign-in didn’t load'));
    };
    script.onerror = () => {
      loading = null;
      reject(new GoogleAuthError('Couldn’t reach Google sign-in — check your connection'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Asks Google for an access token. Call from a click, with the script
 * already loaded, so the popup isn't blocked. `consent` asks again for
 * permission; '' only asks when it's needed.
 */
export function requestGoogleToken(gis: Gis, prompt: '' | 'consent'): Promise<GoogleToken> {
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      prompt,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new GoogleAuthError(
              response.error === 'access_denied'
                ? 'Calendar access wasn’t allowed'
                : (response.error_description ?? 'Google didn’t connect'),
              response.error === 'access_denied',
            ),
          );
          return;
        }
        if (!gis.accounts.oauth2.hasGrantedAllScopes(response, GOOGLE_SCOPE)) {
          reject(new GoogleAuthError('Allow access to your calendar events to sync them'));
          return;
        }
        const seconds = Number(response.expires_in ?? 3599);
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + (Number.isFinite(seconds) ? seconds : 3599) * 1000,
        });
      },
      error_callback: (error) => {
        const closed = error?.type === 'popup_closed';
        reject(
          new GoogleAuthError(
            error?.type === 'popup_failed_to_open'
              ? 'The Google window was blocked — allow pop-ups for this site'
              : closed
                ? 'Google sign-in was closed'
                : 'Google didn’t connect',
            closed,
          ),
        );
      },
    });
    client.requestAccessToken({ prompt });
  });
}

/** Withdraws the app's access (best effort; it also lapses on its own). */
export function revokeGoogleToken(accessToken: string) {
  loadedGis()?.accounts.oauth2.revoke(accessToken);
}
