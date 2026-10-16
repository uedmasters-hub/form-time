import { zonedParts } from '@/features/region/zoned-time';

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
 * Hand angles in degrees, clockwise from 12.
 * `secondStep` is the size of one second-hand step in seconds: 1 for a
 * quartz tick, 1/8 for a mechanical beat, 0 for a continuous sweep.
 * `timeZone` (IANA) shows that zone's time; omitted, the device's.
 */
export function getHandAngles(
  date: Date,
  { secondStep, timeZone }: { secondStep: number; timeZone?: string },
): HandAngles {
  const wall = timeZone
    ? zonedParts(date, timeZone)
    : {
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
        milliseconds: date.getMilliseconds(),
      };
  const exact = wall.seconds + wall.milliseconds / 1000;
  // Snap to the step; the epsilon keeps a value like 2.9999 from flooring short.
  const seconds = secondStep > 0 ? Math.floor(exact / secondStep + 1e-6) * secondStep : exact;
  const minutes = wall.minutes + seconds / 60;
  const hours = (wall.hours % 12) + minutes / 60;

  return {
    hour: hours * 30,
    minute: minutes * 6,
    second: seconds * 6,
  };
}
