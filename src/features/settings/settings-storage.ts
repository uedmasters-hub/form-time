import { Platform } from 'react-native';

import { sanitizeSettings, type Settings } from './settings';

/**
 * Where settings live between sessions.
 *
 * Web: localStorage (per browser). Native: kept for the session only for
 * now — device storage arrives with the persistence step (and Supabase sync
 * after that), behind this same load/save interface.
 */
const KEY = 'formtime.settings.v1';

function webStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled cookies)
  }
}

export function loadSettings(): Settings | null {
  const storage = webStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Returns false if the settings couldn't be saved (they still apply now). */
export function saveSettings(settings: Settings): boolean {
  const storage = webStorage();
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false; // quota or blocked
  }
}
