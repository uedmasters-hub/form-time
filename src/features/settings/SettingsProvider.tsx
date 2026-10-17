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

import { defaultWeekStart, type Weekday } from '@/features/calendar/calendar-date';
import { calendarThemeFrom, type CalendarTheme } from '@/features/calendar/calendar-theme';
import { dayDialTheme, nightDialTheme } from '@/features/clock/dial-palettes';
import type { DialTheme } from '@/features/clock/dial-theme';
import { areaOf, detectRegion, type Area } from '@/features/region/regions';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { readJSON, writeJSON } from '@/lib/device-storage';

import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type Settings,
  type WeekStartSetting,
} from './settings';
import { loadSettings, saveSettings } from './settings-storage';
import { NEVER, type SettingsMeta } from './settings-sync';
import { useSettingsSync } from './use-settings-sync';

/** When settings last changed here, and the account they were synced with. */
const META_KEY = 'formtime.settings.meta.v1';

type SettingsContextValue = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  /** Day or night after resolving "System". */
  mode: 'day' | 'night';
  dialTheme: DialTheme;
  /** Calendar, panel and control colours — derived from the dial. */
  uiTheme: CalendarTheme;
  weekStart: Weekday;
  /** Selected area of the selected region: its IANA zone and labels. */
  area: Area;
  timeZone: string;
};

const WEEKDAY_OF: Record<Exclude<WeekStartSetting, 'locale'>, Weekday> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [meta, setMeta] = useState<SettingsMeta>({ updatedAt: NEVER, owner: null });
  // Saved settings load after mount: the static web render must match the
  // first client render, so both start from the defaults.
  const loaded = useRef(false);

  useEffect(() => {
    const stored = loadSettings();
    // First visit: start in the region the device is set to, if supported.
    setSettings(stored ?? { ...DEFAULT_SETTINGS, ...detectRegion() });
    setMeta(readJSON<SettingsMeta>(META_KEY) ?? { updatedAt: NEVER, owner: null });
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (loaded.current) writeJSON(META_KEY, meta);
  }, [meta]);

  const touch = () => setMeta((m) => ({ ...m, updatedAt: new Date().toISOString() }));

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    touch();
  }, []);
  // Resets the clock and calendar look; the chosen region stays as it is.
  const reset = useCallback(
    () =>
      setSettings((current) => ({
        ...DEFAULT_SETTINGS,
        region: current.region,
        area: current.area,
        nepalCalendar: current.nepalCalendar,
        showPublicHolidays: current.showPublicHolidays,
        showRestrictedHolidays: current.showRestrictedHolidays,
        showFestivals: current.showFestivals,
      })),
    [],
  );
  const resetAndTouch = useCallback(() => {
    reset();
    touch();
  }, [reset]);

  // Signed in, settings follow the account.
  const apply = useCallback((next: Settings, updatedAt: string, owner: string) => {
    setSettings(sanitizeSettings(next));
    setMeta({ updatedAt, owner });
  }, []);
  const setOwner = useCallback(
    (owner: string | null) => setMeta((m) => (m.owner === owner ? m : { ...m, owner })),
    [],
  );
  useSettingsSync({ settings, meta, apply, setOwner });

  const scheme = useColorScheme();
  const mode: 'day' | 'night' =
    settings.appearance === 'system' ? (scheme === 'dark' ? 'night' : 'day') : settings.appearance;

  const value = useMemo<SettingsContextValue>(() => {
    const dialTheme =
      mode === 'night' ? nightDialTheme(settings.lume) : dayDialTheme(settings.dial);
    return {
      settings,
      update,
      reset: resetAndTouch,
      mode,
      dialTheme,
      uiTheme: calendarThemeFrom(dialTheme, !settings.depth),
      area: areaOf(settings.region, settings.area),
      timeZone: areaOf(settings.region, settings.area).timeZone,
      weekStart:
        settings.weekStart === 'locale' ? defaultWeekStart() : WEEKDAY_OF[settings.weekStart],
    };
  }, [settings, update, resetAndTouch, mode]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
