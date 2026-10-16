/**
 * Small colour helpers for deriving theme tones from a few base colours.
 * Hex in (#RGB or #RRGGBB), hex out.
 */
type RGB = [number, number, number];

function parse(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function format([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

/** `amount` of the way from a to b (0 = a, 1 = b). */
export function mix(a: string, b: string, amount: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return format([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * amount) as RGB);
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 – 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Fades `color` toward `background` as far as `maxAmount`, but never so far
 * that their contrast drops below `minContrast` (keeps quiet text legible).
 */
export function fadeToward(
  color: string,
  background: string,
  maxAmount: number,
  minContrast: number,
): string {
  for (let amount = maxAmount; amount > 0; amount -= 0.025) {
    const candidate = mix(color, background, amount);
    if (contrast(candidate, background) >= minContrast) return candidate;
  }
  return color;
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.18;
}
