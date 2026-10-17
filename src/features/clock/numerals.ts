/**
 * FORM / TIME numerals.
 *
 * A small, extended monoline digit set built from ellipses, arcs and straight
 * strokes, rendered as SVG paths. Drawing the digits ourselves keeps the dial identical
 * on iOS, Android and web (no font loading, no platform fallback fonts) and
 * gives the numerals the same geometric construction as the rest of the dial.
 *
 * Each glyph is a stroke centreline in a box 100 units tall (y grows down).
 * The ink is the centreline stroked with round caps and joins.
 */
type Glyph = { width: number; d: string };

const GLYPHS: Record<string, Glyph> = {
  '0': {
    width: 106,
    d: 'M53 0 A53 50 0 1 1 53 100 A53 50 0 1 1 53 0 Z',
  },
  '1': {
    width: 0,
    d: 'M0 0 V100',
  },
  '2': {
    // Wide bowl, a sweeping descent to the left, full-width base.
    width: 94,
    d: 'M2.2 28.3 A45 31 0 1 1 87.8 44.1 C84 60 26 70 2 100 H94',
  },
  '3': {
    // Narrower upper bowl stacked on a wider lower bowl, meeting at y = 46.
    width: 92,
    d: 'M10.3 17.05 A38 23 0 1 1 47 46 A45 27 0 1 1 4.7 82.2',
  },
  '4': {
    width: 96,
    d: 'M70 100 V0 L0 68 H96',
  },
  '5': {
    width: 94,
    d: 'M90 0 H11 L10.8 51.04 A45 32 0 1 1 10.03 84',
  },
  '6': {
    // Wide lower bowl; the stem rises on the left and hooks over to the right.
    width: 104,
    d: 'M2 70 A50 30 0 1 1 102 70 A50 30 0 1 1 2 70 V42 C2 15 20 0 50 0 C71 0 87 5 97 14',
  },
  '7': {
    width: 90,
    d: 'M0 0 H90 L30 100',
  },
  '8': {
    width: 92,
    d: 'M46 0 A38 23 0 1 1 46 46 A38 23 0 1 1 46 0 M46 46 A46 27 0 1 1 46 100 A46 27 0 1 1 46 46',
  },
  '9': {
    // The 6 turned through 180°.
    width: 104,
    d: 'M102 30 A50 30 0 1 1 2 30 A50 30 0 1 1 102 30 V58 C102 85 84 100 54 100 C33 100 17 95 7 86',
  },
};

/** Centreline gap between neighbouring glyphs, in glyph units. */
const TRACKING = 36;

export type NumeralLayout = {
  /** Total width of the string's centreline box, in glyph units. */
  width: number;
  glyphs: { d: string; x: number }[];
};

/** The widest digit's box; every digit gets this much room when tabular. */
const TABULAR_CELL = Math.max(...Object.values(GLYPHS).map((g) => g.width));

/**
 * The "1" for tabular figures. A bare stroke would sit stranded in a full
 * cell, so it gains a short flag — the same diagonal as the 4's — and
 * fills its cell the way the other digits do.
 */
const TABULAR_ONE: Glyph = { width: 64, d: 'M2 34 L58 0 V100' };

/**
 * Lays out a string of digits. Proportional by default (a "1" is just its
 * stroke); `tabular` gives every digit the same cell, centred in it, so a
 * changing number (a running clock) never changes width.
 */
export function layoutNumeral(text: string, { tabular = false } = {}): NumeralLayout {
  const glyphs: NumeralLayout['glyphs'] = [];
  let cursor = 0;

  for (const char of text) {
    const glyph = tabular && char === '1' ? TABULAR_ONE : GLYPHS[char];
    if (!glyph) {
      throw new Error(`FORM / TIME numerals: no glyph for "${char}"`);
    }
    if (glyphs.length > 0) cursor += TRACKING;
    const cell = tabular ? TABULAR_CELL : glyph.width;
    glyphs.push({ d: glyph.d, x: cursor + (cell - glyph.width) / 2 });
    cursor += cell;
  }

  return { width: cursor, glyphs };
}

/** Glyph box height the paths above are drawn in. */
export const GLYPH_HEIGHT = 100;
