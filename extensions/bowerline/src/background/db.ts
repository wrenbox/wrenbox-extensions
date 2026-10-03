/**
 * The IndexedDB database `bowerline`, owned by the service worker.
 * Content scripts never touch it: they run in the website's origin, where any
 * IndexedDB they opened would belong to the site.
 */
import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import type { Highlight, Library, Source } from '../shared/types';

export const DB_NAME = 'bowerline';

export interface BowerlineSchema extends DBSchema {
  sources: { key: string; value: Source; indexes: { key: string } };
  highlights: { key: string; value: Highlight; indexes: { sourceId: string } };
}

export type DB = IDBPDatabase<BowerlineSchema>;
type UpgradeTx = IDBPTransaction<BowerlineSchema, StoreNames<BowerlineSchema>[], 'versionchange'>;

export interface Migration {
  version: number;
  description: string;
  up(db: DB, tx: UpgradeTx): void | Promise<void>;
}

/**
 * Append-only list. Never edit a shipped migration; add a new one with the next
 * version number. Each runs once, in order, inside the upgrade transaction.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Create sources (by key) and highlights (by sourceId).',
    up(db) {
      const sources = db.createObjectStore('sources', { keyPath: 'id' });
      sources.createIndex('key', 'key', { unique: true });
      const highlights = db.createObjectStore('highlights', { keyPath: 'id' });
      highlights.createIndex('sourceId', 'sourceId');
    },
  },
];

export const DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export function validateMigrations(migrations: Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1)
      throw new Error(`Migration ${i} must have version ${i + 1}, got ${m.version}`);
  });
}

export async function openDatabase(
  name = DB_NAME,
  migrations: Migration[] = MIGRATIONS,
  version = migrations[migrations.length - 1]!.version,
): Promise<DB> {
  validateMigrations(migrations);
  const pending: Promise<void>[] = [];
  const db = await openDB<BowerlineSchema>(name, version, {
    upgrade(db, oldVersion, newVersion, tx) {
      for (const m of migrations) {
        if (m.version > oldVersion && m.version <= (newVersion ?? version)) {
          const r = m.up(db, tx);
          if (r) pending.push(r);
        }
      }
    },
    blocking() {
      // A newer version (e.g. after an update) wants the database: step aside
      // and let the next request reopen it.
      db.close();
      if (name === DB_NAME) dbPromise = null;
    },
    terminated() {
      if (name === DB_NAME) dbPromise = null;
    },
  });
  await Promise.all(pending);
  return db;
}

let dbPromise: Promise<DB> | null = null;

export function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function sourceByKey(db: DB, key: string): Promise<Source | undefined> {
  return db.getFromIndex('sources', 'key', key);
}

export async function highlightsForSource(db: DB, sourceId: string): Promise<Highlight[]> {
  return db.getAllFromIndex('highlights', 'sourceId', sourceId);
}

export async function readLibrary(db: DB): Promise<Library> {
  const tx = db.transaction(['sources', 'highlights']);
  const [sources, highlights] = await Promise.all([
    tx.objectStore('sources').getAll(),
    tx.objectStore('highlights').getAll(),
    tx.done,
  ]);
  return { sources, highlights };
}

export async function counts(db: DB): Promise<{ highlights: number; sources: number }> {
  const tx = db.transaction(['sources', 'highlights']);
  const [sources, highlights] = await Promise.all([
    tx.objectStore('sources').count(),
    tx.objectStore('highlights').count(),
    tx.done,
  ]);
  return { highlights, sources };
}

export async function clearAll(db: DB): Promise<void> {
  const tx = db.transaction(['sources', 'highlights'], 'readwrite');
  await Promise.all([
    tx.objectStore('sources').clear(),
    tx.objectStore('highlights').clear(),
    tx.done,
  ]);
}
