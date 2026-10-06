/** Shortcut names as people know them on their computer. */

const isMac = (): boolean => /Mac/i.test(navigator.platform || navigator.userAgent);

/** "Alt+Shift+C" → "Option+Shift+C" on a Mac. */
export function keyLabel(shortcut: string): string {
  return isMac()
    ? shortcut.replace(/\bAlt\b/g, 'Option').replace(/\bCtrl\b/g, 'Control')
    : shortcut;
}

/** The current key for the on/off command (users can change it), or null if unset. */
export async function toggleShortcut(): Promise<string | null> {
  const commands = await chrome.commands.getAll();
  const c = commands.find((x) => x.name === 'toggle-huefinch');
  return c?.shortcut ? c.shortcut : null;
}

/** "Edge" in Microsoft Edge, "Chrome" everywhere else (same build for both stores). */
export const browserName = (): 'Chrome' | 'Edge' =>
  /\bEdg\//.test(navigator.userAgent) ? 'Edge' : 'Chrome';
