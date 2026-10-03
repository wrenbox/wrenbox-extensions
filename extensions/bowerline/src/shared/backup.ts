/**
 * Versioned backup file format, schema validation and merge-by-id restore.
 * Pure functions: the service worker applies the merge plan to the database.
 */
import { sanitizeSettings } from './settings';
import {
  isColor,
  type Highlight,
  type Library,
  type PdfAnchor,
  type Selector,
  type Settings,
  type Source,
} from './types';

export const BACKUP_FORMAT = 'bowerline-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: { name: string; version: string };
  settings: Settings;
  sources: Source[];
  highlights: Highlight[];
}

export interface ImportReport {
  sourcesAdded: number;
  sourcesMerged: number;
  highlightsAdded: number;
  highlightsSkipped: number;
  invalid: number;
  settingsApplied: string[];
  messages: string[];
}

export interface MergePlan {
  sourcesToAdd: Source[];
  highlightsToAdd: Highlight[];
  report: ImportReport;
}

export function createBackup(
  library: Library,
  settings: Settings,
  appVersion: string,
  now = new Date(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app: { name: 'Bowerline', version: appVersion },
    settings,
    sources: library.sources,
    highlights: library.highlights,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function toTime(v: unknown, fallback: number): number {
  if (isNum(v)) return v;
  if (isStr(v)) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return fallback;
}

export function validateSource(v: unknown, now = Date.now()): Source | null {
  if (!isObj(v)) return null;
  if (!isStr(v.id) || !v.id || !isStr(v.key) || !v.key) return null;
  if (v.kind !== 'web' && v.kind !== 'pdf') return null;
  const s: Source = {
    id: v.id,
    kind: v.kind,
    key: v.key,
    url: isStr(v.url) ? v.url : '',
    title: isStr(v.title) ? v.title : '',
    createdAt: toTime(v.createdAt, now),
    updatedAt: toTime(v.updatedAt, now),
  };
  if (isStr(v.fileName)) s.fileName = v.fileName;
  return s;
}

function validateSelectors(v: unknown): Selector[] | null {
  if (!Array.isArray(v)) return null;
  const out: Selector[] = [];
  for (const s of v) {
    if (!isObj(s)) continue;
    if (s.type === 'TextQuoteSelector' && isStr(s.exact)) {
      out.push({
        type: 'TextQuoteSelector',
        exact: s.exact,
        prefix: isStr(s.prefix) ? s.prefix : '',
        suffix: isStr(s.suffix) ? s.suffix : '',
      });
    } else if (s.type === 'TextPositionSelector' && isNum(s.start) && isNum(s.end)) {
      out.push({ type: 'TextPositionSelector', start: s.start, end: s.end });
    }
  }
  return out;
}

function validatePdf(v: unknown): PdfAnchor | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v) || !isNum(v.page) || !Array.isArray(v.rects)) return null;
  const rects = v.rects
    .filter(isObj)
    .filter((r) => isNum(r.x) && isNum(r.y) && isNum(r.w) && isNum(r.h))
    .map((r) => ({ x: r.x as number, y: r.y as number, w: r.w as number, h: r.h as number }));
  return { page: Math.max(1, Math.floor(v.page)), rects };
}

export function validateHighlight(v: unknown, now = Date.now()): Highlight | null {
  if (!isObj(v)) return null;
  if (!isStr(v.id) || !v.id || !isStr(v.sourceId) || !v.sourceId) return null;
  if (!isColor(v.color) || !isStr(v.text)) return null;
  const selectors = validateSelectors(v.selectors);
  if (!selectors) return null;
  const pdf = validatePdf(v.pdf);
  if (pdf === null) return null;
  const h: Highlight = {
    id: v.id,
    sourceId: v.sourceId,
    color: v.color,
    text: v.text,
    note: isStr(v.note) ? v.note : '',
    selectors,
    orphaned: v.orphaned === true,
    createdAt: toTime(v.createdAt, now),
    updatedAt: toTime(v.updatedAt, now),
  };
  if (pdf) h.pdf = pdf;
  return h;
}

export class BackupError extends Error {}

/** Checks the envelope; throws a BackupError with a readable message if it isn't a backup. */
export function parseBackupEnvelope(data: unknown): {
  sources: unknown[];
  highlights: unknown[];
  settings: unknown;
} {
  if (!isObj(data)) throw new BackupError('This file is not a Bowerline backup.');
  if (data.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Bowerline backup.');
  if (!isNum(data.version) || data.version < 1)
    throw new BackupError('The backup has no valid version.');
  if (data.version > BACKUP_VERSION) {
    throw new BackupError(
      'This backup was made by a newer version of Bowerline. Update Bowerline, then try again.',
    );
  }
  if (!Array.isArray(data.sources) || !Array.isArray(data.highlights)) {
    throw new BackupError('The backup is missing its sources or highlights.');
  }
  return { sources: data.sources, highlights: data.highlights, settings: data.settings };
}

/**
 * Plans a merge by id. Existing records always win (nothing in the browser is
 * overwritten). A backed-up source whose key matches an existing source with a
 * different id is folded into the existing one so pages never appear twice.
 */
export function planMerge(data: unknown, existing: Library, now = Date.now()): MergePlan {
  const env = parseBackupEnvelope(data);
  const report: ImportReport = {
    sourcesAdded: 0,
    sourcesMerged: 0,
    highlightsAdded: 0,
    highlightsSkipped: 0,
    invalid: 0,
    settingsApplied: [],
    messages: [],
  };
  const byId = new Map(existing.sources.map((s) => [s.id, s]));
  const byKey = new Map(existing.sources.map((s) => [s.key, s]));
  const sourceIdMap = new Map<string, string>();
  const sourcesToAdd: Source[] = [];

  for (const raw of env.sources) {
    const s = validateSource(raw, now);
    if (!s) {
      report.invalid++;
      continue;
    }
    if (byId.has(s.id)) {
      sourceIdMap.set(s.id, s.id);
      continue;
    }
    const sameKey = byKey.get(s.key);
    if (sameKey) {
      sourceIdMap.set(s.id, sameKey.id);
      report.sourcesMerged++;
      continue;
    }
    sourcesToAdd.push(s);
    byId.set(s.id, s);
    byKey.set(s.key, s);
    sourceIdMap.set(s.id, s.id);
    report.sourcesAdded++;
  }

  const existingHighlightIds = new Set(existing.highlights.map((h) => h.id));
  const highlightsToAdd: Highlight[] = [];
  for (const raw of env.highlights) {
    const h = validateHighlight(raw, now);
    if (!h) {
      report.invalid++;
      continue;
    }
    const sourceId = sourceIdMap.get(h.sourceId);
    if (!sourceId) {
      report.invalid++;
      continue;
    }
    if (existingHighlightIds.has(h.id)) {
      report.highlightsSkipped++;
      continue;
    }
    existingHighlightIds.add(h.id);
    highlightsToAdd.push({ ...h, sourceId });
    report.highlightsAdded++;
  }

  if (report.highlightsSkipped) {
    report.messages.push(
      `${report.highlightsSkipped} highlight${report.highlightsSkipped === 1 ? ' was' : 's were'} already in this browser and left unchanged.`,
    );
  }
  if (report.invalid) {
    report.messages.push(
      `${report.invalid} damaged entr${report.invalid === 1 ? 'y was' : 'ies were'} skipped.`,
    );
  }
  return { sourcesToAdd, highlightsToAdd, report };
}

/**
 * Settings from a backup only fill in values the user has not changed here,
 * so restoring never silently overrides choices made in this browser.
 */
export function mergeSettings(
  current: Settings,
  backupRaw: unknown,
  defaults: Settings,
): { settings: Settings; applied: string[] } {
  if (!isObj(backupRaw)) return { settings: current, applied: [] };
  const backup = sanitizeSettings(backupRaw);
  const next: Settings = { ...current, labels: { ...current.labels } };
  const applied: string[] = [];
  for (const c of Object.keys(next.labels) as Array<keyof Settings['labels']>) {
    if (!current.labels[c] && backup.labels[c]) {
      next.labels[c] = backup.labels[c];
      applied.push(`label:${c}`);
    }
  }
  if (
    current.defaultColor === defaults.defaultColor &&
    backup.defaultColor !== defaults.defaultColor
  ) {
    next.defaultColor = backup.defaultColor;
    applied.push('defaultColor');
  }
  return { settings: next, applied };
}
