/**
 * Asking for a rating, once. The popup asks only someone who has come back to
 * Huefinch over several days, only while it is recoloring the page in front of
 * them, and never again after either answer. Everything is decided and kept
 * locally; the store page opens only on a click.
 */
import { RATE_KEY } from '../shared/settings';

export const RATE_AFTER_DAYS = 3;
/** Popup opens, counting this one: someone who keeps coming back to it. */
export const RATE_AFTER_OPENS = 5;
const DAY = 24 * 60 * 60 * 1000;

export interface RateState {
  /** When the popup was first opened (from version 1.1.0 on). */
  firstSeen: number;
  /** How many times the popup has been opened. */
  opens: number;
  /** Rated or declined: never ask again. */
  done?: boolean;
}

export function shouldAsk(state: RateState, now: number): boolean {
  return (
    !state.done && now - state.firstSeen >= RATE_AFTER_DAYS * DAY && state.opens >= RATE_AFTER_OPENS
  );
}

/** Reads the reminder and counts this popup open (the first one starts it). */
export async function countOpen(now = Date.now()): Promise<RateState> {
  const stored = (await chrome.storage.local.get(RATE_KEY))[RATE_KEY] as
    Partial<RateState> | undefined;
  const state: RateState = {
    firstSeen: typeof stored?.firstSeen === 'number' ? stored.firstSeen : now,
    opens: (typeof stored?.opens === 'number' ? stored.opens : 0) + 1,
    ...(stored?.done ? { done: true } : {}),
  };
  if (!state.done) await chrome.storage.local.set({ [RATE_KEY]: state });
  return state;
}

export async function finishRating(state: RateState): Promise<void> {
  await chrome.storage.local.set({ [RATE_KEY]: { ...state, done: true } });
}
