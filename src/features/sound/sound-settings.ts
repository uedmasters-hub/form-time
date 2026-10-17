import { readJSON, writeJSON } from '@/lib/device-storage';

/**
 * Sound preferences. Kept on this device, not with the account: sound
 * depends on where you are (a desk, a bedside, a phone in a meeting), so
 * turning ticking on at your desk shouldn't make your phone tick.
 *
 * Out of the box only reminders make a sound, as they always have; the
 * ambient sounds (ticking, the minute mark, the hourly chime) start off.
 */
export type SoundId = 'tick' | 'minute' | 'chime' | 'notification' | 'reminder';

export type SoundSettings = {
  /** Mute all: silences everything, keeping each sound's own setting. */
  muted: boolean;
  /** 0–1, for all sounds. */
  volume: number;
  /** Ticking, the minute mark and the hourly chime stay silent 10 pm – 7 am. */
  quietAtNight: boolean;
  enabled: Record<SoundId, boolean>;
};

export const SOUNDS: readonly { id: SoundId; label: string; detail: string; ambient: boolean }[] = [
  { id: 'tick', label: 'Ticking', detail: 'A soft tick each second', ambient: true },
  { id: 'minute', label: 'Minute', detail: 'A quiet mark as each minute begins', ambient: true },
  { id: 'chime', label: 'Hourly chime', detail: 'A gentle bell on the hour', ambient: true },
  {
    id: 'notification',
    label: 'Notifications',
    detail: 'One soft note for missed reminders',
    ambient: false,
  },
  {
    id: 'reminder',
    label: 'Reminders',
    detail: 'When a reminder is due; alarms repeat',
    ambient: false,
  },
];

export const DEFAULT_SOUND: SoundSettings = {
  muted: false,
  volume: 0.6,
  quietAtNight: true,
  enabled: { tick: false, minute: false, chime: false, notification: true, reminder: true },
};

/** Volume steps on the slider. */
export const VOLUME_STEP = 0.1;

/** Night, for "Quiet at night": from 22:00 up to 07:00, local to the clock shown. */
export const isNight = (hours: number) => hours >= 22 || hours < 7;

const KEY = 'formtime.sound.v1';

export function sanitizeSound(raw: unknown): SoundSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const e = (r.enabled && typeof r.enabled === 'object' ? r.enabled : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_SOUND;
  const volume =
    typeof r.volume === 'number' && Number.isFinite(r.volume)
      ? Math.round(Math.min(1, Math.max(0, r.volume)) / VOLUME_STEP) * VOLUME_STEP
      : d.volume;
  const enabled = { ...d.enabled };
  for (const { id } of SOUNDS) if (typeof e[id] === 'boolean') enabled[id] = e[id] as boolean;
  return {
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
    volume: Number(volume.toFixed(2)),
    quietAtNight: typeof r.quietAtNight === 'boolean' ? r.quietAtNight : d.quietAtNight,
    enabled,
  };
}

export const loadSound = (): SoundSettings | null => {
  const raw = readJSON<unknown>(KEY);
  return raw ? sanitizeSound(raw) : null;
};

export const saveSound = (sound: SoundSettings) => writeJSON(KEY, sound);
