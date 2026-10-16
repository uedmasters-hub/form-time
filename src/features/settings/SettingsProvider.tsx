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
import { useColorScheme } from '@/hooks/use-color-scheme';

import { DEFAULT_SETTINGS, type Settings, type WeekStartSetting } from './settings';
import { loadSettings, saveSettings } from './settings-storage';

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
};

const WEEKDAY_OF: Record<Exclude<WeekStartSetting, 'locale'>, Weekday> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Saved settings load after mount: the static web render must match the
  // first client render, so both start from the defaults.
  const loaded = useRef(false);

  useEffect(() => {
    const stored = loadSettings();
    if (stored) setSettings(stored);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) saveSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const scheme = useColorScheme();
  const mode: 'day' | 'night' =
    settings.appearance === 'system' ? (scheme === 'dark' ? 'night' : 'day') : settings.appearance;

  const value = useMemo<SettingsContextValue>(() => {
    const dialTheme =
      mode === 'night' ? nightDialTheme(settings.lume) : dayDialTheme(settings.dial);
    return {
      settings,
      update,
      reset,
      mode,
      dialTheme,
      uiTheme: calendarThemeFrom(dialTheme),
      weekStart:
        settings.weekStart === 'locale' ? defaultWeekStart() : WEEKDAY_OF[settings.weekStart],
    };
  }, [settings, update, reset, mode]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
