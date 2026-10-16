import { defaultDialTheme } from '@/features/clock/dial-theme';

/**
 * Calendar colours, derived from the dial so the two views read as one
 * object: same paper, same ink, same teal scale, same lume for selection.
 */
const dial = defaultDialTheme;

export const calendarTheme = {
  page: dial.page,
  ink: dial.numeral,
  accent: dial.scale,
  muted: '#7A898D',
  hairline: '#E2E7E8',
  hover: '#EBEFF0',
  lume: dial.lume,
  lumeEdge: dial.steelShade,
  lumeGlow: dial.lumeGlow,
} as const;

export type CalendarTheme = typeof calendarTheme;
