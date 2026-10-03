/**
 * Text anchoring over whitespace-normalised text, using W3C Web Annotation
 * selectors. Pure string functions so they can be unit-tested without a DOM.
 *
 * Restore order:
 *   1. exact quote, disambiguated by prefix/suffix context,
 *   2. then by distance to the position hint,
 *   3. then a fuzzy (bit-parallel Myers) search above a confidence threshold.
 * If none of these succeeds the caller marks the highlight orphaned.
 */
import search from 'approx-string-match';
import type { TextPositionSelector, TextQuoteSelector } from '../types';

export const CONTEXT_LENGTH = 32;
/** Minimum similarity (1 − edits/length) for a fuzzy match to be accepted. */
export const FUZZY_THRESHOLD = 0.8;
/** Quotes shorter than this must match exactly; fuzzy matches would be noise. */
const MIN_FUZZY_LENGTH = 8;
const MAX_EXACT_CANDIDATES = 5000;
/** Beyond this, a whole-document fuzzy scan is too slow to run on the main thread. */
const MAX_GLOBAL_FUZZY_TEXT = 2_000_000;

export interface Anchored {
  start: number;
  end: number;
  method: 'exact' | 'context' | 'position' | 'fuzzy';
  /** 0..1, how confident we are this is the original passage. */
  score: number;
}

export function describe(
  text: string,
  start: number,
  end: number,
): { quote: TextQuoteSelector; position: TextPositionSelector } {
  return {
    quote: {
      type: 'TextQuoteSelector',
      exact: text.slice(start, end),
      prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: text.slice(end, end + CONTEXT_LENGTH),
    },
    position: { type: 'TextPositionSelector', start, end },
  };
}

/** Length of the common suffix of `a` and `b`. */
function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** 0..1 similarity of the text around [start, end) to the stored context. */
function contextScore(text: string, start: number, end: number, quote: TextQuoteSelector): number {
  const { prefix, suffix } = quote;
  const before = text.slice(Math.max(0, start - prefix.length), start);
  const after = text.slice(end, end + suffix.length);
  const p = prefix.length ? commonSuffix(before, prefix) / prefix.length : 1;
  const s = suffix.length ? commonPrefix(after, suffix) / suffix.length : 1;
  return (p + s) / 2;
}

function proximity(start: number, position?: TextPositionSelector): number {
  if (!position) return 0;
  return 1 / (1 + Math.abs(start - position.start) / 1000);
}

function exactCandidates(text: string, exact: string): number[] {
  const out: number[] = [];
  let from = 0;
  while (out.length < MAX_EXACT_CANDIDATES) {
    const at = text.indexOf(exact, from);
    if (at < 0) break;
    out.push(at);
    from = at + 1;
  }
  return out;
}

/** Fuzzy search within text[from, to), ranking candidates against the full text. */
function fuzzyIn(
  text: string,
  from: number,
  to: number,
  quote: TextQuoteSelector,
  position: TextPositionSelector | undefined,
): Anchored | null {
  const exact = quote.exact;
  const maxErrors = Math.floor(exact.length * (1 - FUZZY_THRESHOLD));
  if (maxErrors < 1) return null;
  const matches = search(text.slice(from, to), exact, maxErrors);
  let best: Anchored | null = null;
  let bestRank = -Infinity;
  for (const m of matches) {
    const similarity = 1 - m.errors / exact.length;
    if (similarity < FUZZY_THRESHOLD) continue;
    const start = m.start + from;
    const end = m.end + from;
    // Similarity dominates; context and position break ties between equals.
    const rank =
      similarity * 4 + contextScore(text, start, end, quote) + proximity(start, position) * 0.5;
    if (rank > bestRank) {
      bestRank = rank;
      best = { start, end, method: 'fuzzy', score: similarity };
    }
  }
  return best;
}

export function anchor(
  text: string,
  quote: TextQuoteSelector,
  position?: TextPositionSelector,
): Anchored | null {
  const exact = quote.exact;
  if (!exact) return null;

  // 1 + 2. Exact occurrences, ranked by context then by the position hint.
  const candidates = exactCandidates(text, exact);
  if (candidates.length === 1) {
    const start = candidates[0]!;
    return { start, end: start + exact.length, method: 'exact', score: 1 };
  }
  if (candidates.length > 1) {
    let best = candidates[0]!;
    let bestCtx = -1;
    let bestRank = -Infinity;
    for (const start of candidates) {
      const ctx = contextScore(text, start, start + exact.length, quote);
      const rank = ctx * 2 + proximity(start, position) * 0.5;
      if (rank > bestRank) {
        bestRank = rank;
        bestCtx = ctx;
        best = start;
      }
    }
    return {
      start: best,
      end: best + exact.length,
      method: bestCtx === 1 ? 'context' : 'position',
      score: 0.9 + bestCtx * 0.1,
    };
  }

  // 3. Fuzzy: first near the position hint (cheap), then the whole text.
  if (exact.length < MIN_FUZZY_LENGTH) return null;
  if (position) {
    const pad = exact.length + 2000;
    const from = Math.max(0, position.start - pad);
    const to = Math.min(text.length, position.end + pad);
    const near = fuzzyIn(text, from, to, quote, position);
    if (near) return near;
  }
  if (text.length > MAX_GLOBAL_FUZZY_TEXT) return null;
  return fuzzyIn(text, 0, text.length, quote, position);
}
