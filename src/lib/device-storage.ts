import { Platform } from 'react-native';

/**
 * Small key–value storage for this device. Web: localStorage. Native: none
 * yet (returns null), so callers keep data for the session only — device
 * storage for iOS/Android needs a native module and arrives with that build.
 */
function storage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

export const hasDeviceStorage = () => storage() !== null;

export function readJSON<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** False when it couldn't be written (full, blocked or unavailable). */
export function writeJSON(key: string, value: unknown): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    storage()?.removeItem(key);
  } catch {
    // nothing to do
  }
}
