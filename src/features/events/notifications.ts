import { Platform } from 'react-native';

/**
 * System notifications. Web uses the Notification API (only after the user
 * has saved a reminder, and only if they allow it); the app's own sounds
 * live in features/sound. Native shows reminders in the app while it's
 * open; system notifications there need a native module (a later step).
 */
type Permission = 'granted' | 'denied' | 'default' | 'unsupported';

function api(): typeof Notification | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return 'Notification' in window ? window.Notification : null;
}

export function notificationPermission(): Permission {
  const N = api();
  return N ? (N.permission as Permission) : 'unsupported';
}

/** Asks once (from a user action); later calls return the stored answer. */
export async function requestNotificationPermission(): Promise<Permission> {
  const N = api();
  if (!N) return 'unsupported';
  if (N.permission !== 'default') return N.permission as Permission;
  try {
    return (await N.requestPermission()) as Permission;
  } catch {
    return 'denied';
  }
}

/**
 * Shows a system notification if allowed; returns whether it did.
 * `silent`: the app plays its own sound, so the system's would double it.
 */
export function showSystemNotification(
  title: string,
  body: string,
  tag: string,
  silent = false,
): boolean {
  const N = api();
  if (!N || N.permission !== 'granted') return false;
  try {
    const n = new N(title, { body, tag, requireInteraction: false, silent });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
