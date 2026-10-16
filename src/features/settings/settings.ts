import type { CalendarChoice } from '@/features/calendar/calendar-system';
import { DIALS, LUMES, type DialId, type LumeId } from '@/features/clock/dial-palettes';
import { DEFAULT_REGION, REGIONS, areaOf, type RegionCode } from '@/features/region/regions';

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
  /** Country whose time and holidays are shown. */
  region: RegionCode;
  /** Time zone / state within the region (see regions.ts). */
  area: string;
  /** Nepal: Bikram Sambat ('bs') or Gregorian ('ad') months on the calendar. */
  nepalCalendar: CalendarChoice;
  /** Calendar overlays. */
  showPublicHolidays: boolean;
  showRestrictedHolidays: boolean;
  showFestivals: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'day',
  dial: 'aqua',
  lume: 'aqua',
  movement: 'smooth',
  size: 'classic',
  secondHand: true,
  weekStart: 'locale',
  region: DEFAULT_REGION,
  area: DEFAULT_REGION,
  nepalCalendar: 'bs',
  showPublicHolidays: true,
  showRestrictedHolidays: true,
  showFestivals: true,
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

export const NEPAL_CALENDARS: readonly { id: CalendarChoice; label: string; detail: string }[] = [
  { id: 'bs', label: 'Bikram Sambat', detail: 'B.S. — Nepal’s official calendar' },
  { id: 'ad', label: 'Gregorian', detail: 'A.D.' },
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

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Accepts anything (e.g. parsed JSON) and returns complete, valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const region = oneOf(
    r.region,
    REGIONS.map((x) => x.code),
    d.region,
  );
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
    region,
    area: areaOf(region, typeof r.area === 'string' ? r.area : undefined).id,
    nepalCalendar: oneOf(
      r.nepalCalendar,
      NEPAL_CALENDARS.map((c) => c.id),
      d.nepalCalendar,
    ),
    showPublicHolidays: bool(r.showPublicHolidays, d.showPublicHolidays),
    showRestrictedHolidays: bool(r.showRestrictedHolidays, d.showRestrictedHolidays),
    showFestivals: bool(r.showFestivals, d.showFestivals),
  };
}
