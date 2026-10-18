import { useSyncExternalStore } from 'react';
import { Platform, type ViewStyle } from 'react-native';

/**
 * How FORM / TIME's icon controls behave — the same as the desktop app's
 * full-screen ✕ (desktop/preload.cjs): barely there at rest, a little
 * stronger for a moment whenever the pointer moves, full strength on hover,
 * press or keyboard focus. No background or border at rest; pressed, a
 * light ink tint and a slight press-in; focused, a thin ink ring.
 *
 * Touch screens can't hover. There the page's own controls (settings, the
 * page indicator, the clock-face switch) stay hidden until the screen is
 * touched, then show for a few seconds; other icon buttons rest at `awake`.
 */
export const QUIET = {
  /** At rest, where a pointer can hover. */
  rest: 0.14,
  /** For a moment after the pointer moves (and on touch screens, which can't hover). */
  awake: 0.42,
  /** Touch screens: the page's controls, shown after a touch. */
  touch: 0.6,
  disabled: 0.06,
  pressedScale: 0.92,
  /** The pressed tint: this much of the ink colour. */
  tint: 0.1,
  ring: 1.5,
} as const;

/** How long controls stay "awake" after the pointer last moved. */
const AWAKE_MS = 2400;

/** Opacity fades in quickly and settles back slowly, like the ✕. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FADE_IN_MS = 180;
const WAKE_MS = 220;
const FADE_OUT_MS = 600;

export type QuietState = {
  /** Hovered, pressed or keyboard-focused. */
  active: boolean;
  disabled?: boolean;
  canHover: boolean;
  /** Pointer: moved a moment ago. Touch: the screen was touched a moment ago. */
  awake: boolean;
  /** One of the page's own controls, hidden on touch screens until a touch. */
  hideable?: boolean;
};

export function quietOpacity({ active, disabled, canHover, awake, hideable }: QuietState): number {
  if (disabled) return QUIET.disabled;
  if (active) return 1;
  if (!canHover) return hideable ? (awake ? QUIET.touch : 0) : QUIET.awake;
  return awake ? QUIET.awake : QUIET.rest;
}

/**
 * Whether it takes touches. Hidden ones don't, so nothing is pressed unseen;
 * nor, for a moment, do ones just revealed — the touch that revealed them
 * mustn't also press them.
 */
export const quietTouchable = (state: QuietState, ready: boolean) =>
  state.active || !(!state.canHover && state.hideable) || (state.awake && ready);

/**
 * Web: the opacity transition for the state being entered (fading in fast,
 * out slowly). None with reduced motion, and none on native, where opacity
 * changes are immediate.
 */
export function quietTransition(state: QuietState, reducedMotion: boolean): ViewStyle {
  if (Platform.OS !== 'web' || reducedMotion) return {};
  const opacityMs = state.active ? FADE_IN_MS : state.awake ? WAKE_MS : FADE_OUT_MS;
  return {
    transitionProperty: 'opacity, transform, background-color, border-color',
    transitionDuration: `${opacityMs}ms, 120ms, 160ms, 160ms`,
    transitionTimingFunction: `${EASE}, ease-out, ease-out, ease-out`,
  } as ViewStyle;
}

/** `hex` (#RGB or #RRGGBB) at `alpha`, for the pressed tint. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return 'transparent';
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ── "Awake": the pointer moved recently ─────────────────────────────────
// One window listener for every control; components re-render only when
// the state flips, not on every move.

let awake = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === awake) return;
  awake = next;
  for (const listener of listeners) listener();
}

function wake() {
  set(true);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => set(false), AWAKE_MS);
}

function install() {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'touch') wake();
    },
    { passive: true },
  );
  // A moment of presence when the page opens, so the controls can be found.
  wake();
}

function subscribe(listener: () => void) {
  install();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True for a moment after the pointer last moved (web). */
export function usePointerAwake(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => awake,
    () => false,
  );
}

// ── "Revealed": the screen was touched (touch screens) ──────────────────

/** How long the page's controls stay after a touch. */
const REVEAL_MS = 4000;
/** After appearing, how long before they take touches. */
const READY_MS = 300;

let revealed = false;
let ready = false;
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let readyTimer: ReturnType<typeof setTimeout> | null = null;
const revealListeners = new Set<() => void>();

function notifyReveal() {
  for (const listener of revealListeners) listener();
}

function setRevealed(next: boolean) {
  if (next === revealed) return;
  revealed = next;
  if (readyTimer) clearTimeout(readyTimer);
  ready = false;
  if (next) {
    readyTimer = setTimeout(() => {
      ready = true;
      notifyReveal();
    }, READY_MS);
  }
  notifyReveal();
}

/**
 * Shows the page's controls on touch screens for a few seconds: on any
 * touch of the page (it never takes the touch itself), on focus, and when
 * the page opens, so they can be found.
 */
export function revealControls(ms = REVEAL_MS) {
  setRevealed(true);
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => setRevealed(false), ms);
}

function subscribeReveal(listener: () => void) {
  revealListeners.add(listener);
  return () => {
    revealListeners.delete(listener);
  };
}

/**
 * "Awake" for a control: pointer movement where it can hover, a recent
 * touch where it can't; and, on touch screens, whether it's ready for touches.
 */
export function useQuietAwake(canHover: boolean): { awake: boolean; ready: boolean } {
  const pointer = usePointerAwake();
  const touched = useSyncExternalStore(
    subscribeReveal,
    () => revealed,
    () => false,
  );
  const touchReady = useSyncExternalStore(
    subscribeReveal,
    () => ready,
    () => false,
  );
  return canHover ? { awake: pointer, ready: true } : { awake: touched, ready: touchReady };
}
