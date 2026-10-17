import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { zonedParts } from '@/features/region/zoned-time';
import { useSettings } from '@/features/settings/SettingsProvider';

import { canSoundNow, play, primeAudio, soundSupported } from './sound-engine';
import {
  DEFAULT_SOUND,
  isNight,
  loadSound,
  saveSound,
  type SoundId,
  type SoundSettings,
} from './sound-settings';

/**
 * The clock's sounds, and the controls for them.
 *
 * Ambient sounds keep to the background: ticking and the minute mark only
 * while the clock is on screen and the window is in view; ticking pauses
 * while a reminder rings; and with "Quiet at night" none of the three
 * (ticking, minute, hourly chime) sound from 10 pm to 7 am.
 */
type SoundContextValue = {
  /** Web and desktop; native builds are silent for now. */
  supported: boolean;
  sound: SoundSettings;
  update: (patch: Partial<Omit<SoundSettings, 'enabled'>>) => void;
  setEnabled: (id: SoundId, on: boolean) => void;
  reset: () => void;
  /** Plays one sound to try it, whatever its own switch (not when muted). */
  preview: (id: SoundId) => void;
  /** A reminder came due: rings (alarms repeat) and returns a stop function. */
  ring: (alarm: boolean) => () => void;
  /** A quieter cue, for missed reminders. */
  notify: () => void;
  /** Whether that kind of cue will be heard now (else the system's own sound is). */
  willSound: (id: 'reminder' | 'notification') => boolean;
  /** Tells the sounds whether the clock page is on screen. */
  setClockOnScreen: (onScreen: boolean) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function useSound(): SoundContextValue {
  const value = useContext(SoundContext);
  if (!value) throw new Error('useSound must be used inside <SoundProvider>');
  return value;
}

/** Alarms repeat their phrase this many times (about ten seconds). */
const ALARM_REPEAT = 6;

const supported = soundSupported();

const pageVisible = () =>
  Platform.OS !== 'web' ||
  typeof document === 'undefined' ||
  document.visibilityState === 'visible';

export function SoundProvider({ children }: { children: ReactNode }) {
  const { timeZone } = useSettings();
  const [sound, setSound] = useState<SoundSettings>(DEFAULT_SOUND);
  const [clockOnScreen, setClockOnScreen] = useState(false);
  const loaded = useRef(false);
  /** Ticking waits until this time (ms) while a reminder rings. */
  const ringingUntil = useRef(0);
  const current = useRef(sound);
  useEffect(() => {
    current.current = sound;
  }, [sound]);

  // Saved after mount, like the other settings, so the static render matches.
  useEffect(() => {
    const stored = loadSound();
    if (stored) setSound(stored);
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) saveSound(sound);
  }, [sound]);

  // Browsers allow sound after the first click or key press: start then.
  useEffect(() => {
    if (!supported || sound.muted) return;
    const wake = () => {
      primeAudio();
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
    };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
    return () => {
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
    };
  }, [sound.muted]);

  const update = useCallback((patch: Partial<Omit<SoundSettings, 'enabled'>>) => {
    setSound((s) => ({ ...s, ...patch }));
  }, []);
  const setEnabled = useCallback((id: SoundId, on: boolean) => {
    setSound((s) => ({ ...s, enabled: { ...s.enabled, [id]: on } }));
  }, []);
  const reset = useCallback(() => setSound(DEFAULT_SOUND), []);

  const preview = useCallback((id: SoundId) => {
    const s = current.current;
    if (s.muted) return;
    primeAudio(); // from the press itself
    play(id, s.volume);
  }, []);

  const willSound = useCallback((id: 'reminder' | 'notification') => {
    const s = current.current;
    return supported && !s.muted && s.enabled[id] && s.volume > 0 && canSoundNow();
  }, []);

  const ring = useCallback(
    (alarm: boolean) => {
      if (!willSound('reminder')) return () => {};
      const { stop, seconds } = play('reminder', current.current.volume, {
        repeat: alarm ? ALARM_REPEAT : 1,
      });
      ringingUntil.current = Date.now() + seconds * 1000;
      return () => {
        stop();
        ringingUntil.current = 0;
      };
    },
    [willSound],
  );

  const notify = useCallback(() => {
    if (willSound('notification')) play('notification', current.current.volume);
  }, [willSound]);

  // Ticking, the minute mark and the hourly chime, on the second.
  const { muted, quietAtNight, volume } = sound;
  const tick = sound.enabled.tick && clockOnScreen;
  const minute = sound.enabled.minute && clockOnScreen;
  const chime = sound.enabled.chime;
  useEffect(() => {
    if (!supported || muted || volume <= 0 || !(tick || minute || chime)) return;
    let timer: ReturnType<typeof setTimeout>;
    let tock = false;
    const hourOf = (p: ReturnType<typeof zonedParts>) => `${p.year}-${p.month}-${p.day}T${p.hours}`;
    // The hour we're in has already struck: no chime just for opening the app.
    let lastChime = hourOf(zonedParts(new Date(), timeZone));

    const step = () => {
      // A few ms of slack: a timer that fires a hair early still counts.
      const p = zonedParts(new Date(Date.now() + 20), timeZone);
      const quiet = (quietAtNight && isNight(p.hours)) || Date.now() < ringingUntil.current;
      const hour = hourOf(p);
      if (chime && p.minutes === 0 && hour !== lastChime) {
        // Background tabs wake late; still strike once, within the hour's first minute.
        lastChime = hour;
        if (!quiet) play('chime', volume);
      } else if (!quiet && pageVisible()) {
        if (minute && p.seconds === 0) play('minute', volume);
        else if (tick) {
          play('tick', volume, { tock });
          tock = !tock;
        }
      }
      schedule();
    };
    const schedule = () => {
      timer = setTimeout(step, 1000 - (Date.now() % 1000) + 2);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [muted, volume, quietAtNight, tick, minute, chime, timeZone]);

  const value = useMemo<SoundContextValue>(
    () => ({
      supported,
      sound,
      update,
      setEnabled,
      reset,
      preview,
      ring,
      notify,
      willSound,
      setClockOnScreen,
    }),
    [sound, update, setEnabled, reset, preview, ring, notify, willSound],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
