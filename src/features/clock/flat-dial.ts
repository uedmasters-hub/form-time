import { contrast } from '@/theme/color';

import type { DialTheme } from './dial-theme';

/**
 * The dial with shadows and glow switched off: solid colours only, taken
 * from the same theme so every dial keeps its character. Steel and lume
 * gradients become flat ink; the inserts pick whichever of lume or page
 * reads best against their frame.
 */
export type FlatDial = {
  face: string;
  /** Applied hour indices, and the stripe inside them. */
  index: string;
  indexInsert: string;
  /** Hour and minute hands, and the stripe inside them. */
  hand: string;
  handInsert: string;
  second: string;
  /** Centre cap and its pin. */
  cap: string;
  pin: string;
};

const clearest = (on: string, candidates: string[]) =>
  candidates.reduce((best, c) => (contrast(c, on) > contrast(best, on) ? c : best));

export function flatDialFrom(theme: DialTheme): FlatDial {
  const night = theme.mode === 'night';
  const face = theme.dialEdge;
  // Night: markings are lit (lume); day: printed in the dial's inks.
  const index = night ? theme.lume : theme.scale;
  const hand = theme.numeral;
  return {
    face,
    index,
    indexInsert: clearest(index, [theme.lume, face]),
    hand,
    handInsert: clearest(hand, [theme.lume, face]),
    second: theme.scale,
    cap: theme.scale,
    pin: face,
  };
}
