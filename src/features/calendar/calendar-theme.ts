import { aquaDial, type DialTheme } from '@/features/clock/dial-theme';
import { contrast, fadeToward, isDark, mix } from '@/theme/color';

/**
 * Interface colours derived from the current dial, so the calendar, the
 * settings panel and the controls always read as part of the same object:
 * same paper, same ink, same scale colour, same lume for selection.
 */
export type CalendarTheme = {
  mode: 'day' | 'night';
  page: string;
  /** Raised surfaces (settings panel). */
  surface: string;
  ink: string;
  accent: string;
  muted: string;
  hairline: string;
  hover: string;
  /** Selected-day disc, and the text drawn on it. */
  lume: string;
  onLume: string;
  lumeEdge: string;
  lumeGlow: string;
  /** "Shadows & glow" off: no shadows, glow or elevation anywhere. */
  flat: boolean;
};

export function calendarThemeFrom(dial: DialTheme, flat = false): CalendarTheme {
  const night = dial.mode === 'night';
  const ink = dial.numeral;
  const surface = isDark(dial.page)
    ? mix(dial.page, '#FFFFFF', 0.06)
    : mix(dial.page, '#FFFFFF', 0.55);
  // Quiet text must stay legible on both the page and the raised surface.
  let muted = fadeToward(ink, dial.page, 0.45, 3.2);
  if (contrast(muted, surface) < 3.2) muted = fadeToward(ink, surface, 0.45, 3.2);
  return {
    mode: dial.mode,
    page: dial.page,
    // Raised a touch above the page: lighter on light pages, barely on dark ones.
    surface,
    ink,
    accent: night ? dial.lume : dial.scale,
    muted,
    hairline: mix(ink, dial.page, 0.85),
    hover: mix(ink, dial.page, 0.93),
    lume: night ? mix(dial.lume, dial.page, 0.12) : dial.lume,
    onLume: bestOn(night ? mix(dial.lume, dial.page, 0.12) : dial.lume, [ink, dial.page]),
    lumeEdge: night ? dial.lume : dial.steelShade,
    lumeGlow: dial.lumeGlow,
    flat,
  };
}

/** Whichever candidate reads best on the given background. */
function bestOn(background: string, candidates: string[]): string {
  return candidates.reduce((best, c) =>
    contrast(c, background) > contrast(best, background) ? c : best,
  );
}

/** The default (Aqua day) interface theme. */
export const calendarTheme = calendarThemeFrom(aquaDial);
