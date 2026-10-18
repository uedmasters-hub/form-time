import { DIALS, LUMES, type DialId, type LumeId } from '@/features/clock/dial-palettes';
import {
  APPEARANCES,
  FACES,
  MOVEMENTS,
  SIZES,
  type Appearance,
  type ClockFace,
  type ClockSize,
  type Movement,
} from '@/features/settings/settings';

/**
 * What the screensaver page shows, read from its address:
 *
 *   /screensaver?face=analog&appearance=night&dial=aqua&lume=aqua
 *     &movement=smooth&seconds=1&depth=1&size=classic&date=1&tz=Asia/Kolkata
 *
 * The Windows and macOS screensavers can't read the app's saved settings
 * (they aren't the same browser), so their options dialogs pass everything
 * here. Anything missing or invalid falls back to the settings saved on
 * this device (or the defaults); the time zone falls back to the computer's.
 */
export type ScreensaverOptions = {
  face?: ClockFace;
  appearance?: Appearance;
  dial?: DialId;
  lume?: LumeId;
  movement?: Movement;
  size?: ClockSize;
  seconds?: boolean;
  depth?: boolean;
  /** The weekday and date beneath the time. */
  date?: boolean;
  /** IANA time zone; the computer's own when absent. */
  timeZone?: string;
};

const pick = <T extends string>(value: string | null, allowed: readonly { id: T }[]) =>
  allowed.find((a) => a.id === value)?.id;

function flag(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (/^(1|true|yes|on)$/i.test(value)) return true;
  if (/^(0|false|no|off)$/i.test(value)) return false;
  return undefined;
}

/** A time zone this browser knows, or undefined. */
export function validTimeZone(value: string | null | undefined): string | undefined {
  if (!value || value === 'local') return undefined;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Reads the options from a query string ("?face=digital&…" or "face=digital&…"). */
export function parseScreensaverQuery(search: string): ScreensaverOptions {
  const q = new URLSearchParams(search);
  const options: ScreensaverOptions = {
    face: pick(q.get('face'), FACES),
    appearance: pick(q.get('appearance'), APPEARANCES),
    dial: pick(q.get('dial'), DIALS),
    lume: pick(q.get('lume'), LUMES),
    movement: pick(q.get('movement'), MOVEMENTS),
    size: pick(q.get('size'), SIZES),
    seconds: flag(q.get('seconds')),
    depth: flag(q.get('depth')),
    date: flag(q.get('date')),
    timeZone: validTimeZone(q.get('tz')),
  };
  // Only what was actually given, so `{ ...saved, ...options }` keeps the rest.
  for (const key of Object.keys(options) as (keyof ScreensaverOptions)[]) {
    if (options[key] === undefined) delete options[key];
  }
  return options;
}

/** The computer's own time zone. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Where the clock rests at minute `step` of its drift, as a share of the
 * drift's reach (-1…1 on each axis). A slow, non-repeating-looking path, so
 * no part of the face stays on the same pixels for long (screen burn-in).
 */
export function driftAt(step: number): { x: number; y: number } {
  return { x: Math.sin(step * 0.73), y: Math.cos(step * 0.47) };
}
