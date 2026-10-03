import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGroups,
  csvCell,
  exportFileName,
  runExport,
  sortHighlights,
  type ExportFormat,
} from '../../src/shared/export';
import { LABELLED, LIBRARY, NOW, PDF, WEB } from './library-fixture';

const GOLDEN = join(import.meta.dirname, '../fixtures/golden');

/** Compares with a committed golden file. Run with UPDATE_GOLDEN=1 to rewrite them. */
function golden(name: string, actual: string): void {
  const file = join(GOLDEN, name);
  if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
    mkdirSync(GOLDEN, { recursive: true });
    writeFileSync(file, actual);
    if (!process.env.UPDATE_GOLDEN)
      throw new Error(
        `Golden file ${name} was missing and has been written; review it and re-run.`,
      );
  }
  expect(actual).toBe(readFileSync(file, 'utf8'));
}

const run = (format: ExportFormat, sourceIds?: string[]) =>
  runExport({
    format,
    groups: buildGroups(LIBRARY, sourceIds),
    library: LIBRARY,
    settings: LABELLED,
    appVersion: '1.0.0',
    now: NOW,
  });

describe('exporters (golden files)', () => {
  it('Obsidian: one PDF, YAML front matter, callouts with page numbers', () =>
    golden('obsidian-pdf.md', run('obsidian', [PDF.id])));
  it('Obsidian: whole library', () => golden('obsidian-library.md', run('obsidian')));
  it('Markdown: one web page', () => golden('markdown-web.md', run('markdown', [WEB.id])));
  it('Markdown: whole library', () => golden('markdown-library.md', run('markdown')));
  it('Notion: whole library', () => golden('notion-library.md', run('notion')));
  it('CSV: whole library', () => golden('library.csv', run('csv')));
  it('Backup: one source', () => golden('backup-web.json', run('backup', [WEB.id])));
});

describe('exporter details', () => {
  it('Obsidian callouts use the colour name and the user label', () => {
    const out = run('obsidian', [PDF.id]);
    expect(out).toMatch(
      /^---\ntitle: Spaced retrieval study\nsource: spaced-retrieval-study.pdf\ntags: \[bowerline, pdf\]/,
    );
    expect(out).toContain('> [!highlight-mint] Page 3 · Mint: evidence');
    expect(out).toContain('> [!highlight-sky] Page 3\n');
  });

  it('Notion puts the note in bold after the quote block', () => {
    expect(run('notion', [WEB.id])).toContain(
      '> The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.\n\n**Good opening line for my essay intro.**',
    );
  });

  it('CSV starts with a UTF-8 BOM, uses CRLF and RFC 4180 quoting', () => {
    const csv = run('csv');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n')[0]).toBe(
      '﻿Source,Type,URL,File name,Page,Colour,Label,Text,Note,Created,Updated,Highlight ID',
    );
    expect(csv).toContain(
      '"Researchers say ""test yourself"", then = practice, + spaced, at a day, a week and a month later"',
    );
    expect(csv).toContain('"Quotes, commas and a leading = check CSV escaping.\nSecond line."');
  });

  it('CSV cells that a spreadsheet would execute are neutralised', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('plain')).toBe('plain');
  });

  it('sorts PDF highlights by page and position, web highlights by text position', () => {
    const groups = buildGroups(LIBRARY);
    const pdf = groups.find((g) => g.source.id === PDF.id)!;
    expect(pdf.highlights.map((h) => h.id)).toEqual(['h-pdf-1', 'h-pdf-2']);
    const web = groups.find((g) => g.source.id === WEB.id)!;
    expect(web.highlights.map((h) => h.id)).toEqual(['h-web-1', 'h-web-2', 'h-web-3']);
    expect(sortHighlights([])).toEqual([]);
  });

  it('backup of a subset contains exactly that subset', () => {
    const backup = JSON.parse(run('backup', [WEB.id]));
    expect(backup.format).toBe('bowerline-backup');
    expect(backup.sources.map((s: { id: string }) => s.id)).toEqual([WEB.id]);
    expect(backup.highlights).toHaveLength(3);
  });

  it('builds friendly file names', () => {
    const one = buildGroups(LIBRARY, [PDF.id]);
    expect(exportFileName('obsidian', one, NOW)).toBe('spaced-retrieval-study-2026-10-03.md');
    expect(exportFileName('csv', buildGroups(LIBRARY), NOW)).toBe(
      'bowerline-highlights-2026-10-03.csv',
    );
    expect(exportFileName('backup', one, NOW)).toBe('bowerline-backup-2026-10-03.json');
  });
});
