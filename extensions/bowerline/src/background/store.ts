/** Data operations on the database. Kept free of chrome.* so they can be unit-tested. */
import { mergeSettings, planMerge, type ImportReport } from '../shared/backup';
import { DEFAULT_SETTINGS } from '../shared/settings';
import type {
  Highlight,
  HighlightInput,
  HighlightPatch,
  Settings,
  Source,
  SourceInput,
} from '../shared/types';
import { highlightsForSource, sourceByKey, readLibrary, type DB } from './db';

const uuid = (): string => crypto.randomUUID();

export async function getSource(
  db: DB,
  key: string,
): Promise<{ source: Source | null; highlights: Highlight[] }> {
  const source = await sourceByKey(db, key);
  if (!source) return { source: null, highlights: [] };
  return { source, highlights: await highlightsForSource(db, source.id) };
}

/** Refreshes display fields (title, URL, file name) of an existing source. Never creates one. */
export async function touchSource(
  db: DB,
  input: SourceInput,
  now = Date.now(),
): Promise<Source | null> {
  const tx = db.transaction('sources', 'readwrite');
  const existing = await tx.store.index('key').get(input.key);
  if (!existing) {
    await tx.done;
    return null;
  }
  const next: Source = { ...existing };
  let changed = false;
  if (input.title && input.title !== existing.title) {
    next.title = input.title;
    changed = true;
  }
  if (input.url && input.url !== existing.url) {
    next.url = input.url;
    changed = true;
  }
  if (input.fileName && input.fileName !== existing.fileName) {
    next.fileName = input.fileName;
    changed = true;
  }
  if (changed) {
    next.updatedAt = now;
    await tx.store.put(next);
  }
  await tx.done;
  return next;
}

export async function createHighlight(
  db: DB,
  input: SourceInput,
  h: HighlightInput,
  now = Date.now(),
): Promise<{ highlight: Highlight; source: Source }> {
  const tx = db.transaction(['sources', 'highlights'], 'readwrite');
  const sources = tx.objectStore('sources');
  let source = await sources.index('key').get(input.key);
  if (!source) {
    source = {
      id: uuid(),
      kind: input.kind,
      key: input.key,
      url: input.url,
      title: input.title,
      createdAt: now,
      updatedAt: now,
    };
    if (input.fileName) source.fileName = input.fileName;
  } else {
    source = {
      ...source,
      url: input.url || source.url,
      title: input.title || source.title,
      updatedAt: now,
    };
    if (input.fileName) source.fileName = input.fileName;
  }
  await sources.put(source);
  const highlight: Highlight = {
    id: uuid(),
    sourceId: source.id,
    color: h.color,
    text: h.text,
    note: h.note ?? '',
    selectors: h.selectors,
    orphaned: false,
    createdAt: now,
    updatedAt: now,
  };
  if (h.pdf) highlight.pdf = h.pdf;
  await tx.objectStore('highlights').put(highlight);
  await tx.done;
  return { highlight, source };
}

export async function updateHighlight(
  db: DB,
  id: string,
  patch: HighlightPatch,
  now = Date.now(),
): Promise<Highlight | null> {
  const tx = db.transaction(['highlights', 'sources'], 'readwrite');
  const store = tx.objectStore('highlights');
  const existing = await store.get(id);
  if (!existing) {
    await tx.done;
    return null;
  }
  const next: Highlight = { ...existing };
  if (patch.color !== undefined) next.color = patch.color;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.orphaned !== undefined) next.orphaned = patch.orphaned;
  // Status flips are bookkeeping, not edits: they don't bump updatedAt.
  const edited = patch.color !== undefined || patch.note !== undefined;
  if (edited) next.updatedAt = now;
  await store.put(next);
  if (edited) {
    const source = await tx.objectStore('sources').get(existing.sourceId);
    if (source) await tx.objectStore('sources').put({ ...source, updatedAt: now });
  }
  await tx.done;
  return next;
}

/** Deletes a highlight. A source left with no highlights is removed too (undo restores both). */
export async function deleteHighlight(
  db: DB,
  id: string,
): Promise<{ highlight: Highlight; source: Source | null } | null> {
  const tx = db.transaction(['highlights', 'sources'], 'readwrite');
  const highlights = tx.objectStore('highlights');
  const existing = await highlights.get(id);
  if (!existing) {
    await tx.done;
    return null;
  }
  await highlights.delete(id);
  const remaining = await highlights.index('sourceId').count(existing.sourceId);
  const source = (await tx.objectStore('sources').get(existing.sourceId)) ?? null;
  if (remaining === 0 && source) await tx.objectStore('sources').delete(source.id);
  await tx.done;
  return { highlight: existing, source };
}

/** Undo for delete: puts the highlight (and its source, if it was removed) back. */
export async function restoreHighlight(
  db: DB,
  highlight: Highlight,
  source?: Source | null,
): Promise<Highlight> {
  const tx = db.transaction(['highlights', 'sources'], 'readwrite');
  const sources = tx.objectStore('sources');
  let sourceId = highlight.sourceId;
  if (!(await sources.get(sourceId)) && source) {
    const sameKey = await sources.index('key').get(source.key);
    if (sameKey) sourceId = sameKey.id;
    else await sources.put(source);
  }
  const restored = { ...highlight, sourceId };
  await tx.objectStore('highlights').put(restored);
  await tx.done;
  return restored;
}

export async function setStatuses(
  db: DB,
  updates: Array<{ id: string; orphaned: boolean }>,
): Promise<string[]> {
  const tx = db.transaction('highlights', 'readwrite');
  const changedSources = new Set<string>();
  for (const u of updates) {
    const h = await tx.store.get(u.id);
    if (h && h.orphaned !== u.orphaned) {
      await tx.store.put({ ...h, orphaned: u.orphaned });
      changedSources.add(h.sourceId);
    }
  }
  await tx.done;
  return [...changedSources];
}

export async function deleteSource(db: DB, id: string): Promise<void> {
  const tx = db.transaction(['highlights', 'sources'], 'readwrite');
  const highlights = tx.objectStore('highlights');
  for (const key of await highlights.index('sourceId').getAllKeys(id)) await highlights.delete(key);
  await tx.objectStore('sources').delete(id);
  await tx.done;
}

export async function importBackup(
  db: DB,
  data: unknown,
  currentSettings: Settings,
): Promise<{ report: ImportReport; settings: Settings | null }> {
  const plan = planMerge(data, await readLibrary(db));
  const tx = db.transaction(['sources', 'highlights'], 'readwrite');
  for (const s of plan.sourcesToAdd) await tx.objectStore('sources').put(s);
  for (const h of plan.highlightsToAdd) await tx.objectStore('highlights').put(h);
  await tx.done;
  const env = data as { settings?: unknown };
  const merged = mergeSettings(currentSettings, env.settings, DEFAULT_SETTINGS);
  plan.report.settingsApplied = merged.applied;
  return { report: plan.report, settings: merged.applied.length ? merged.settings : null };
}
