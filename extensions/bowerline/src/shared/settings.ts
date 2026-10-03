/**
 * Settings live in chrome.storage.local, never chrome.storage.sync: sync
 * would copy them to Google's servers, which breaks Bowerline's promise.
 */
import { COLORS, isColor, type Color, type Settings, type Theme } from './types';

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  defaultColor: 'yellow',
  showToolbar: true,
  theme: 'system',
  labels: { yellow: '', mint: '', pink: '', sky: '' },
};

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/** Coerces anything (old versions, hand-edited backups) into valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const labelsIn = (r.labels && typeof r.labels === 'object' ? r.labels : {}) as Record<
    string,
    unknown
  >;
  const labels = { ...DEFAULT_SETTINGS.labels };
  for (const c of COLORS) {
    const v = labelsIn[c];
    if (typeof v === 'string') labels[c] = v.slice(0, 40);
  }
  return {
    defaultColor: isColor(r.defaultColor) ? r.defaultColor : DEFAULT_SETTINGS.defaultColor,
    showToolbar: typeof r.showToolbar === 'boolean' ? r.showToolbar : DEFAULT_SETTINGS.showToolbar,
    theme: THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_SETTINGS.theme,
    labels,
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = sanitizeSettings({ ...(await getSettings()), ...patch });
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY])
      cb(sanitizeSettings(changes[SETTINGS_KEY].newValue));
  });
}

export function setLabel(settings: Settings, color: Color, label: string): Settings {
  return { ...settings, labels: { ...settings.labels, [color]: label } };
}
