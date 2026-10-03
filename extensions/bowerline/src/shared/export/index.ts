/**
 * Exporters: Obsidian, Markdown, Notion, CSV and the JSON backup.
 * Pure functions with an injectable clock, covered by golden-file tests.
 */
import { COLOR_INFO, colorLabel } from '../colors';
import { createBackup } from '../backup';
import type { Highlight, Library, Settings, Source } from '../types';
import { positionSelector } from '../types';

export type ExportFormat = 'obsidian' | 'markdown' | 'notion' | 'csv' | 'backup';

export interface FormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  extension: string;
  mime: string;
}

export const FORMATS: FormatInfo[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Markdown with callouts and tags',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Clean notes for any app',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Paste straight into a page',
    extension: 'md',
    mime: 'text/markdown',
  },
  {
    id: 'csv',
    name: 'CSV',
    description: 'Open in Sheets or Excel',
    extension: 'csv',
    mime: 'text/csv',
  },
  {
    id: 'backup',
    name: 'Backup file',
    description: 'Restore everything later',
    extension: 'json',
    mime: 'application/json',
  },
];

export interface ExportGroup {
  source: Source;
  highlights: Highlight[];
}

export interface ExportOptions {
  labels: Settings['labels'];
  now?: Date;
}

/** Reading order: PDFs by page then position on the page; web pages by text position. */
export function sortHighlights(highlights: Highlight[]): Highlight[] {
  const key = (h: Highlight): [number, number, number] => {
    if (h.pdf) {
      const r = h.pdf.rects[0];
      return [h.pdf.page, r ? Math.round(r.y) : 0, r ? r.x : 0];
    }
    const pos = positionSelector(h);
    return [0, pos ? pos.start : Number.MAX_SAFE_INTEGER, h.createdAt];
  };
  return [...highlights].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || a.createdAt - b.createdAt;
  });
}

/** Groups highlights by source (optionally only some sources), newest source first. */
export function buildGroups(library: Library, sourceIds?: Iterable<string>): ExportGroup[] {
  const wanted = sourceIds ? new Set(sourceIds) : null;
  const bySource = new Map<string, Highlight[]>();
  for (const h of library.highlights) {
    if (wanted && !wanted.has(h.sourceId)) continue;
    const list = bySource.get(h.sourceId);
    if (list) list.push(h);
    else bySource.set(h.sourceId, [h]);
  }
  return library.sources
    .filter((s) => bySource.has(s.id))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title))
    .map((source) => ({ source, highlights: sortHighlights(bySource.get(source.id)!) }));
}

export function sourceTitle(s: Source): string {
  return s.title.trim() || s.fileName || s.url || 'Untitled';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YAML scalar: bare when unambiguous, otherwise a JSON (= YAML double-quoted) string. */
function yaml(value: string): string {
  const reserved = /^(true|false|null|yes|no|on|off|~)$/i;
  if (/^[A-Za-z0-9][\w .\-/()]*$/.test(value) && !reserved.test(value) && !/\s$/.test(value))
    return value;
  return JSON.stringify(value);
}

function quoteLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => (l ? `> ${l}` : '>'))
    .join('\n');
}

function pageLabel(h: Highlight): string | null {
  return h.pdf ? `Page ${h.pdf.page}` : null;
}

function sourceLine(s: Source): string {
  if (s.kind === 'pdf') {
    const file = s.fileName || sourceTitle(s);
    return s.url && /^https?:/.test(s.url) ? `File: ${file} (${s.url})` : `File: ${file}`;
  }
  return `Source: ${s.url}`;
}

// ── Obsidian ────────────────────────────────────────────────────────────────

function obsidianCallout(h: Highlight, labels: Settings['labels']): string {
  const page = pageLabel(h);
  const custom = labels[h.color]?.trim();
  const title = page
    ? custom
      ? `${page} · ${colorLabel(h.color, labels)}`
      : page
    : colorLabel(h.color, labels);
  let out = `> [!highlight-${h.color}] ${title}\n${quoteLines(h.text)}`;
  if (h.note.trim()) out += `\n\n${h.note.trim()}`;
  return out;
}

export function toObsidian(groups: ExportGroup[], opts: ExportOptions): string {
  const now = opts.now ?? new Date();
  const total = groups.reduce((n, g) => n + g.highlights.length, 0);
  if (groups.length === 1) {
    const { source, highlights } = groups[0]!;
    const front = [
      '---',
      `title: ${yaml(sourceTitle(source))}`,
      `source: ${yaml(source.kind === 'pdf' ? source.fileName || sourceTitle(source) : source.url)}`,
      ...(source.kind === 'pdf' && source.url ? [`url: ${yaml(source.url)}`] : []),
      `tags: [bowerline, ${source.kind}]`,
      `highlights: ${highlights.length}`,
      `exported: ${isoDate(now)}`,
      '---',
    ].join('\n');
    const body = highlights.map((h) => obsidianCallout(h, opts.labels)).join('\n\n');
    return `${front}\n\n# ${sourceTitle(source)}\n\n${body}\n`;
  }
  const front = [
    '---',
    'title: Bowerline highlights',
    'tags: [bowerline]',
    `sources: ${groups.length}`,
    `highlights: ${total}`,
    `exported: ${isoDate(now)}`,
    '---',
  ].join('\n');
  const sections = groups.map(({ source, highlights }) => {
    const body = highlights.map((h) => obsidianCallout(h, opts.labels)).join('\n\n');
    return `## ${sourceTitle(source)}\n\n${sourceLine(source)}\n\n${body}`;
  });
  return `${front}\n\n# Bowerline highlights\n\n${sections.join('\n\n')}\n`;
}

// ── Markdown ────────────────────────────────────────────────────────────────

function markdownItem(h: Highlight, labels: Settings['labels']): string {
  const meta = [h.pdf ? `p. ${h.pdf.page}` : null, colorLabel(h.color, labels)]
    .filter(Boolean)
    .join(' · ');
  let out = `- ${h.text.replace(/\s*\n\s*/g, ' ')} (${meta})`;
  const note = h.note.trim();
  if (note) out += `\n    - ${note.replace(/\n/g, '\n      ')}`;
  return out;
}

export function toMarkdown(groups: ExportGroup[], opts: ExportOptions): string {
  const section = (g: ExportGroup, level: string) =>
    `${level} ${sourceTitle(g.source)}\n\n${sourceLine(g.source)}\n\n${g.highlights
      .map((h) => markdownItem(h, opts.labels))
      .join('\n')}`;
  if (groups.length === 1) return `${section(groups[0]!, '#')}\n`;
  return `# Bowerline highlights\n\n${groups.map((g) => section(g, '##')).join('\n\n')}\n`;
}

// ── Notion ──────────────────────────────────────────────────────────────────

function notionBlock(h: Highlight): string {
  const page = h.pdf ? ` (p. ${h.pdf.page})` : '';
  let out = quoteLines(`${h.text}${page}`);
  const note = h.note.trim();
  if (note) out += `\n\n**${note.replace(/\*\*/g, '\\*\\*').replace(/\n+/g, ' ')}**`;
  return out;
}

export function toNotion(groups: ExportGroup[], _opts: ExportOptions): string {
  const section = (g: ExportGroup, level: string) => {
    const link =
      g.source.url && /^https?:/.test(g.source.url)
        ? `[${g.source.url}](${g.source.url})`
        : sourceLine(g.source);
    return `${level} ${sourceTitle(g.source)}\n\n${link}\n\n${g.highlights.map(notionBlock).join('\n\n')}`;
  };
  if (groups.length === 1) return `${section(groups[0]!, '#')}\n`;
  return `# Bowerline highlights\n\n${groups.map((g) => section(g, '##')).join('\n\n')}\n`;
}

// ── CSV (RFC 4180, UTF-8 with BOM) ──────────────────────────────────────────

/**
 * Quotes per RFC 4180. Cells that a spreadsheet would run as a formula
 * (=, +, -, @, tab, CR) get a leading apostrophe: page text is untrusted.
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = [
  'Source',
  'Type',
  'URL',
  'File name',
  'Page',
  'Colour',
  'Label',
  'Text',
  'Note',
  'Created',
  'Updated',
  'Highlight ID',
];

export function toCsv(groups: ExportGroup[], opts: ExportOptions): string {
  const rows: Array<Array<string | number>> = [CSV_HEADER];
  for (const { source, highlights } of groups) {
    for (const h of highlights) {
      rows.push([
        sourceTitle(source),
        source.kind === 'pdf' ? 'PDF' : 'Web',
        source.url,
        source.fileName ?? '',
        h.pdf ? h.pdf.page : '',
        COLOR_INFO[h.color].name,
        opts.labels[h.color] ?? '',
        h.text,
        h.note,
        new Date(h.createdAt).toISOString(),
        new Date(h.updatedAt).toISOString(),
        h.id,
      ]);
    }
  }
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export interface ExportRequest {
  format: ExportFormat;
  groups: ExportGroup[];
  library: Library;
  settings: Settings;
  appVersion: string;
  now?: Date;
}

export function runExport(req: ExportRequest): string {
  const opts: ExportOptions = { labels: req.settings.labels, now: req.now };
  switch (req.format) {
    case 'obsidian':
      return toObsidian(req.groups, opts);
    case 'markdown':
      return toMarkdown(req.groups, opts);
    case 'notion':
      return toNotion(req.groups, opts);
    case 'csv':
      return toCsv(req.groups, opts);
    case 'backup': {
      // A backup of a subset contains exactly the sources and highlights shown.
      const sourceIds = new Set(req.groups.map((g) => g.source.id));
      const subset: Library = {
        sources: req.library.sources.filter((s) => sourceIds.has(s.id)),
        highlights: req.groups.flatMap((g) => g.highlights),
      };
      return `${JSON.stringify(createBackup(subset, req.settings, req.appVersion, req.now), null, 2)}\n`;
    }
  }
}

export function exportFileName(
  format: ExportFormat,
  groups: ExportGroup[],
  now = new Date(),
): string {
  const info = FORMATS.find((f) => f.id === format)!;
  const date = isoDate(now);
  if (format === 'backup') return `bowerline-backup-${date}.json`;
  const base =
    groups.length === 1
      ? sourceTitle(groups[0]!.source)
          .replace(/\.pdf$/i, '')
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60)
          .toLowerCase() || 'highlights'
      : 'bowerline-highlights';
  return `${base}-${date}.${info.extension}`;
}
