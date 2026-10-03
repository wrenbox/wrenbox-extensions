/**
 * The highlight list used by the side panel and the library page: search
 * (case- and accent-insensitive), colour filter, grouping by source, inline
 * note editing, colour changes and delete with a 5-second undo.
 */
import { COLOR_INFO, colorLabel } from '../colors';
import { buildGroups, sourceTitle, type ExportGroup } from '../export';
import { send } from '../messages';
import { findMatches, fold } from '../text';
import {
  COLORS,
  type Color,
  type Highlight,
  type Library,
  type Settings,
  type Source,
  type SourceKind,
} from '../types';
import { clear, h, markText } from './dom';
import { copyText, toast } from './feedback';
import { icon } from './icons';

export interface Filter {
  query: string;
  colors: Set<Color>;
  sourceIds?: Set<string>;
  kind?: SourceKind;
  notesOnly?: boolean;
}

export function matchesQuery(hl: Highlight, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(hl.text).includes(q) || fold(hl.note).includes(q);
}

export function filterLibrary(library: Library, f: Filter): ExportGroup[] {
  const sources = f.kind ? library.sources.filter((s) => s.kind === f.kind) : library.sources;
  const groups = buildGroups({ sources, highlights: library.highlights }, f.sourceIds);
  return groups
    .map((g) => ({
      source: g.source,
      highlights: g.highlights.filter(
        (hl) =>
          (f.colors.size === 0 || f.colors.has(hl.color)) &&
          (!f.notesOnly || hl.note.trim() !== '') &&
          matchesQuery(hl, f.query),
      ),
    }))
    .filter((g) => g.highlights.length > 0);
}

export function summary(groups: ExportGroup[], query: string, hasFilter: boolean): string {
  const n = groups.reduce((a, g) => a + g.highlights.length, 0);
  const s = groups.length;
  const noun =
    query.trim() || hasFilter
      ? n === 1
        ? 'match'
        : 'matches'
      : n === 1
        ? 'highlight'
        : 'highlights';
  return `${n} ${noun} in ${s} source${s === 1 ? '' : 's'}`;
}

/** Colour filter chips plus "All colours". */
export function colorFilter(
  selected: Set<Color>,
  labels: Settings['labels'],
  onChange: () => void,
): HTMLElement {
  const wrap = h('div', { class: 'color-filter', role: 'group', 'aria-label': 'Filter by colour' });
  const all = h('button', {
    type: 'button',
    class: 'all-colours',
    'aria-pressed': String(selected.size === 0),
    text: 'All colours',
    onClick: () => {
      selected.clear();
      onChange();
    },
  });
  for (const c of COLORS) {
    wrap.append(
      h('button', {
        type: 'button',
        class: 'swatch',
        dataset: { color: c },
        title: colorLabel(c, labels),
        'aria-label': `Show ${colorLabel(c, labels)}`,
        'aria-pressed': String(selected.has(c)),
        onClick: () => {
          if (selected.has(c)) selected.delete(c);
          else selected.add(c);
          onChange();
        },
      }),
    );
  }
  wrap.append(all);
  return wrap;
}

export interface ListOptions {
  query: string;
  labels: Settings['labels'];
  /** Show "Not found on this page" styling for orphaned highlights. */
  showOrphanBadge?: boolean;
  onSourceClick?(source: Source): void;
  emptyMessage?: Node | string;
}

function kindLabel(kind: SourceKind): string {
  return kind === 'pdf' ? 'PDF' : 'Web';
}

/** True while an inline note editor is open, so live refreshes can wait. */
export function isEditing(root: ParentNode = document): boolean {
  const active = document.activeElement;
  return !!active && !!root.querySelector('.hl-editor')?.contains(active);
}

export function renderGroups(
  container: HTMLElement,
  groups: ExportGroup[],
  opts: ListOptions,
): void {
  clear(container);
  if (!groups.length) {
    if (opts.emptyMessage) {
      container.append(h('div', { class: 'empty' }, opts.emptyMessage));
    }
    return;
  }
  for (const g of groups) {
    const header = h(
      'div',
      { class: 'group-head' },
      opts.onSourceClick
        ? h('button', {
            type: 'button',
            class: 'group-title link',
            text: sourceTitle(g.source),
            title: g.source.url || g.source.fileName || '',
            onClick: () => opts.onSourceClick!(g.source),
          })
        : h('span', {
            class: 'group-title',
            text: sourceTitle(g.source),
            title: g.source.url || '',
          }),
      h('span', { class: 'group-kind', text: kindLabel(g.source.kind) }),
    );
    const list = h('div', { class: 'group-list', role: 'list' });
    for (const hl of g.highlights) list.append(card(hl, opts));
    container.append(
      h('section', { class: 'group', 'aria-label': sourceTitle(g.source) }, header, list),
    );
  }
}

function card(hl: Highlight, opts: ListOptions): HTMLElement {
  const label = colorLabel(hl.color, opts.labels);
  const root = h('article', {
    class: 'hl-card',
    role: 'listitem',
    style: { '--bar': COLOR_INFO[hl.color].solid },
    dataset: { id: hl.id, color: hl.color },
  });
  const textMatches = findMatches(hl.text, opts.query);
  const main = h(
    'button',
    {
      type: 'button',
      class: 'hl-main',
      title: 'Show this highlight',
      onClick: () => void focusHighlight(hl.id),
    },
    h('span', { class: 'hl-text' }, ...markText(hl.text, textMatches)),
  );
  const noteBox = h('div', { class: 'hl-note-wrap' });
  const renderNote = () => {
    clear(noteBox);
    if (hl.note.trim()) {
      noteBox.append(
        h(
          'button',
          { type: 'button', class: 'hl-note', title: 'Edit note', onClick: () => editNote() },
          ...markText(hl.note, findMatches(hl.note, opts.query)),
        ),
      );
    }
  };
  const editNote = () => {
    clear(noteBox);
    const area = h('textarea', {
      rows: '3',
      'aria-label': 'Note',
      placeholder: 'Add a note…',
      value: hl.note,
    });
    const save = async () => {
      const text = area.value.trim();
      if (text !== hl.note) {
        hl.note = text;
        await send('highlight:update', { id: hl.id, patch: { note: text } });
      }
      renderNote();
    };
    const cancel = () => renderNote();
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void save();
      }
    });
    noteBox.append(
      h(
        'div',
        { class: 'hl-editor' },
        area,
        h(
          'div',
          { class: 'hl-editor-actions' },
          h('button', {
            type: 'button',
            class: 'btn small ghost',
            text: 'Cancel',
            onClick: cancel,
          }),
          h('button', {
            type: 'button',
            class: 'btn small primary',
            text: 'Save',
            onClick: () => void save(),
          }),
        ),
      ),
    );
    area.focus();
  };
  renderNote();

  const meta = h(
    'div',
    { class: 'hl-meta' },
    h('span', { class: 'hl-color', text: label }),
    hl.pdf ? h('span', { text: `Page ${hl.pdf.page}` }) : null,
    opts.showOrphanBadge && hl.orphaned
      ? h('span', { class: 'badge', text: 'Not found last visit' })
      : null,
  );

  const colours = h('div', { class: 'hl-colours', role: 'group', 'aria-label': 'Change colour' });
  for (const c of COLORS) {
    colours.append(
      h('button', {
        type: 'button',
        class: 'swatch small',
        dataset: { color: c },
        title: colorLabel(c, opts.labels),
        'aria-label': `Change colour to ${colorLabel(c, opts.labels)}`,
        'aria-pressed': String(c === hl.color),
        onClick: () => void send('highlight:update', { id: hl.id, patch: { color: c } }),
      }),
    );
  }
  const actions = h(
    'div',
    { class: 'hl-actions' },
    colours,
    h(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        title: hl.note ? 'Edit note' : 'Add note',
        'aria-label': hl.note ? 'Edit note' : 'Add note',
        onClick: () => editNote(),
      },
      icon('note'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        title: 'Copy text',
        'aria-label': 'Copy text',
        onClick: async () =>
          toast((await copyText(hl.text)) ? 'Copied.' : 'Copy failed.', undefined, 1800),
      },
      icon('copy'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        title: 'Delete',
        'aria-label': 'Delete highlight',
        onClick: () => void remove(hl, root),
      },
      icon('trash'),
    ),
  );
  root.append(main, noteBox, h('div', { class: 'hl-foot' }, meta, actions));
  return root;
}

async function focusHighlight(id: string): Promise<void> {
  try {
    const res = await send('highlight:focus', { id });
    if (res.note) toast(res.note, undefined, 6000);
  } catch (err) {
    toast(String((err as Error).message));
  }
}

async function remove(hl: Highlight, node: HTMLElement): Promise<void> {
  node.hidden = true;
  const removed = await send('highlight:delete', { id: hl.id });
  if (!removed) return;
  toast('Highlight deleted.', {
    label: 'Undo',
    run: () =>
      void send('highlight:restore', { highlight: removed.highlight, source: removed.source }),
  });
}
