/**
 * The export dialog: scope (this page, whole library, chosen sources), format,
 * live preview, Copy and Download (Blob + <a download>, no downloads permission).
 */
import {
  buildGroups,
  exportFileName,
  FORMATS,
  runExport,
  sourceTitle,
  type ExportFormat,
} from '../export';
import type { Library, Settings } from '../types';
import { clear, h } from './dom';
import { copyText, downloadText, toast } from './feedback';
import { icon } from './icons';

export type ExportScope = 'page' | 'library' | 'choose';

export interface ExportDialogOptions {
  library: Library;
  settings: Settings;
  /** The source "This page" refers to; hidden when there is none. */
  currentSourceId?: string | null;
  scope?: ExportScope;
  format?: ExportFormat;
}

const PREVIEW_LINES = 400;

export function openExportDialog(opts: ExportDialogOptions): HTMLDialogElement {
  const appVersion = chrome.runtime.getManifest().version;
  const hasCurrent =
    !!opts.currentSourceId && opts.library.sources.some((s) => s.id === opts.currentSourceId);
  let scope: ExportScope = opts.scope ?? (hasCurrent ? 'page' : 'library');
  if (scope === 'page' && !hasCurrent) scope = 'library';
  let format: ExportFormat = opts.format ?? 'obsidian';
  const chosen = new Set<string>();
  let output = '';

  const dialog = h('dialog', { class: 'export-dialog', 'aria-labelledby': 'export-title' });
  const scopeRow = h('div', { class: 'scope', role: 'radiogroup', 'aria-label': 'What to export' });
  const formatList = h('div', { class: 'formats', role: 'radiogroup', 'aria-label': 'Format' });
  const picker = h('div', { class: 'source-picker', hidden: true });
  const preview = h('pre', {
    class: 'preview',
    tabindex: '0',
    'aria-label': 'Preview',
    'aria-live': 'polite',
  });
  const status = h('p', { class: 'export-status muted' });
  const copyBtn = h('button', { type: 'button', class: 'btn', text: 'Copy' });
  const downloadBtn = h('button', {
    type: 'button',
    class: 'btn primary',
    text: 'Download .md file',
  });

  const scopes: Array<[ExportScope, string]> = [
    ['page', 'This page'],
    ['library', 'Whole library'],
    ['choose', 'Choose sources'],
  ];

  function groups() {
    if (scope === 'page') return buildGroups(opts.library, [opts.currentSourceId!]);
    if (scope === 'choose') return buildGroups(opts.library, chosen);
    return buildGroups(opts.library);
  }

  function renderScope() {
    clear(scopeRow);
    for (const [id, label] of scopes) {
      if (id === 'page' && !hasCurrent) continue;
      scopeRow.append(
        h('button', {
          type: 'button',
          class: 'chip',
          role: 'radio',
          'aria-checked': String(scope === id),
          text: label,
          onClick: () => {
            scope = id;
            update();
          },
        }),
      );
    }
  }

  function renderFormats() {
    clear(formatList);
    for (const f of FORMATS) {
      formatList.append(
        h(
          'button',
          {
            type: 'button',
            class: 'format',
            role: 'radio',
            'aria-checked': String(format === f.id),
            onClick: () => {
              format = f.id;
              update();
            },
          },
          h('span', { class: 'format-name', text: f.name }),
          h('span', { class: 'format-desc', text: f.description }),
        ),
      );
    }
  }

  function renderPicker() {
    picker.hidden = scope !== 'choose';
    if (picker.hidden) return;
    clear(picker);
    const all = buildGroups(opts.library);
    if (!all.length) {
      picker.append(h('p', { class: 'muted', text: 'Your library is empty.' }));
      return;
    }
    for (const g of all) {
      const id = `src-${g.source.id}`;
      picker.append(
        h(
          'label',
          { class: 'pick', for: id },
          h('input', {
            type: 'checkbox',
            id,
            checked: chosen.has(g.source.id),
            onChange: (e: Event) => {
              if ((e.target as HTMLInputElement).checked) chosen.add(g.source.id);
              else chosen.delete(g.source.id);
              update();
            },
          }),
          h('span', { class: 'pick-title', text: sourceTitle(g.source) }),
          h('span', {
            class: 'pick-meta muted',
            text: `${g.source.kind === 'pdf' ? 'PDF' : 'Web'} · ${g.highlights.length}`,
          }),
        ),
      );
    }
  }

  function renderPreview() {
    clear(preview);
    const lines = output.replace(/^\uFEFF/, '').split('\n');
    const shown = lines.slice(0, PREVIEW_LINES);
    for (const line of shown) {
      const m = /^(> \[![\w-]+\]|>)(.*)$/.exec(line);
      if (m && (format === 'obsidian' || format === 'notion' || format === 'markdown')) {
        preview.append(h('span', { class: 'q', text: m[1] }), document.createTextNode(`${m[2]}\n`));
      } else {
        preview.append(document.createTextNode(`${line}\n`));
      }
    }
    if (lines.length > PREVIEW_LINES) {
      preview.append(
        h('span', {
          class: 'muted',
          text: `… ${lines.length - PREVIEW_LINES} more lines in the file`,
        }),
      );
    }
  }

  function update() {
    renderScope();
    renderFormats();
    renderPicker();
    const gs = groups();
    const count = gs.reduce((n, g) => n + g.highlights.length, 0);
    const info = FORMATS.find((f) => f.id === format)!;
    downloadBtn.textContent = `Download .${info.extension} file`;
    if (!gs.length) {
      output = '';
      clear(preview);
      preview.append(
        h('span', {
          class: 'muted',
          text: scope === 'choose' ? 'Choose at least one source.' : 'Nothing to export yet.',
        }),
      );
      status.textContent = '';
      copyBtn.disabled = downloadBtn.disabled = true;
      return;
    }
    output = runExport({
      format,
      groups: gs,
      library: opts.library,
      settings: opts.settings,
      appVersion,
    });
    status.textContent = `${count} highlight${count === 1 ? '' : 's'} from ${gs.length} source${gs.length === 1 ? '' : 's'}`;
    copyBtn.disabled = downloadBtn.disabled = false;
    renderPreview();
  }

  copyBtn.addEventListener('click', async () => {
    toast(
      (await copyText(output)) ? 'Copied to the clipboard.' : 'Copy failed. Use Download instead.',
      undefined,
      2200,
    );
  });
  downloadBtn.addEventListener('click', () => {
    const info = FORMATS.find((f) => f.id === format)!;
    downloadText(output, exportFileName(format, groups()), info.mime);
  });

  dialog.append(
    h(
      'div',
      { class: 'export-head' },
      h('h2', { id: 'export-title', text: 'Export highlights' }),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn',
          'aria-label': 'Close',
          title: 'Close',
          onClick: () => dialog.close(),
        },
        icon('close', 18),
      ),
    ),
    scopeRow,
    h(
      'div',
      { class: 'export-body' },
      formatList,
      h('div', { class: 'export-right' }, picker, preview),
    ),
    h('div', { class: 'export-foot' }, status, copyBtn, downloadBtn),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  update();
  dialog.showModal();
  return dialog;
}
