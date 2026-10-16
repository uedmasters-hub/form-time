import { Platform } from 'react-native';

/**
 * System notifications and the alarm tone. Web uses the Notification API
 * (only after the user has saved a reminder, and only if they allow it) and
 * Web Audio for a soft tone. Native shows reminders in the app while it's
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

/** Shows a system notification if allowed; returns whether it did. */
export function showSystemNotification(title: string, body: string, tag: string): boolean {
  const N = api();
  if (!N || N.permission !== 'granted') return false;
  try {
    const n = new N(title, { body, tag, requireInteraction: false, silent: false });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

let audio: AudioContext | null = null;

/**
 * A soft two-note chime (880 → 660 Hz), repeated `times` times. Returns a
 * stop function. Browsers only allow sound after the page has had a user
 * gesture; if it isn't allowed, this does nothing.
 */
export function playChime(times = 3): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  try {
    audio = audio ?? new Ctx();
    void audio.resume();
  } catch {
    return () => {};
  }
  const ctx = audio;
  const nodes: OscillatorNode[] = [];
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < times; i++) {
    [880, 660].forEach((freq, j) => {
      const at = start + i * 1.6 + j * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.65);
      nodes.push(osc);
    });
  }
  return () => {
    for (const osc of nodes) {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    }
  };
}
