import type { ItemKind } from './types';

/**
 * The composer asks one thing at a time. After the date, time and title,
 * each kind has a short flow of steps it walks through, plus extras the
 * user can add when they want them. A finished step folds into a one-line
 * summary that can be reopened.
 */
export type StepId = 'type' | 'place' | 'remind' | 'notes';

/** Steps each kind walks through, in order. */
export const FLOW: Record<ItemKind, readonly StepId[]> = {
  event: ['type', 'remind'],
  meeting: ['type', 'place', 'remind'],
  note: ['type'],
  follow_up: ['type', 'remind'],
  alarm: ['type'],
};

/** Steps a kind offers only on request ("+ Place", "+ Notes"). */
export const EXTRAS: Record<ItemKind, readonly StepId[]> = {
  event: ['place', 'notes'],
  meeting: ['notes'],
  note: ['remind', 'notes'],
  follow_up: ['notes'],
  alarm: [],
};

export type FlowState = {
  /** The user has moved past the title (typed in it, or pressed Next). */
  started: boolean;
  /** Steps the user has finished (or that were already set, when editing). */
  done: ReadonlySet<StepId>;
  /** Extras the user asked for. */
  added: ReadonlySet<StepId>;
  /** A step reopened for changes, or 'when' for the date and time. */
  open: StepId | 'when' | null;
};

export type StepView = { id: StepId; mode: 'summary' | 'open' };

export type FlowLayout = {
  /** Steps on the page, top to bottom. */
  steps: StepView[];
  /** The step the flow is waiting on, if any. */
  pending: StepId | null;
  /** Extras that can still be added (shown once the flow is through). */
  addable: StepId[];
  /** Date & time and title count as the first two steps. */
  progress: { done: number; total: number };
};

/**
 * What the page shows. `filled` says which steps hold a value, so an extra
 * the user already filled stays on the page (e.g. notes, when editing).
 */
export function layoutFlow(
  kind: ItemKind,
  state: FlowState,
  filled: Partial<Record<StepId, boolean>>,
  hasTitle: boolean,
): FlowLayout {
  const flow = FLOW[kind];
  const extras = EXTRAS[kind].filter(
    (id) => !flow.includes(id) && (state.added.has(id) || filled[id]),
  );
  const pending = state.started ? (flow.find((id) => !state.done.has(id)) ?? null) : null;

  const steps: StepView[] = [];
  for (const id of flow) {
    if (state.done.has(id)) {
      steps.push({ id, mode: state.open === id ? 'open' : 'summary' });
    } else {
      // The next step opens on its own, unless another one is being changed.
      if (id === pending && (state.open === null || state.open === id)) {
        steps.push({ id, mode: 'open' });
      }
      break;
    }
  }
  if (pending === null && state.started) {
    for (const id of extras) steps.push({ id, mode: state.open === id ? 'open' : 'summary' });
  }

  const shown = new Set(steps.map((s) => s.id));
  const addable =
    state.started && pending === null
      ? EXTRAS[kind].filter((id) => !shown.has(id) && !flow.includes(id))
      : [];

  return {
    steps,
    pending,
    addable,
    progress: {
      done: 1 + (hasTitle ? 1 : 0) + flow.filter((id) => state.done.has(id)).length,
      total: 2 + flow.length,
    },
  };
}

/**
 * A first guess at the kind from the title, used until the user picks
 * one: "Call with Asha" is a meeting, "Wake up" an alarm.
 */
export function guessKind(title: string): ItemKind | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  if (/^(alarm|wake( me)?( up)?)\b/.test(t) || /\balarm\b/.test(t)) return 'alarm';
  if (/\bfollow[\s-]?up\b|^(chase|ping|reply to|get back to|check (in|on))\b/.test(t)) {
    return 'follow_up';
  }
  if (
    /\b(meeting|meet with|call with|call|sync|1:1|one[\s-]on[\s-]one|stand[\s-]?up|interview|catch[\s-]?up|zoom|teams|lunch with|coffee with|dinner with)\b/.test(
      t,
    )
  ) {
    return 'meeting';
  }
  if (/^(note|idea|remember|thought)\b|^note:/.test(t)) return 'note';
  return null;
}
