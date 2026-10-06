/**
 * Huefinch's settings: a handful of flat keys in chrome.storage.local (never
 * sync). Flat keys mean the popup, the settings page and the service worker can
 * each change one value without overwriting another's change.
 */
import { CVD_TYPES, type CvdType, type Mode } from './matrix';
import { cleanSiteList } from './hostname';

export interface Settings {
  /** Master switch. */
  enabled: boolean;
  /** Correct colors for the user, or simulate a deficiency (for designers). */
  mode: Mode;
  type: CvdType;
  /** Correction strength, 0–100. */
  strength: number;
  /** Simulation severity, 0–100. */
  severity: number;
  /** Site keys (see hostname.ts) where Huefinch is switched off. */
  offSites: string[];
}

export const SCHEMA_VERSION = 1;

export const DEFAULTS: Readonly<Settings> = Object.freeze({
  enabled: true,
  mode: 'correct',
  type: 'deutan',
  strength: 80,
  severity: 100,
  offSites: [],
});

export const SETTING_KEYS = Object.keys(DEFAULTS) as Array<keyof Settings>;
export const STORAGE_KEYS = ['schemaVersion', ...SETTING_KEYS] as const;

type Raw = Record<string, unknown>;

/**
 * Each entry upgrades stored data from version i to i + 1. Version 0 is
 * "whatever is there before the first versioned write": nothing on a fresh
 * install. Add a step here (never edit an old one) when the shape changes.
 */
export const MIGRATIONS: ReadonlyArray<(raw: Raw) => Raw> = [
  // 0 → 1: the first schema. Values are validated by sanitize() below.
  (raw) => raw,
];

const percent = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.round(Math.min(100, Math.max(0, v)))
    : fallback;

/** Turns anything read from storage into valid settings, keeping what's valid. */
export function sanitize(raw: Raw): Settings {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled,
    mode: raw.mode === 'correct' || raw.mode === 'simulate' ? raw.mode : DEFAULTS.mode,
    type: CVD_TYPES.includes(raw.type as CvdType) ? (raw.type as CvdType) : DEFAULTS.type,
    strength: percent(raw.strength, DEFAULTS.strength),
    severity: percent(raw.severity, DEFAULTS.severity),
    offSites: cleanSiteList(raw.offSites),
  };
}

export interface MigrationResult {
  settings: Settings;
  /** The values to write back (empty when storage is already current). */
  write: Raw;
  /** Keys to remove (unknown keys left by older builds). */
  remove: string[];
}

/** Runs pending migrations and validation on what storage holds. Pure, for tests. */
export function migrate(stored: Raw): MigrationResult {
  const from = typeof stored.schemaVersion === 'number' ? Math.floor(stored.schemaVersion) : 0;
  let raw: Raw = { ...stored };
  for (let v = Math.max(0, from); v < MIGRATIONS.length; v++) raw = MIGRATIONS[v]!(raw);
  const settings = sanitize(raw);

  const write: Raw = {};
  for (const key of SETTING_KEYS) {
    if (JSON.stringify(stored[key]) !== JSON.stringify(settings[key])) write[key] = settings[key];
  }
  // A newer Huefinch wrote this (the user downgraded): keep its version number
  // and anything it stored that this version doesn't know about.
  const newer = from > SCHEMA_VERSION;
  if (!newer && stored.schemaVersion !== SCHEMA_VERSION) write.schemaVersion = SCHEMA_VERSION;
  const known = new Set<string>(STORAGE_KEYS);
  const remove = newer ? [] : Object.keys(stored).filter((k) => !known.has(k));
  return { settings, write, remove };
}

export async function loadSettings(): Promise<Settings> {
  return sanitize(await chrome.storage.local.get([...STORAGE_KEYS]));
}

/** Brings storage up to date. Called by the service worker on install and startup. */
export async function migrateStorage(): Promise<Settings> {
  const all = await chrome.storage.local.get(null);
  const { settings, write, remove } = migrate(all);
  if (Object.keys(write).length) await chrome.storage.local.set(write);
  if (remove.length) await chrome.storage.local.remove(remove);
  return settings;
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.local.set(patch);
}

/** Applies a storage change event to settings already in memory. */
export function applyChanges(
  current: Settings,
  changes: Record<string, chrome.storage.StorageChange>,
): Settings {
  const raw: Raw = { ...current };
  for (const key of SETTING_KEYS) if (key in changes) raw[key] = changes[key]!.newValue;
  return sanitize(raw);
}

/** The percentage that matters in the current mode. */
export function amountOf(s: Settings): number {
  return s.mode === 'simulate' ? s.severity : s.strength;
}
