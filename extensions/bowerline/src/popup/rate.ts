/**
 * Asking for a rating, once. The popup asks only someone who has used
 * Bowerline for a few days and made a good number of highlights, only while
 * it is working on the current page, and never again after either answer.
 * Everything is decided locally; the store page opens only on a click.
 */

export const RATE_KEY = 'ratePrompt';
export const RATE_AFTER_DAYS = 3;
export const RATE_AFTER_HIGHLIGHTS = 10;
const DAY = 24 * 60 * 60 * 1000;

export interface RateState {
  /** When the popup was first opened (from this version on). */
  firstSeen: number;
  /** Rated or declined: never ask again. */
  done?: boolean;
}

export function shouldAsk(state: RateState, now: number, highlights: number): boolean {
  return (
    !state.done &&
    now - state.firstSeen >= RATE_AFTER_DAYS * DAY &&
    highlights >= RATE_AFTER_HIGHLIGHTS
  );
}

export async function rateState(now = Date.now()): Promise<RateState> {
  const stored = (await chrome.storage.local.get(RATE_KEY))[RATE_KEY] as RateState | undefined;
  if (stored) return stored;
  const fresh = { firstSeen: now };
  await chrome.storage.local.set({ [RATE_KEY]: fresh });
  return fresh;
}

export async function finishRating(state: RateState): Promise<void> {
  await chrome.storage.local.set({ [RATE_KEY]: { ...state, done: true } });
}
