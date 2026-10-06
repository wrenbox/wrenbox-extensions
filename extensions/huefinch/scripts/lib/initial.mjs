/**
 * The "initial state" files. A content script can't read chrome.storage
 * synchronously, and on fast pages the first frame is painted before an
 * asynchronous read returns: a flash of uncorrected color. So the service
 * worker registers the content script together with three of these one-line
 * files, which tell it the current mode, type and amount before the page
 * paints. They are generated at build time (one per possible value) and
 * swapped with chrome.scripting.updateContentScripts when settings change.
 */
export const MODES = ['correct', 'simulate', 'off'];
export const TYPES = ['protan', 'deutan', 'tritan'];
export const AMOUNTS = Array.from({ length: 21 }, (_, i) => i * 5);

/** @returns {Array<{ path: string, source: string }>} */
export function initialFiles() {
  const file = (key, value) => ({
    path: `content/initial/${key}-${value}.js`,
    source: `// Huefinch: tells the content script the current ${key} before the page paints.\n(globalThis.__huefinchInitial ??= {}).${key} = ${JSON.stringify(value)};\n`,
  });
  return [
    ...MODES.map((v) => file('mode', v)),
    ...TYPES.map((v) => file('type', v)),
    ...AMOUNTS.map((v) => file('amount', v)),
  ];
}
