/**
 * Pure clock geometry. No React, no rendering — safe to unit-test.
 *
 * The dial is drawn in a fixed 1000 × 1000 viewBox and scaled as a whole,
 * so every radius below is in viewBox units and proportions never change
 * with screen size.
 */
export const DIAL_SIZE = 1000;
export const CENTER = DIAL_SIZE / 2;

export type Point = { x: number; y: number };

/** Point at `radius` from the centre, `angleDeg` clockwise from 12 o'clock. */
export function polar(radius: number, angleDeg: number, center = CENTER): Point {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: center + radius * Math.sin(radians),
    y: center - radius * Math.cos(radians),
  };
}

/** Radii of every dial element, in viewBox units. */
export const DIAL = {
  faceRadius: 492,
  outerScaleRadius: 455,
  tickOuter: 410,
  tickInner: 383,
  indexOuter: 415,
  indexInner: 339,
  hourNumeralRadius: 276,
} as const;

export type HandAngles = {
  hour: number;
  minute: number;
  second: number;
};

/**
 * Hand angles in degrees, clockwise from 12, for the device's local time.
 * `smoothSeconds` adds milliseconds so the second hand can sweep; when false
 * the second hand lands exactly on whole seconds (quartz tick).
 */
export function getHandAngles(
  date: Date,
  { smoothSeconds }: { smoothSeconds: boolean },
): HandAngles {
  const wholeSeconds = date.getSeconds();
  const seconds = smoothSeconds ? wholeSeconds + date.getMilliseconds() / 1000 : wholeSeconds;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;

  return {
    hour: hours * 30,
    minute: minutes * 6,
    second: seconds * 6,
  };
}
