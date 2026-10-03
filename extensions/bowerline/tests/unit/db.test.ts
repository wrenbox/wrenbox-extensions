import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DB_VERSION,
  MIGRATIONS,
  openDatabase,
  readLibrary,
  validateMigrations,
  type Migration,
} from '../../src/background/db';
import * as store from '../../src/background/store';
import { createBackup } from '../../src/shared/backup';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { LIBRARY, NOW, WEB } from './library-fixture';

let n = 0;
const freshName = () => `bowerline-test-${++n}`;

describe('migrations', () => {
  it('creates the schema from scratch: sources by key, highlights by sourceId', async () => {
    const db = await openDatabase(freshName());
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['highlights', 'sources']);
    const tx = db.transaction(['sources', 'highlights']);
    expect([...tx.objectStore('sources').indexNames]).toEqual(['key']);
    expect(tx.objectStore('sources').index('key').unique).toBe(true);
    expect([...tx.objectStore('highlights').indexNames]).toEqual(['sourceId']);
    db.close();
  });

  it('upgrades an existing database step by step, keeping data', async () => {
    const name = freshName();
    const v1 = await openDatabase(name, MIGRATIONS.slice(0, 1));
    await v1.put('sources', WEB);
    v1.close();

    const ran: number[] = [];
    const v2: Migration = {
      version: 2,
      description: 'test: add a createdAt index to highlights',
      up(_db, tx) {
        ran.push(2);
        tx.objectStore('highlights').createIndex('createdAt' as never, 'createdAt');
      },
    };
    const upgraded = await openDatabase(name, [...MIGRATIONS.slice(0, 1), v2]);
    expect(ran).toEqual([2]);
    expect(upgraded.version).toBe(2);
    expect(await upgraded.get('sources', WEB.id)).toEqual(WEB);
    expect([...upgraded.transaction('highlights').store.indexNames].sort()).toEqual([
      'createdAt',
      'sourceId',
    ]);
    upgraded.close();

    // Re-opening at the same version runs nothing again.
    ran.length = 0;
    (await openDatabase(name, [...MIGRATIONS.slice(0, 1), v2])).close();
    expect(ran).toEqual([]);
  });

  it('refuses a migration list with gaps', () => {
    expect(() =>
      validateMigrations([
        { version: 1, description: '', up() {} },
        { version: 3, description: '', up() {} },
      ]),
    ).toThrow();
  });

  it('opens a database created by plain idb at version 0 → 1', async () => {
    const name = freshName();
    (await openDB(name)).close();
    const db = await openDatabase(name);
    expect(db.version).toBe(1);
    db.close();
  });
});

describe('store operations', () => {
  let db: Awaited<ReturnType<typeof openDatabase>>;
  beforeEach(async () => {
    db = await openDatabase(freshName());
  });

  const page = { kind: 'web' as const, key: WEB.key, url: WEB.url, title: WEB.title };
  const input = {
    color: 'yellow' as const,
    text: 'A passage',
    selectors: [{ type: 'TextQuoteSelector' as const, exact: 'A passage', prefix: '', suffix: '' }],
  };

  it('creates a source on the first highlight and reuses it after', async () => {
    const a = await store.createHighlight(db, page, input);
    const b = await store.createHighlight(db, page, { ...input, color: 'mint' });
    expect(a.source.id).toBe(b.source.id);
    const { source, highlights } = await store.getSource(db, WEB.key);
    expect(source?.title).toBe(WEB.title);
    expect(highlights).toHaveLength(2);
  });

  it('updates colour and note, and flags orphans without touching updatedAt', async () => {
    const { highlight } = await store.createHighlight(db, page, input, 1000);
    const edited = await store.updateHighlight(
      db,
      highlight.id,
      { note: 'Why it matters', color: 'sky' },
      2000,
    );
    expect(edited).toMatchObject({ note: 'Why it matters', color: 'sky', updatedAt: 2000 });
    const changed = await store.setStatuses(db, [{ id: highlight.id, orphaned: true }]);
    expect(changed).toEqual([highlight.sourceId]);
    expect(await db.get('highlights', highlight.id)).toMatchObject({
      orphaned: true,
      updatedAt: 2000,
    });
    expect(await store.setStatuses(db, [{ id: highlight.id, orphaned: true }])).toEqual([]);
  });

  it('deleting the last highlight removes its source, and undo restores both', async () => {
    const { highlight } = await store.createHighlight(db, page, input);
    const removed = await store.deleteHighlight(db, highlight.id);
    expect(removed?.source?.key).toBe(WEB.key);
    expect((await readLibrary(db)).sources).toHaveLength(0);
    await store.restoreHighlight(db, removed!.highlight, removed!.source);
    const lib = await readLibrary(db);
    expect(lib.sources).toHaveLength(1);
    expect(lib.highlights[0]?.id).toBe(highlight.id);
  });

  it('touchSource refreshes display fields but never creates a source', async () => {
    expect(await store.touchSource(db, page)).toBeNull();
    await store.createHighlight(db, page, input);
    const touched = await store.touchSource(db, { ...page, title: 'New title' }, 5000);
    expect(touched).toMatchObject({ title: 'New title', updatedAt: 5000 });
  });

  it('imports a backup and reports what was added and skipped', async () => {
    const data = JSON.parse(JSON.stringify(createBackup(LIBRARY, DEFAULT_SETTINGS, '1.0.0', NOW)));
    const first = await store.importBackup(db, data, DEFAULT_SETTINGS);
    expect(first.report).toMatchObject({ sourcesAdded: 2, highlightsAdded: 5 });
    const second = await store.importBackup(db, data, DEFAULT_SETTINGS);
    expect(second.report).toMatchObject({
      sourcesAdded: 0,
      highlightsAdded: 0,
      highlightsSkipped: 5,
    });
    expect((await readLibrary(db)).highlights).toHaveLength(5);
  });

  it('deleteSource removes the source and all its highlights', async () => {
    const { source } = await store.createHighlight(db, page, input);
    await store.createHighlight(db, page, input);
    await store.deleteSource(db, source.id);
    expect(await readLibrary(db)).toEqual({ sources: [], highlights: [] });
  });
});
