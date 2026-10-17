import { readJSON, removeKey, writeJSON } from '@/lib/device-storage';

import type { GoogleToken } from './google-auth';
import type { GoogleLinks } from './google-sync';

/**
 * Google Calendar's state on this device: whether it's connected, the
 * current access token (it lasts about an hour), and how each synced item
 * and its Google event were when last in step. Losing this is safe: the
 * next sync matches everything up again by id, without duplicates.
 */
const KEY = 'formtime.google.v1';

export type GoogleStored = {
  connected: boolean;
  token: GoogleToken | null;
  /** The calendar's name — for the primary calendar, the Google account. */
  account: string;
  links: GoogleLinks;
  lastSync: number | null;
};

const EMPTY: GoogleStored = {
  connected: false,
  token: null,
  account: '',
  links: {},
  lastSync: null,
};

export function readGoogle(): GoogleStored {
  const stored = readJSON<Partial<GoogleStored>>(KEY);
  return { ...EMPTY, ...stored, links: stored?.links ?? {} };
}

export function writeGoogle(state: GoogleStored) {
  writeJSON(KEY, state);
}

export function clearGoogle() {
  removeKey(KEY);
}

/** Items that took new ids (joining an account) keep their Google events. */
export function carryGoogleLinks(renamed: Record<string, string>) {
  const state = readGoogle();
  if (Object.keys(state.links).length === 0) return;
  const links: GoogleLinks = {};
  for (const [id, link] of Object.entries(state.links)) links[renamed[id] ?? id] = link;
  writeGoogle({ ...state, links });
}
