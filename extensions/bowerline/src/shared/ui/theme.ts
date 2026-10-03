import { getSettings, onSettingsChanged } from '../settings';
import type { Theme } from '../types';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Applies the saved theme now and whenever it changes. */
export async function initTheme(): Promise<void> {
  applyTheme((await getSettings()).theme);
  onSettingsChanged((s) => applyTheme(s.theme));
}

export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
