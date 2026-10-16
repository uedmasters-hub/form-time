import { fadeToward, isDark, mix } from '@/theme/color';

import { aquaDial, type DialTheme } from './dial-theme';

/**
 * Dial palettes. A day dial is three colours — face, ink, scale — and every
 * other token (page, lume, glow, rim) is derived from them, so the set stays
 * consistent. Night dials are black with luminous markings in a chosen lume.
 */

export type DialId =
  | 'aqua'
  | 'ivory'
  | 'graphite'
  | 'turquoise'
  | 'glacier'
  | 'ocean'
  | 'pistachio'
  | 'sun'
  | 'salmon'
  | 'lavender'
  | 'slate';

type DialSpec = {
  id: DialId;
  name: string;
  /** Dial face. */
  face: string;
  /** Hour numerals. */
  ink: string;
  /** Minute track, outer scale, accents. */
  scale: string;
};

export const DIALS: readonly DialSpec[] = [
  { id: 'aqua', name: 'Aqua', face: '#F6F7F7', ink: '#0E5761', scale: '#13838A' },
  { id: 'ivory', name: 'Ivory', face: '#F5EFE2', ink: '#3A372F', scale: '#8C6B37' },
  { id: 'graphite', name: 'White', face: '#FBFBFA', ink: '#1E2225', scale: '#4B5358' },
  { id: 'turquoise', name: 'Turquoise', face: '#A6E4E0', ink: '#0B4A50', scale: '#0F676D' },
  { id: 'glacier', name: 'Glacier', face: '#CBDAE0', ink: '#22333C', scale: '#3D5A67' },
  { id: 'ocean', name: 'Ocean', face: '#12304E', ink: '#EEF4F7', scale: '#8DB6D1' },
  { id: 'pistachio', name: 'Pistachio', face: '#CADBB4', ink: '#2D4721', scale: '#4D6C37' },
  { id: 'sun', name: 'Sun', face: '#F1D86E', ink: '#3B3013', scale: '#6E5916' },
  { id: 'salmon', name: 'Salmon', face: '#F1BBA7', ink: '#4A2920', scale: '#8A4938' },
  { id: 'lavender', name: 'Lavender', face: '#D1C9EB', ink: '#342C56', scale: '#574B87' },
  { id: 'slate', name: 'Slate', face: '#2A2F34', ink: '#EDEFF0', scale: '#98A4AB' },
];

export type LumeId =
  | 'aqua'
  | 'ice'
  | 'green'
  | 'seafoam'
  | 'amber'
  | 'peach'
  | 'yellow'
  | 'lavender'
  | 'rose'
  | 'red'
  | 'white';

export const LUMES: readonly { id: LumeId; name: string; color: string }[] = [
  { id: 'aqua', name: 'Aqua', color: '#4FE6EE' },
  { id: 'ice', name: 'Ice blue', color: '#B8F1FF' },
  { id: 'green', name: 'Green', color: '#8CFF4F' },
  { id: 'seafoam', name: 'Seafoam', color: '#5CF0C2' },
  { id: 'amber', name: 'Amber', color: '#FF9A2E' },
  { id: 'peach', name: 'Peach', color: '#FFC49A' },
  { id: 'yellow', name: 'Yellow', color: '#FFE14A' },
  { id: 'lavender', name: 'Lavender', color: '#B9A8FF' },
  { id: 'rose', name: 'Rose', color: '#FF9DC9' },
  { id: 'red', name: 'Red', color: '#FF4B3E' },
  { id: 'white', name: 'White', color: '#F2F5F6' },
];

const SILVER = {
  steelHighlight: '#FFFFFF',
  steelLight: '#EEF2F3',
  steelMid: '#D5DCDF',
  steelShade: '#B3BEC2',
  steelEdge: '#97A4A9',
  screw: '#5F6C71',
};

export function dialSpec(id: DialId): DialSpec {
  return DIALS.find((d) => d.id === id) ?? DIALS[0];
}

export function lumeSpec(id: LumeId) {
  return LUMES.find((l) => l.id === id) ?? LUMES[0];
}

/** A day dial: printed markings on a coloured face, lit by the room. */
export function dayDialTheme(id: DialId): DialTheme {
  if (id === 'aqua') return aquaDial; // the original, tuned by hand
  const { name, face, ink, scale } = dialSpec(id);
  const dark = isDark(face);

  const page = dark ? face : mix(face, '#000000', 0.012);
  return {
    name,
    mode: 'day',
    page,
    dialCenter: dark ? mix(face, '#FFFFFF', 0.05) : face,
    dialEdge: page,
    dialRim: mix(page, ink, dark ? 0.22 : 0.14),
    scale,
    numeral: ink,
    lume: mix(scale, '#FFFFFF', dark ? 0.78 : 0.86),
    lumeHighlight: '#FFFFFF',
    lumeGlow: mix(scale, '#FFFFFF', dark ? 0.3 : 0.45),
    ...SILVER,
    shadow: dark ? '#000000' : scale,
    handGlow: dark ? 1.6 : 1,
    indexGlow: dark ? 0.45 : 0.6,
    contactShadow: dark ? 0.25 : 0.08,
    numeralGlow: 0,
    lumeHighlightOpacity: 0.85,
  };
}

/** A night dial: black face, every marking glowing in the chosen lume. */
export function nightDialTheme(id: LumeId): DialTheme {
  const { name, color: lume } = lumeSpec(id);
  const page = '#040506';
  return {
    name: `Night · ${name}`,
    mode: 'night',
    page,
    dialCenter: '#0A0D0F',
    dialEdge: page,
    dialRim: mix(page, lume, 0.22),
    // The minute track stays quieter than the hour markings, but legible.
    scale: fadeToward(lume, '#0A0D0F', 0.55, 3.2),
    numeral: lume,
    lume,
    lumeHighlight: mix(lume, '#FFFFFF', 0.55),
    lumeGlow: lume,
    steelHighlight: '#3B4146',
    steelLight: '#2A2F33',
    steelMid: '#1E2226',
    steelShade: '#15181B',
    steelEdge: '#0B0D0F',
    screw: '#2A2F33',
    shadow: lume,
    handGlow: 5,
    indexGlow: 0.75,
    contactShadow: 0,
    numeralGlow: 0.35,
    lumeHighlightOpacity: 0.45,
  };
}
