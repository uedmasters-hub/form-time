import { readJSON, writeJSON } from '@/lib/device-storage';

/**
 * Which reminders have already rung on this device: item id → the
 * remind-at instant that rang. Kept so a reload doesn't ring them again.
 */
const FIRED_KEY = 'formtime.fired.v1';

export type Fired = Record<string, string>;

export const readFired = (): Fired => readJSON<Fired>(FIRED_KEY) ?? {};

export const writeFired = (fired: Fired) => {
  writeJSON(FIRED_KEY, fired);
};

/** Items given new ids (joining an account) keep their rung reminders. */
export function carryReminders(renamed: Record<string, string>) {
  const fired = readFired();
  for (const [from, to] of Object.entries(renamed)) {
    if (fired[from]) fired[to] = fired[from];
  }
  writeFired(fired);
}
