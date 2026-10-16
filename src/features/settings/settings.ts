import { DIALS, LUMES, type DialId, type LumeId } from '@/features/clock/dial-palettes';

/**
 * User preferences for the clock and calendar. Plain data: validated on
 * load so a stale or hand-edited store can never break the app.
 */
export type Appearance = 'day' | 'night' | 'system';
export type Movement = 'quartz' | 'mechanical' | 'smooth';
export type ClockSize = 'classic' | 'compact';
export type WeekStartSetting = 'locale' | 'monday' | 'sunday' | 'saturday';

export type Settings = {
  appearance: Appearance;
  /** Dial used in day appearance. */
  dial: DialId;
  /** Lume colour used in night appearance. */
  lume: LumeId;
  movement: Movement;
  size: ClockSize;
  secondHand: boolean;
  weekStart: WeekStartSetting;
};

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'day',
  dial: 'aqua',
  lume: 'aqua',
  movement: 'smooth',
  size: 'classic',
  secondHand: true,
  weekStart: 'locale',
};

export const APPEARANCES: readonly { id: Appearance; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
  { id: 'system', label: 'System' },
];

export const MOVEMENTS: readonly { id: Movement; label: string; detail: string }[] = [
  { id: 'quartz', label: 'Quartz', detail: '1 tick / s' },
  { id: 'mechanical', label: 'Mechanical', detail: '8 beats / s' },
  { id: 'smooth', label: 'Smooth', detail: 'Continuous' },
];

export const SIZES: readonly { id: ClockSize; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'compact', label: 'Compact' },
];

export const WEEK_STARTS: readonly { id: WeekStartSetting; label: string }[] = [
  { id: 'locale', label: 'Auto' },
  { id: 'monday', label: 'Mon' },
  { id: 'sunday', label: 'Sun' },
  { id: 'saturday', label: 'Sat' },
];

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

/** Accepts anything (e.g. parsed JSON) and returns complete, valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    appearance: oneOf(
      r.appearance,
      APPEARANCES.map((a) => a.id),
      d.appearance,
    ),
    dial: oneOf(
      r.dial,
      DIALS.map((x) => x.id),
      d.dial,
    ),
    lume: oneOf(
      r.lume,
      LUMES.map((x) => x.id),
      d.lume,
    ),
    movement: oneOf(
      r.movement,
      MOVEMENTS.map((m) => m.id),
      d.movement,
    ),
    size: oneOf(
      r.size,
      SIZES.map((s) => s.id),
      d.size,
    ),
    secondHand: typeof r.secondHand === 'boolean' ? r.secondHand : d.secondHand,
    weekStart: oneOf(
      r.weekStart,
      WEEK_STARTS.map((w) => w.id),
      d.weekStart,
    ),
  };
}
