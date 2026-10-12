/**
 * Which frames recolor themselves.
 *
 * The filter on the top page's <html> recolors everything painted inside it,
 * iframes included, so normally only the top frame needs a filter. Since
 * Chromium 151 (Chrome and Edge, August 2026: an SVG security fix), a page's
 * SVG filter no longer reaches into iframes of another origin, so those
 * frames would show their original colors. On 151 and later, a frame whose
 * origin differs from its parent's therefore filters itself; a frame of its
 * parent's origin is still covered by the filter above it. On older versions
 * the top filter covers every frame, and a frame filtering itself would be
 * recolored twice.
 *
 * Nothing here reads the page: whether the parent is same-origin is told by
 * whether the browser lets this frame reach the parent's document at all.
 */
import { siteKey } from '../shared/hostname';

/** The first Chromium version whose top-page filter skips cross-origin iframes. */
export const OWN_FILTER_FROM = 151;

export type FrameRole =
  /** The top page: filters itself and everything of its origin below it. */
  | 'top'
  /** Recolored by a filter above it: does nothing. */
  | 'covered'
  /** Cross-origin from its parent on Chromium 151+: filters itself. */
  | 'own';

/** "Chrome/155.0…" (also in Edge's user agent) → 155; null when there's none. */
export function chromiumMajor(ua: string): number | null {
  // Also "HeadlessChrome/155.…".
  const m = /Chrom(?:e|ium)\/(\d+)\./.exec(ua);
  return m ? Number(m[1]) : null;
}

/** The parts of a window this needs, so tests can pass a stand-in. */
export interface FrameWindow {
  top: unknown;
  parent: { document: unknown };
}

export function frameRole(win: FrameWindow, ua: string): FrameRole {
  if (win.top === win) return 'top';
  let sameOrigin: boolean;
  try {
    // Throws (SecurityError) when the parent is another origin.
    sameOrigin = !!win.parent.document;
  } catch {
    sameOrigin = false;
  }
  if (sameOrigin) return 'covered';
  return (chromiumMajor(ua) ?? 0) >= OWN_FILTER_FROM ? 'own' : 'covered';
}

/**
 * The top page's site key, seen from inside a frame, so that switching a
 * site off also turns Huefinch off in the frames embedded in it. Only the
 * hostname of the top page's origin is used. Null when the browser doesn't
 * say.
 */
export function topSiteOf(ancestorOrigins: { length: number; [i: number]: string } | undefined) {
  if (!ancestorOrigins?.length) return null;
  try {
    return siteKey(new URL(ancestorOrigins[ancestorOrigins.length - 1]!).hostname) || null;
  } catch {
    return null;
  }
}
