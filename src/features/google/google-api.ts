import { GOOGLE_CALENDAR_API } from './google-config';
import type { GoogleEvent } from './google-map';

/**
 * The few Google Calendar API calls the sync needs, over plain `fetch`
 * (events.list / get / insert / patch / delete). Every failure becomes a
 * GoogleApiError that says what to do about it.
 */
export type GoogleProblem = 'unauthorized' | 'forbidden' | 'offline' | 'server';

export class GoogleApiError extends Error {
  constructor(
    readonly problem: GoogleProblem,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 15_000;

export type EventList = {
  events: GoogleEvent[];
  /** The calendar's own time zone (events without one are in it). */
  timeZone: string;
  /** The calendar's name; for the primary calendar, the account's address. */
  summary: string;
};

export function createGoogleCalendar(
  accessToken: string,
  base: string = GOOGLE_CALENDAR_API,
  fetchImpl: Fetch = (...a) => fetch(...a),
) {
  async function call(
    method: string,
    path: string,
    { body, etag }: { body?: unknown; etag?: string } = {},
  ): Promise<Response> {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        signal: controller?.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? null : { 'Content-Type': 'application/json' }),
          ...(etag ? { 'If-Match': etag } : null),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new GoogleApiError('offline', 0, 'Couldn’t reach Google Calendar');
    } finally {
      if (timer) clearTimeout(timer);
    }
    return res;
  }

  async function fail(res: Response): Promise<never> {
    let reason = '';
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; errors?: { reason?: string }[] };
      };
      reason = body.error?.errors?.[0]?.reason ?? '';
      message = body.error?.message ?? message;
    } catch {
      // not JSON
    }
    if (res.status === 401) throw new GoogleApiError('unauthorized', 401, message);
    if (res.status === 403 && !/rateLimit|quota/i.test(reason)) {
      throw new GoogleApiError('forbidden', 403, message);
    }
    throw new GoogleApiError('server', res.status, message);
  }

  const events = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;

  return {
    /**
     * Every event between timeMin and timeMax, recurring ones expanded into
     * their occurrences, including ones deleted (status "cancelled").
     */
    async listAll(calendarId: string, timeMin: string, timeMax: string): Promise<EventList> {
      const out: GoogleEvent[] = [];
      let timeZone = '';
      let summary = '';
      let pageToken: string | undefined;
      for (let page = 0; page < 40; page++) {
        const query = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          showDeleted: 'true',
          maxResults: '250',
        });
        if (pageToken) query.set('pageToken', pageToken);
        const res = await call('GET', `${events(calendarId)}?${query}`);
        if (!res.ok) await fail(res);
        const body = (await res.json()) as {
          items?: GoogleEvent[];
          nextPageToken?: string;
          timeZone?: string;
          summary?: string;
        };
        out.push(...(body.items ?? []));
        timeZone ||= body.timeZone ?? '';
        summary ||= body.summary ?? '';
        pageToken = body.nextPageToken;
        if (!pageToken) return { events: out, timeZone, summary };
      }
      throw new GoogleApiError('server', 0, 'Too many events to list at once');
    },

    /** One event, or null when it no longer exists. */
    async get(calendarId: string, id: string): Promise<GoogleEvent | null> {
      const res = await call('GET', `${events(calendarId)}/${encodeURIComponent(id)}`);
      if (res.status === 404 || res.status === 410) return null;
      if (!res.ok) await fail(res);
      return (await res.json()) as GoogleEvent;
    },

    /** Creates an event with our id; 'exists' when that id is already taken (a retry). */
    async insert(calendarId: string, body: object): Promise<GoogleEvent | 'exists'> {
      const res = await call('POST', events(calendarId), { body });
      if (res.status === 409) return 'exists';
      if (!res.ok) await fail(res);
      return (await res.json()) as GoogleEvent;
    },

    /**
     * Changes only the given fields. With an etag, refuses ('conflict') if
     * the event changed in Google since; 'gone' when it no longer exists.
     */
    async patch(
      calendarId: string,
      id: string,
      body: object,
      etag?: string,
    ): Promise<GoogleEvent | 'conflict' | 'gone'> {
      const res = await call('PATCH', `${events(calendarId)}/${encodeURIComponent(id)}`, {
        body,
        etag,
      });
      if (res.status === 412) return 'conflict';
      if (res.status === 404 || res.status === 410) return 'gone';
      if (!res.ok) await fail(res);
      return (await res.json()) as GoogleEvent;
    },

    /** Deletes an event; one that's already gone counts as done. */
    async remove(calendarId: string, id: string): Promise<void> {
      const res = await call('DELETE', `${events(calendarId)}/${encodeURIComponent(id)}`);
      if (res.ok || res.status === 404 || res.status === 410) return;
      await fail(res);
    },
  };
}

export type GoogleCalendarApi = ReturnType<typeof createGoogleCalendar>;
