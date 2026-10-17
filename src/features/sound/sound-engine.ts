import { Platform } from 'react-native';

import { PHRASE_GAP, playVoice, type VoiceId, type VoiceOptions } from './voices';

/**
 * Plays the app's sounds through one Web Audio context (web and desktop).
 * Native builds are silent for now: sound there needs an audio module and
 * arrives with the native build.
 *
 * Browsers only allow sound once the page has had a click or key press.
 * The context is created after that (never before, which would warn), and
 * is suspended after a few quiet seconds so an idle clock costs nothing.
 */
type Ctx = AudioContext;

const IDLE_MS = 8000;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let quietUntil = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function AudioCtor(): typeof AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

export const soundSupported = () => AudioCtor() !== null;

/** Whether the page may start sound now (it has had a click or key press). */
function activated(): boolean {
  if (ctx) return true;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return Boolean(ua?.hasBeenActive);
}

/** `fromGesture`: called inside a click or key press, where it's always allowed. */
function context(fromGesture = false): Ctx | null {
  if (ctx) return ctx;
  const Ctor = AudioCtor();
  if (!Ctor || !(fromGesture || activated())) return null;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  // A gentle limiter: overlapping sounds never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master = ctx.createGain();
  master.connect(limiter).connect(ctx.destination);
  return ctx;
}

/** From a click or key press: lets sound start (browsers require one). */
export function primeAudio() {
  const c = context(true);
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  scheduleIdle(c, c.currentTime);
}

/** Whether a sound would actually be heard now (not blocked by the browser). */
export const canSoundNow = () => soundSupported() && activated();

function scheduleIdle(c: Ctx, endsAt: number) {
  quietUntil = Math.max(quietUntil, endsAt);
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(
    () => {
      idleTimer = null;
      if (c.currentTime >= quietUntil && c.state === 'running')
        void c.suspend().catch(() => undefined);
    },
    Math.max(0, (quietUntil - c.currentTime) * 1000) + IDLE_MS,
  );
}

/** About how long each sound lasts, in seconds (for ducking the ticks). */
const LENGTH: Record<VoiceId, number> = {
  tick: 0.05,
  minute: 0.25,
  chime: 4.3,
  notification: 1.35,
  reminder: 1.45,
};

/**
 * Plays a sound at `volume` (0–1, shaped to how loudness is heard). Returns
 * how long it lasts and a function that stops it early, with a short fade.
 */
export function play(
  id: VoiceId,
  volume: number,
  options: VoiceOptions = {},
): { stop: () => void; seconds: number } {
  const c = context();
  if (!c || !master || volume <= 0) return { stop: () => {}, seconds: 0 };

  const bus = c.createGain();
  bus.gain.value = volume * volume;
  bus.connect(master);
  let stopped = false;

  const start = () => {
    if (stopped) return;
    const end = playVoice(c, bus, id, c.currentTime + 0.01, 1, options);
    scheduleIdle(c, end);
    setTimeout(() => bus.disconnect(), (end - c.currentTime) * 1000 + 200);
  };
  if (c.state === 'running') start();
  else void c.resume().then(start, () => undefined);

  const repeat = id === 'reminder' ? Math.max(1, options.repeat ?? 1) : 1;
  return {
    seconds: (repeat - 1) * PHRASE_GAP + LENGTH[id],
    stop: () => {
      if (stopped) return;
      stopped = true;
      const now = c.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + 0.06);
      setTimeout(() => bus.disconnect(), 120);
    },
  };
}
