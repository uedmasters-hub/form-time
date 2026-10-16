import { G, Path } from 'react-native-svg';

import { GLYPH_HEIGHT, layoutNumeral } from '../numerals';

type NumeralProps = {
  text: string;
  /** Centre of the numeral, in the parent's coordinates. */
  x: number;
  y: number;
  /** Height of the stroke centreline, in the parent's units. */
  height: number;
  /** Stroke width, in the parent's units. */
  strokeWidth: number;
  color: string;
  /** Rotation about the numeral's centre, in degrees. */
  rotation?: number;
};

/** A string of FORM / TIME numerals, centred on (x, y). */
export function Numeral({ text, x, y, height, strokeWidth, color, rotation = 0 }: NumeralProps) {
  const layout = layoutNumeral(text);
  const scale = height / GLYPH_HEIGHT;

  return (
    <G
      transform={
        `translate(${x} ${y}) rotate(${rotation}) ` +
        `scale(${scale}) translate(${-layout.width / 2} ${-GLYPH_HEIGHT / 2})`
      }
    >
      {layout.glyphs.map((glyph, index) => (
        <Path
          key={index}
          d={glyph.d}
          transform={`translate(${glyph.x} 0)`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth / scale}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </G>
  );
}
