import { createHttp, NetworkError, readError, type Fetch } from '@/features/sync/http';

/**
 * Supabase Auth (GoTrue) over its HTTP API: email-and-password accounts,
 * session renewal, sign-out, password reset, and the sessions that arrive
 * through email links (confirm sign-up, reset password).
 */
export type AccountUser = { id: string; email: string };

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  user: AccountUser;
};

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Plain-language messages for the errors people actually meet. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match.',
  invalid_grant: 'That email and password don’t match.',
  email_not_confirmed: 'Confirm your email first — the link is in your inbox.',
  user_already_exists: 'There’s already an account with this email. Sign in instead.',
  email_exists: 'There’s already an account with this email. Sign in instead.',
  weak_password: 'Choose a stronger password — at least 8 characters, not a common one.',
  same_password: 'That’s your current password. Choose a new one.',
  email_address_invalid: 'Check the email address.',
  validation_failed: 'Check the email address and password.',
  signup_disabled: 'New accounts are turned off for now.',
  email_provider_disabled: 'Email sign-in is turned off for this app.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a minute, then try again.',
  // Supabase's built-in mailer only writes to the project's own team.
  email_address_not_authorized:
    'This app can’t email that address yet — its email service is still being set up.',
  over_request_rate_limit: 'Too many tries. Wait a minute, then try again.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
};

async function authError(res: Response): Promise<AuthError> {
  const { code, message } = await readError(res);
  const known =
    MESSAGES[code] ??
    (res.status === 429 ? MESSAGES.over_request_rate_limit : undefined) ??
    (/invalid login credentials/i.test(message) ? MESSAGES.invalid_credentials : undefined) ??
    (/email not confirmed/i.test(message) ? MESSAGES.email_not_confirmed : undefined) ??
    (/email address not authorized/i.test(message)
      ? MESSAGES.email_address_not_authorized
      : undefined);
  return new AuthError(code || String(res.status), known ?? message);
}

function sessionFrom(body: Record<string, unknown>): AuthSession | null {
  const user = body.user as { id?: string; email?: string } | undefined;
  if (!body.access_token || !body.refresh_token || !user?.id) return null;
  return {
    accessToken: String(body.access_token),
    refreshToken: String(body.refresh_token),
    expiresAt:
      typeof body.expires_at === 'number'
        ? body.expires_at * 1000
        : Date.now() + Number(body.expires_in ?? 3600) * 1000,
    user: { id: user.id, email: user.email ?? '' },
  };
}

export function createAuthApi(url: string, key: string, fetchImpl?: Fetch) {
  const http = createHttp(url, key, fetchImpl);

  async function call(path: string, init: RequestInit & { token?: string }): Promise<Response> {
    try {
      return await http.request(path, init);
    } catch (error) {
      if (error instanceof NetworkError) throw new AuthError('network', MESSAGES.network);
      throw error;
    }
  }

  const redirect = (to?: string) => (to ? `?redirect_to=${encodeURIComponent(to)}` : '');

  return {
    /**
     * A new account. With email confirmation on (Supabase's default), there's
     * no session yet: the person confirms from their inbox first.
     */
    async signUp(
      email: string,
      password: string,
      redirectTo?: string,
    ): Promise<{ session: AuthSession } | { confirmEmail: true }> {
      const res = await call(`/auth/v1/signup${redirect(redirectTo)}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw await authError(res);
      const session = sessionFrom((await res.json()) as Record<string, unknown>);
      return session ? { session } : { confirmEmail: true };
    },

    async signIn(email: string, password: string): Promise<AuthSession> {
      const res = await call('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw await authError(res);
      const session = sessionFrom((await res.json()) as Record<string, unknown>);
      if (!session) throw new AuthError('unexpected', 'Unexpected response from the server.');
      return session;
    },

    /** A renewed session, or null when the refresh token is no longer valid. */
    async refresh(refreshToken: string): Promise<AuthSession | null> {
      const res = await call('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.ok) return sessionFrom((await res.json()) as Record<string, unknown>);
      if (res.status >= 500 || res.status === 429) throw await authError(res);
      return null;
    },

    /** Ends this device's session on the server (other devices stay signed in). */
    async signOut(accessToken: string): Promise<void> {
      await call('/auth/v1/logout?scope=local', { method: 'POST', token: accessToken });
    },

    /** Emails a reset link. Says nothing about whether the account exists. */
    async recover(email: string, redirectTo?: string): Promise<void> {
      const res = await call(`/auth/v1/recover${redirect(redirectTo)}`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw await authError(res);
    },

    async updatePassword(accessToken: string, password: string): Promise<void> {
      const res = await call('/auth/v1/user', {
        method: 'PUT',
        token: accessToken,
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw await authError(res);
    },

    async getUser(accessToken: string): Promise<AccountUser> {
      const res = await call('/auth/v1/user', { method: 'GET', token: accessToken });
      if (!res.ok) throw await authError(res);
      const user = (await res.json()) as { id: string; email?: string };
      return { id: user.id, email: user.email ?? '' };
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;

/** What an email link brought back in the URL fragment. */
export type AuthRedirect =
  | {
      kind: 'session';
      /** 'signup', 'recovery', 'magiclink', 'email_change', 'invite'… */
      type: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }
  | { kind: 'error'; message: string };

/**
 * Reads `#access_token=…&refresh_token=…&type=recovery` (or `#error=…`) as
 * Supabase appends it to the redirect URL; null when it's something else.
 */
export function parseAuthRedirect(hash: string, now = Date.now()): AuthRedirect | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('error') || params.get('error_code')) {
    const code = params.get('error_code') ?? '';
    const message =
      code === 'otp_expired'
        ? 'That link has expired or was already used. Ask for a new one.'
        : (params.get('error_description') ?? 'That link didn’t work.').replace(/\+/g, ' ');
    return { kind: 'error', message };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  const expiresAt = params.get('expires_at')
    ? Number(params.get('expires_at')) * 1000
    : now + Number(params.get('expires_in') ?? 3600) * 1000;
  return {
    kind: 'session',
    type: params.get('type') ?? '',
    accessToken,
    refreshToken,
    expiresAt,
  };
}
