/**
 * Dial theme tokens.
 *
 * Every colour and glow the analog clock draws comes from a DialTheme, so
 * dials are data, not component edits. Day dials and night (lume) dials are
 * generated in dial-palettes.ts; `aquaDial` is the original FORM / TIME dial.
 */
export type DialTheme = {
  name: string;
  /** Night dials glow; day dials are lit by the room. */
  mode: 'day' | 'night';
  /** Screen background behind the clock. */
  page: string;

  /** Dial surface: radial from centre to edge. */
  dialCenter: string;
  dialEdge: string;
  /** Outline for small renderings of the dial (the swatches in Settings). */
  dialRim: string;

  /** Minute track: ticks and the outer 05–60 scale. */
  scale: string;
  /** Hour numerals. */
  numeral: string;

  /** Luminous inserts in indices and hands. */
  lume: string;
  lumeHighlight: string;
  /** Soft halo around the lume (blurred, low opacity). */
  lumeGlow: string;

  /** Polished steel for index frames, hands and hub, light → dark. */
  steelHighlight: string;
  steelLight: string;
  steelMid: string;
  steelShade: string;
  steelEdge: string;
  /** Centre screw. */
  screw: string;

  /** Tint of the soft shadow cast by hands and indices onto the dial. */
  shadow: string;

  /** Strength of the hands' glow on the dial (1 = the day dial's soft halo). */
  handGlow: number;
  /** Opacity of the halo behind the applied indices. */
  indexGlow: number;
  /** Opacity of the indices' contact shadow (invisible on a black dial). */
  contactShadow: number;
  /** Opacity of a soft glow behind the hour numerals (0 = none). */
  numeralGlow: number;
  /** Opacity of the catch-light along each lume insert. */
  lumeHighlightOpacity: number;
};

export const aquaDial: DialTheme = {
  name: 'Aqua',
  mode: 'day',
  page: '#F4F5F5',

  dialCenter: '#F6F7F7',
  dialEdge: '#F4F5F5',
  dialRim: '#D6DDDF',

  scale: '#13838A',
  numeral: '#0E5761',

  lume: '#DDF5F8',
  lumeHighlight: '#FFFFFF',
  lumeGlow: '#7FD8DE',

  steelHighlight: '#FFFFFF',
  steelLight: '#EEF2F3',
  steelMid: '#D5DCDF',
  steelShade: '#B3BEC2',
  steelEdge: '#97A4A9',
  screw: '#5F6C71',

  shadow: '#2E9AA3',

  handGlow: 1,
  indexGlow: 0.6,
  contactShadow: 0.08,
  numeralGlow: 0,
  lumeHighlightOpacity: 0.85,
};

export const defaultDialTheme = aquaDial;
