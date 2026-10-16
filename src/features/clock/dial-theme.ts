/**
 * Dial theme tokens.
 *
 * Every colour the analog clock draws comes from a DialTheme, so new dials
 * (ivory, glacier, ocean, slate, …) are added here as data rather than by
 * editing components. `aqua` is the current FORM / TIME day dial.
 */
export type DialTheme = {
  name: string;
  /** Screen background behind the clock. */
  page: string;

  /** Dial surface: radial from centre to edge. */
  dialCenter: string;
  dialEdge: string;
  /** Hairline that defines the dial's outer edge. */
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
};

export const aquaDial: DialTheme = {
  name: 'Aqua',
  page: '#F4F5F5',

  dialCenter: '#F6F7F7',
  dialEdge: '#F4F5F5',
  dialRim: '#E6EAEB',

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
};

export const defaultDialTheme = aquaDial;
