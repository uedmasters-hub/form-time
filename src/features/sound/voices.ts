/**
 * The sounds of FORM / TIME, drawn with Web Audio rather than recorded:
 * small, sharp at any volume, and free of licensing. They share one family
 * — struck wood and metal, like a watch and a desk clock:
 *
 * - tick:         the escapement — a short, filtered click, alternating tick
 *                 and tock, each one very slightly different so it never
 *                 sounds like a loop.
 * - minute:       a soft wood-block knock.
 * - chime:        a small bell, with the partials of a real one.
 * - notification: one vibraphone-like note.
 * - reminder:     a rising three-note marimba phrase; alarms repeat it.
 *
 * Pure Web Audio, no React Native, so it renders offline for tests too.
 * Each voice schedules its notes at `at` (context time) into `out`, scaled
 * by `level` (0–1), and returns when it has died away.
 */

export type VoiceId = 'tick' | 'minute' | 'chime' | 'notification' | 'reminder';

export type VoiceOptions = {
  /** Tick: the second, lower "tock" of the pair. */
  tock?: boolean;
  /** Reminder: how many times the phrase plays (alarms repeat it). */
  repeat?: number;
  /** -1…1 pairs for tiny variations; random when omitted. */
  vary?: [number, number];
};

/** Seconds between repeats of the reminder phrase. */
export const PHRASE_GAP = 1.6;

const noiseFor = new WeakMap<BaseAudioContext, AudioBuffer>();

function noise(c: BaseAudioContext): AudioBuffer {
  let buffer = noiseFor.get(c);
  if (!buffer) {
    buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 0.08), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseFor.set(c, buffer);
  }
  return buffer;
}

/** A sine partial: quick attack, exponential decay. Returns its end time. */
function partial(
  c: BaseAudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  peak: number,
  decay: number,
  attack = 0.004,
): number {
  if (peak <= 0 || freq >= c.sampleRate / 2) return at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  const end = at + attack + decay + 0.02;
  osc.stop(end);
  return end;
}

/** A burst of band-passed noise: the contact of a pallet, a mallet. */
function click(
  c: BaseAudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  q: number,
  peak: number,
  decay: number,
): number {
  if (peak <= 0) return at;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.0012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.0012 + decay);
  src.connect(band).connect(gain).connect(out);
  src.start(at);
  const end = at + decay + 0.02;
  src.stop(end);
  return end;
}

/** A soft low-pass, so nothing is ever shrill. */
function mellow(c: BaseAudioContext, out: AudioNode, cutoff: number): AudioNode {
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 0.5;
  filter.connect(out);
  return filter;
}

function tick(c: BaseAudioContext, out: AudioNode, at: number, level: number, o: VoiceOptions) {
  const [a, b] = o.vary ?? [Math.random() * 2 - 1, Math.random() * 2 - 1];
  const pitch = 1 + 0.03 * a;
  const loud = level * (1 + 0.12 * b);
  // Band-passed already, so no extra filter: this one plays every second.
  const end = click(c, out, at, (o.tock ? 2500 : 3200) * pitch, 5, 1.2 * loud, 0.02);
  // A little body under the click, so it reads as wood and brass, not static.
  partial(c, out, at, (o.tock ? 1180 : 1380) * pitch, 0.07 * loud, 0.016, 0.001);
  return end;
}

function minute(c: BaseAudioContext, out: AudioNode, at: number, level: number) {
  const bus = mellow(c, out, 6000);
  const f = 784; // G5
  click(c, bus, at, 2200, 3, 0.12 * level, 0.008);
  partial(c, bus, at, f * 2.76, 0.07 * level, 0.07, 0.002);
  partial(c, bus, at, f * 5.4, 0.025 * level, 0.04, 0.002);
  return partial(c, bus, at, f, 0.3 * level, 0.2, 0.002);
}

/** Partials of a small bell, relative to its prime: [ratio, level, decay s]. */
const BELL: readonly [number, number, number][] = [
  [0.5, 0.3, 4.2], // hum
  [1, 0.42, 3.2], // prime
  [1.183, 0.2, 2.4], // tierce
  [1.506, 0.14, 1.8], // quint
  [2, 0.32, 2.2], // nominal
  [2.514, 0.08, 1.1],
  [3.011, 0.05, 0.8],
];

function chime(c: BaseAudioContext, out: AudioNode, at: number, level: number) {
  const bus = mellow(c, out, 5200);
  const prime = 523.25; // C5
  click(c, bus, at, 2800, 2, 0.015 * level, 0.012); // a felt mallet
  let end = at;
  for (const [ratio, peak, decay] of BELL) {
    end = Math.max(end, partial(c, bus, at, prime * ratio, 0.28 * peak * level, decay, 0.003));
    // A faint twin a hair apart: the slow shimmer of real metal.
    partial(c, bus, at, prime * ratio + 0.6, 0.1 * peak * level, decay * 0.9, 0.003);
  }
  return end;
}

function notification(c: BaseAudioContext, out: AudioNode, at: number, level: number) {
  const bus = mellow(c, out, 6000);
  const f = 880; // A5
  partial(c, bus, at, f * 4, 0.045 * level, 0.25, 0.002);
  partial(c, bus, at, f * 10, 0.01 * level, 0.06, 0.001);
  return partial(c, bus, at, f, 0.36 * level, 1.3, 0.004);
}

/** One marimba note: a warm fundamental with its tuned overtones. */
function marimba(
  c: BaseAudioContext,
  out: AudioNode,
  at: number,
  f: number,
  peak: number,
  ring: number,
) {
  click(c, out, at, f * 3, 2, peak * 0.15, 0.01);
  partial(c, out, at, f * 4, peak * 0.2, 0.09, 0.002);
  partial(c, out, at, f * 9.2, peak * 0.05, 0.035, 0.001);
  return partial(c, out, at, f, peak, ring, 0.003);
}

function reminder(c: BaseAudioContext, out: AudioNode, at: number, level: number, o: VoiceOptions) {
  const bus = mellow(c, out, 5000);
  const phrase: readonly [number, number, number][] = [
    [0, 523.25, 0.5], // C5
    [0.14, 659.25, 0.5], // E5
    [0.28, 783.99, 1.1], // G5, left to ring
  ];
  let end = at;
  for (let i = 0; i < Math.max(1, o.repeat ?? 1); i++) {
    for (const [offset, f, ring] of phrase) {
      end = Math.max(end, marimba(c, bus, at + i * PHRASE_GAP + offset, f, 0.28 * level, ring));
    }
  }
  return end;
}

/** Plays a voice; returns the context time when it's over. */
export function playVoice(
  c: BaseAudioContext,
  out: AudioNode,
  id: VoiceId,
  at: number,
  level: number,
  options: VoiceOptions = {},
): number {
  switch (id) {
    case 'tick':
      return tick(c, out, at, level, options);
    case 'minute':
      return minute(c, out, at, level);
    case 'chime':
      return chime(c, out, at, level);
    case 'notification':
      return notification(c, out, at, level);
    case 'reminder':
      return reminder(c, out, at, level, options);
  }
}
