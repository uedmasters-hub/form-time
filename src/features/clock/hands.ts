/**
 * Hand silhouettes, built in local coordinates: the pivot is (0, 0) and the
 * hand points up (negative y). Pure functions — the component rotates them.
 */
export type HandSpec = {
  /** Pivot to tip. */
  length: number;
  /** Half-width where the hand leaves the hub. */
  rootHalf: number;
  /** Radius and half-width where the root's flare settles toward the blade. */
  neckRadius: number;
  neckHalf: number;
  /** Where the blade reaches full width, and that half-width. */
  bladeStart: number;
  bladeHalf: number;
  /** Where the blade starts tapering into the point. */
  taperStart: number;
  /** Lume insert, from pivot distance `lumeStart` to `lumeEnd`. */
  lumeStart: number;
  lumeEnd: number;
  lumeHalf: number;
};

export const HOUR_HAND: HandSpec = {
  length: 262,
  rootHalf: 13,
  neckRadius: 34,
  neckHalf: 7.6,
  bladeStart: 80,
  bladeHalf: 7.4,
  taperStart: 200,
  lumeStart: 96,
  lumeEnd: 222,
  lumeHalf: 3.8,
};

export const MINUTE_HAND: HandSpec = {
  length: 405,
  rootHalf: 12,
  neckRadius: 34,
  neckHalf: 6.8,
  bladeStart: 84,
  bladeHalf: 6.6,
  taperStart: 335,
  lumeStart: 100,
  lumeEnd: 360,
  lumeHalf: 3.3,
};

const f = (n: number) => Number(n.toFixed(2));

/** Closed outline of a sculpted hand: flared root easing into the blade, ogival point. */
export function handOutline(s: HandSpec): string {
  const neckRise = s.bladeStart - s.neckRadius;
  const point = s.length - s.taperStart;

  const side = (sign: 1 | -1) => {
    const x = (v: number) => f(sign * v);
    return {
      neck: [
        `C ${x(s.rootHalf)} ${f(-s.neckRadius * 0.45)}`,
        `${x(s.neckHalf)} ${f(-s.neckRadius * 0.6)}`,
        `${x(s.neckHalf)} ${f(-s.neckRadius)}`,
      ].join(' '),
      blade: [
        `C ${x(s.neckHalf)} ${f(-(s.neckRadius + neckRise * 0.55))}`,
        `${x(s.bladeHalf)} ${f(-(s.bladeStart - neckRise * 0.25))}`,
        `${x(s.bladeHalf)} ${f(-s.bladeStart)}`,
        `L ${x(s.bladeHalf)} ${f(-s.taperStart)}`,
      ].join(' '),
      tip: [
        `C ${x(s.bladeHalf)} ${f(-(s.taperStart + point * 0.5))}`,
        `${x(s.bladeHalf * 0.3)} ${f(-(s.length - point * 0.12))}`,
        `0 ${f(-s.length)}`,
      ].join(' '),
    };
  };

  const right = side(1);

  // Up the right side, then mirror back down the left side, then round the root.
  return [
    `M ${f(s.rootHalf)} 0`,
    right.neck,
    right.blade,
    right.tip,
    `C ${f(-s.bladeHalf * 0.3)} ${f(-(s.length - point * 0.12))}`,
    `${f(-s.bladeHalf)} ${f(-(s.taperStart + point * 0.5))}`,
    `${f(-s.bladeHalf)} ${f(-s.taperStart)}`,
    `L ${f(-s.bladeHalf)} ${f(-s.bladeStart)}`,
    `C ${f(-s.bladeHalf)} ${f(-(s.bladeStart - neckRise * 0.25))}`,
    `${f(-s.neckHalf)} ${f(-(s.neckRadius + neckRise * 0.55))}`,
    `${f(-s.neckHalf)} ${f(-s.neckRadius)}`,
    `C ${f(-s.neckHalf)} ${f(-s.neckRadius * 0.6)}`,
    `${f(-s.rootHalf)} ${f(-s.neckRadius * 0.45)}`,
    `${f(-s.rootHalf)} 0`,
    `A ${f(s.rootHalf)} ${f(s.rootHalf)} 0 0 0 ${f(s.rootHalf)} 0`,
    'Z',
  ].join(' ');
}

/** Slim flat blade with a broader, rounded counterbalancing tail. */
export const SECOND_HAND = {
  length: 418,
  tail: 104,
  tipHalf: 1,
  rootHalf: 3.2,
  tailHalf: 3.8,
} as const;

export function secondHandOutline(s: typeof SECOND_HAND = SECOND_HAND): string {
  return [
    `M ${-s.tailHalf} ${s.tail}`,
    `L ${-s.rootHalf} 0`,
    `L ${-s.tipHalf} ${-s.length}`,
    `Q 0 ${-s.length - 2} ${s.tipHalf} ${-s.length}`,
    `L ${s.rootHalf} 0`,
    `L ${s.tailHalf} ${s.tail}`,
    `A ${s.tailHalf} ${s.tailHalf} 0 0 1 ${-s.tailHalf} ${s.tail}`,
    'Z',
  ].join(' ');
}
