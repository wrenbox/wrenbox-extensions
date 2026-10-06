/**
 * What the content script knows before the page paints (see
 * scripts/lib/initial.mjs): the mode, type and amount, from three generated
 * one-line files registered just before it.
 */
import { CVD_TYPES, type CvdType, type Mode } from './matrix';
import { DEFAULTS, amountOf, type Settings } from './settings';

export interface Initial {
  mode?: Mode | 'off';
  type?: CvdType;
  amount?: number;
}

/** The three files that describe these settings, for registerContentScripts. */
export function initialFilesFor(s: Settings): string[] {
  const mode = s.enabled ? s.mode : 'off';
  const amount = Math.min(100, Math.max(0, Math.round(amountOf(s) / 5) * 5));
  return [
    `content/initial/mode-${mode}.js`,
    `content/initial/type-${s.type}.js`,
    `content/initial/amount-${amount}.js`,
  ];
}

/** Settings to paint with before storage answers (null if no initial files ran). */
export function settingsFromInitial(init: Initial | undefined): Settings | null {
  if (!init || !init.mode || !init.type || typeof init.amount !== 'number') return null;
  if (!CVD_TYPES.includes(init.type)) return null;
  const amount = Math.min(100, Math.max(0, init.amount));
  const mode: Mode = init.mode === 'simulate' ? 'simulate' : 'correct';
  return {
    ...DEFAULTS,
    enabled: init.mode !== 'off',
    mode,
    type: init.type,
    strength: mode === 'correct' ? amount : DEFAULTS.strength,
    severity: mode === 'simulate' ? amount : DEFAULTS.severity,
    offSites: [],
  };
}

/** Match patterns that keep the automatic content script off these sites. */
export function excludePatterns(offSites: readonly string[]): string[] {
  return offSites
    .filter((s) => /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(s))
    .flatMap((s) => [`*://${s}/*`, `*://www.${s}/*`]);
}
