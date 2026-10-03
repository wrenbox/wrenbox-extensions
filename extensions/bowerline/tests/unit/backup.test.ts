import { describe, expect, it } from 'vitest';
import {
  BACKUP_VERSION,
  BackupError,
  createBackup,
  mergeSettings,
  planMerge,
  validateHighlight,
  validateSource,
} from '../../src/shared/backup';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import type { Library } from '../../src/shared/types';
import { HIGHLIGHTS, LABELLED, LIBRARY, NOW, PDF, WEB } from './library-fixture';

const EMPTY: Library = { sources: [], highlights: [] };
const backupOf = (lib: Library) =>
  JSON.parse(JSON.stringify(createBackup(lib, LABELLED, '1.0.0', NOW)));

describe('backup format', () => {
  it('is versioned and contains everything', () => {
    const b = createBackup(LIBRARY, LABELLED, '1.0.0', NOW);
    expect(b).toMatchObject({
      format: 'bowerline-backup',
      version: BACKUP_VERSION,
      exportedAt: NOW.toISOString(),
      app: { name: 'Bowerline', version: '1.0.0' },
    });
    expect(b.sources).toHaveLength(2);
    expect(b.highlights).toHaveLength(5);
    expect(b.settings.labels.yellow).toBe('key idea');
  });
});

describe('restore: validation', () => {
  it('rejects files that are not Bowerline backups', () => {
    expect(() => planMerge({ hello: 'world' }, EMPTY)).toThrow(BackupError);
    expect(() => planMerge(null, EMPTY)).toThrow('not a Bowerline backup');
    expect(() => planMerge([], EMPTY)).toThrow(BackupError);
  });

  it('rejects backups from a newer version with a helpful message', () => {
    expect(() => planMerge({ ...backupOf(LIBRARY), version: BACKUP_VERSION + 1 }, EMPTY)).toThrow(
      /newer version/,
    );
  });

  it('rejects a backup without sources or highlights arrays', () => {
    expect(() => planMerge({ format: 'bowerline-backup', version: 1, sources: {} }, EMPTY)).toThrow(
      /missing/,
    );
  });

  it('validates individual records and coerces dates', () => {
    expect(
      validateSource({ id: 'a', kind: 'web', key: 'k', createdAt: '2026-01-01T00:00:00Z' }),
    ).toMatchObject({ id: 'a', url: '', title: '', createdAt: Date.UTC(2026, 0, 1) });
    expect(validateSource({ id: 'a', kind: 'video', key: 'k' })).toBeNull();
    expect(validateHighlight({ ...HIGHLIGHTS[0], color: 'purple' })).toBeNull();
    expect(validateHighlight({ ...HIGHLIGHTS[0], selectors: 'nope' })).toBeNull();
    expect(validateHighlight({ ...HIGHLIGHTS[3], pdf: { page: 'x' } })).toBeNull();
    expect(validateHighlight({ ...HIGHLIGHTS[0], note: undefined })).toMatchObject({ note: '' });
  });
});

describe('restore: merge by id', () => {
  it('adds everything into an empty library', () => {
    const plan = planMerge(backupOf(LIBRARY), EMPTY);
    expect(plan.sourcesToAdd).toHaveLength(2);
    expect(plan.highlightsToAdd).toHaveLength(5);
    expect(plan.report).toMatchObject({
      sourcesAdded: 2,
      highlightsAdded: 5,
      highlightsSkipped: 0,
      invalid: 0,
    });
  });

  it('skips highlights already present and never overwrites them', () => {
    const plan = planMerge(backupOf(LIBRARY), {
      sources: [WEB],
      highlights: [HIGHLIGHTS[0]!, HIGHLIGHTS[1]!],
    });
    expect(plan.report).toMatchObject({
      sourcesAdded: 1,
      highlightsAdded: 3,
      highlightsSkipped: 2,
    });
    expect(plan.highlightsToAdd.map((h) => h.id)).not.toContain(HIGHLIGHTS[0]!.id);
    expect(plan.report.messages.join(' ')).toMatch(/2 highlights were already in this browser/);
  });

  it('folds a backed-up source into an existing source with the same key', () => {
    const existing = { ...PDF, id: 'other-id-for-same-file' };
    const plan = planMerge(backupOf(LIBRARY), { sources: [existing], highlights: [] });
    expect(plan.report.sourcesMerged).toBe(1);
    const pdfHighlights = plan.highlightsToAdd.filter((h) => h.pdf);
    expect(pdfHighlights.every((h) => h.sourceId === 'other-id-for-same-file')).toBe(true);
  });

  it('counts damaged entries and orphaned highlight references as invalid', () => {
    const data = backupOf(LIBRARY);
    data.sources.push({ id: 7 });
    data.highlights.push({ ...HIGHLIGHTS[0], id: 'h-new', sourceId: 'does-not-exist' });
    data.highlights.push('garbage');
    const plan = planMerge(data, EMPTY);
    expect(plan.report.invalid).toBe(3);
    expect(plan.report.highlightsAdded).toBe(5);
  });

  it('is idempotent: restoring the same backup twice adds nothing the second time', () => {
    const first = planMerge(backupOf(LIBRARY), EMPTY);
    const after: Library = { sources: first.sourcesToAdd, highlights: first.highlightsToAdd };
    const second = planMerge(backupOf(LIBRARY), after);
    expect(second.report).toMatchObject({
      sourcesAdded: 0,
      highlightsAdded: 0,
      highlightsSkipped: 5,
    });
  });
});

describe('restore: settings', () => {
  it('only fills in labels and the default colour the user has not changed', () => {
    const current = { ...DEFAULT_SETTINGS, labels: { ...DEFAULT_SETTINGS.labels, mint: 'mine' } };
    const backup = { ...LABELLED, defaultColor: 'pink' };
    const { settings, applied } = mergeSettings(current, backup, DEFAULT_SETTINGS);
    expect(settings.labels).toEqual({ yellow: 'key idea', mint: 'mine', pink: '', sky: '' });
    expect(settings.defaultColor).toBe('pink');
    expect(applied).toEqual(['label:yellow', 'defaultColor']);
  });

  it('ignores missing settings', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, undefined, DEFAULT_SETTINGS).applied).toEqual([]);
  });
});
