import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import type { CalendarTheme } from '@/features/calendar/calendar-theme';
import { mix } from '@/theme/color';

/**
 * Notebook tones for the composer, derived from the interface theme so
 * every dial gets its own: a warm paper, a faint dot grid, a soft "tape"
 * tint and the stamp's ink.
 */
export type Paper = {
  paper: string;
  dots: string;
  tape: string;
  stamp: string;
  /** Delicate dividers between finished steps. */
  rule: string;
};

export function paperFor(ui: CalendarTheme): Paper {
  const day = ui.mode === 'day';
  const paper = day ? mix(ui.surface, '#FFF6E4', 0.32) : ui.surface;
  return {
    paper,
    dots: mix(ui.hairline, paper, day ? 0.2 : 0.35),
    tape: mix(ui.accent, paper, day ? 0.8 : 0.72),
    stamp: mix(ui.accent, paper, 0.18),
    rule: mix(ui.hairline, paper, 0.15),
  };
}

/** A dot grid, like a bullet-journal page. */
export function DotGrid({ color, gap = 18 }: { color: string; gap?: number }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern id="ft-dots" width={gap} height={gap} patternUnits="userSpaceOnUse">
          <Circle cx={gap / 2} cy={gap / 2} r={0.9} fill={color} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#ft-dots)" />
    </Svg>
  );
}
