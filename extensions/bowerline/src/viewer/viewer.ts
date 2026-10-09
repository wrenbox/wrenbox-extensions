/**
 * Bowerline PDF viewer, built on pdf.js. Highlights are keyed by the PDF's
 * fingerprint, so the same file shows the same highlights wherever it is
 * opened from, and drawn as overlay rectangles that follow every zoom level.
 */
import './polyfills';
import * as pdfjsLib from 'pdfjs-dist';
import { EventBus, LinkTarget, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import { describe } from '../shared/anchoring/anchor';
import { buildTextIndex, offsetsFromRange } from '../shared/anchoring/text-index';
import { COLOR_INFO, colorLabel } from '../shared/colors';
import { isBroadcast, send } from '../shared/messages';
import { getSettings, onSettingsChanged, saveSettings } from '../shared/settings';
import { collapseWhitespace } from '../shared/text';
import {
  COLORS,
  type Color,
  type Highlight,
  type PdfRect,
  type Settings,
  type Source,
  type SourceInput,
} from '../shared/types';
import { fileNameFromUrl } from '../shared/url';
import { PageUi } from '../content/ui';
import { logoMark } from '../shared/ui/brand';
import { $, clear, h } from '../shared/ui/dom';
import { openExportDialog } from '../shared/ui/export-dialog';
import { copyText } from '../shared/ui/feedback';
import { icon } from '../shared/ui/icons';
import { browserName } from '../shared/browser';
import { initTheme } from '../shared/ui/theme';
import { bounds, containsPoint, mergeRects, stackCards } from './geometry';
import {
  hasOriginAccess,
  loadPdf,
  lockConnections,
  originPattern,
  PdfLoadError,
  type LoadFailure,
} from './pdf-loader';

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
type PageView = {
  div: HTMLDivElement;
  viewport: { scale: number; width: number; height: number };
  id: number;
};

const RESOURCE = (p: string) => chrome.runtime.getURL(`viewer/pdfjs/${p}`);
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdf.worker.mjs');

const params = new URLSearchParams(location.search);
const container = $<HTMLDivElement>('#viewerContainer');
const viewerEl = $<HTMLDivElement>('#viewer');
const thumbs = $('#thumbs');
const openPanel = $('#open-panel');
const openCard = $('#open-card');

const eventBus = new EventBus();
const linkService = new PDFLinkService({
  eventBus,
  externalLinkTarget: LinkTarget.BLANK,
  externalLinkRel: 'noopener noreferrer nofollow',
});
const viewer = new PDFViewer({
  container,
  viewer: viewerEl,
  eventBus,
  linkService,
  removePageBorders: true,
});
linkService.setViewer(viewer);

let settings: Settings;
let activeColor: Color = 'yellow';
let pdfDoc: PDFDocumentProxy | null = null;
let page: SourceInput | null = null;
let source: Source | null = null;
let highlights: Highlight[] = [];
let myTabId: number | undefined;
let pendingFocus = params.get('focus');
let selected: Highlight | null = null;
const ui = new PageUi(() => settings.labels);

// ── Opening ──────────────────────────────────────────────────────────────────

function showPanel(...children: Array<Node | null | false>): void {
  clear(openCard);
  openCard.append(...children.filter((c): c is Node => !!c));
  openPanel.hidden = false;
}

function dropZone(): HTMLElement {
  const zone = h(
    'div',
    { class: 'drop' },
    h('p', { text: 'Drop a PDF here' }),
    h(
      'div',
      { class: 'open-actions' },
      h('button', {
        type: 'button',
        class: 'btn primary',
        text: 'Choose a PDF',
        onClick: () => $('#file-input').click(),
      }),
    ),
  );
  return zone;
}

function showOpen(): void {
  const expect = params.get('expect');
  showPanel(
    logoMark(48),
    h('h2', { text: 'Open a PDF' }),
    h('p', {
      text: 'Highlights are tied to the file itself, so they come back wherever you open it from: your computer, an email attachment or the web.',
    }),
    expect ? h('p', { class: 'expect', text: `To see your highlight, open “${expect}”.` }) : null,
    dropZone(),
    h(
      'p',
      { class: 'small' },
      'New to Bowerline? ',
      h('a', { href: '?sample=1', text: 'Try the sample PDF' }),
      '.',
    ),
  );
}

function showLoading(label: string): void {
  showPanel(
    h('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Loading' }),
    h('p', { text: label }),
  );
}

function explain(f: LoadFailure, url: string): string {
  switch (f.kind) {
    case 'blocked':
      return "The website that hosts this PDF doesn't let other apps read it directly.";
    case 'file-access':
      return `${browserName()} only lets extensions read files on your computer when you allow it. You can choose the file below instead.`;
    case 'http':
      return f.status === 404
        ? 'The server says this PDF no longer exists (error 404).'
        : `The server refused the request (error ${f.status}). You may need to sign in to the site first.`;
    case 'not-pdf':
      return `The link to ${new URL(url).hostname} returned a web page, not a PDF. You may need to sign in first.`;
    case 'too-large':
      return 'This PDF is too large to pass through the tab. Download it, then open the file here.';
  }
}

async function showLoadError(err: unknown, url: string): Promise<void> {
  const failure: LoadFailure = err instanceof PdfLoadError ? err.failure : { kind: 'blocked' };
  const pattern = originPattern(url);
  const canAsk = failure.kind === 'blocked' && pattern && !(await hasOriginAccess(url));
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'this site';
    }
  })();
  showPanel(
    logoMark(48),
    h('h2', { class: 'error-title', text: "Bowerline couldn't open this PDF" }),
    h('p', { text: explain(failure, url) }),
    canAsk
      ? h(
          'div',
          { class: 'open-actions' },
          h('button', {
            type: 'button',
            class: 'btn primary',
            text: 'Allow Bowerline to open this PDF',
            onClick: async () => {
              // The click is the user gesture Chrome needs; only this PDF's site is requested.
              const granted = await chrome.permissions.request({ origins: [pattern!] });
              if (granted) void openUrl(url);
            },
          }),
        )
      : null,
    canAsk
      ? h('p', {
          class: 'small',
          text: `${browserName()} will ask to let Bowerline read ${host}. It's used only to open PDFs from there.`,
        })
      : null,
    h(
      'p',
      { class: 'small' },
      /^https?:/.test(url)
        ? h('a', {
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
            text: 'Download the PDF',
          })
        : 'Download the PDF',
      ', then open the file here.',
    ),
    dropZone(),
  );
}

async function openUrl(url: string): Promise<void> {
  showLoading('Opening the PDF…');
  const tab = params.get('tab');
  try {
    const bytes = await loadPdf(url, tab ? Number(tab) : undefined);
    await openBytes(bytes, { url, fileName: fileNameFromUrl(url) });
  } catch (err) {
    console.warn('Bowerline: could not load PDF', err);
    await showLoadError(err, url);
  }
}

async function openFile(file: File): Promise<void> {
  showLoading(`Opening ${file.name}…`);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await openBytes(bytes, { url: '', fileName: file.name });
  } catch (err) {
    console.warn('Bowerline: could not open file', err);
    showPanel(
      logoMark(48),
      h('h2', { class: 'error-title', text: "That file couldn't be opened" }),
      h('p', { text: "It doesn't look like a valid PDF, or it is damaged." }),
      dropZone(),
    );
  }
}

function askPassword(retry: boolean): Promise<string | null> {
  const dialog = $<HTMLDialogElement>('#password-dialog');
  const input = $<HTMLInputElement>('#password-input');
  $('#password-msg').textContent = retry
    ? "That password didn't work. Try again."
    : 'Enter its password to open it. The password stays on this computer.';
  input.value = '';
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => resolve(dialog.returnValue === 'ok' ? input.value : null),
      { once: true },
    );
    dialog.showModal();
    input.focus();
  });
}

async function openBytes(
  bytes: Uint8Array,
  meta: { url: string; fileName: string },
): Promise<void> {
  if (pdfDoc) {
    await pdfDoc.loadingTask.destroy();
    pdfDoc = null;
  }
  const task = pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: RESOURCE('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: RESOURCE('standard_fonts/'),
    wasmUrl: RESOURCE('wasm/'),
    iccUrl: RESOURCE('iccs/'),
    enableXfa: false,
  });
  task.onPassword = async (update: (pw: string) => void, reason: number) => {
    const pw = await askPassword(reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD);
    if (pw === null) {
      void task.destroy();
      showOpen();
    } else update(pw);
  };
  const doc = await task.promise;
  pdfDoc = doc;
  // fingerprints[0] identifies the file's original content, wherever it lives.
  const fingerprint =
    doc.fingerprints[0] ?? doc.fingerprints[1] ?? `pdf-${meta.fileName}-${doc.numPages}`;
  const info = (await doc.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
  const title = (info?.Title || '').trim() || meta.fileName;
  page = { kind: 'pdf', key: fingerprint, url: meta.url, title, fileName: meta.fileName };
  document.title = meta.fileName;
  $('#file-name').textContent = meta.fileName;
  $('#file-name').title = title;
  // Show the page rail before layout so "Fit" measures the final width.
  thumbs.hidden = false;
  viewer.setDocument(doc);
  linkService.setDocument(doc, null);
  openPanel.hidden = true;
  $('#pager').hidden = false;
  $('#zoom-box').hidden = false;
  $('#page-count').textContent = String(doc.numPages);
  $<HTMLInputElement>('#page-input').max = String(doc.numPages);
  ($('#export') as HTMLButtonElement).disabled = false;
  const current = page;
  await send('tab:register', { page: current });
  await loadHighlights();
  void send('source:touch', { source: current });
  buildThumbs(doc);
  container.focus();
}

// ── Highlights: loading and drawing ─────────────────────────────────────────

async function loadHighlights(): Promise<void> {
  if (!page) return;
  const res = await send('source:get', { key: page.key });
  source = res.source;
  highlights = res.highlights.filter((x) => x.pdf);
  renderAll();
  updateThumbDots();
  highlightsReady = true;
  maybeFocusPending();
}

function pageView(n: number): PageView | null {
  return (viewer.getPageView(n - 1) as PageView | undefined) ?? null;
}

function renderAll(): void {
  if (!pdfDoc) return;
  for (let n = 1; n <= pdfDoc.numPages; n++) renderPage(n);
}

function renderPage(n: number): void {
  const view = pageView(n);
  if (!view?.div) return;
  const scale = view.viewport.scale;
  view.div.querySelector('.bl-layer')?.remove();
  view.div.querySelector('.bl-notes')?.remove();
  const onPage = highlights.filter((x) => x.pdf?.page === n);
  if (!onPage.length) return;
  const layer = h('div', { class: 'bl-layer', 'aria-hidden': 'true' });
  for (const hl of onPage) {
    for (const r of hl.pdf!.rects) {
      layer.append(
        h('div', {
          class: `bl-hl${selected?.id === hl.id ? ' flash' : ''}`,
          dataset: { color: hl.color, id: hl.id },
          style: {
            left: `${r.x * scale}px`,
            top: `${r.y * scale}px`,
            width: `${r.w * scale}px`,
            height: `${r.h * scale}px`,
          },
        }),
      );
    }
    const last = hl.pdf!.rects[hl.pdf!.rects.length - 1];
    if (hl.note.trim() && last) {
      layer.append(
        h('div', {
          class: 'bl-mark',
          style: {
            // A footnote-style mark just above the end of the line.
            left: `${(last.x + last.w) * scale - 4}px`,
            top: `${last.y * scale - 7}px`,
            background: COLOR_INFO[hl.color].solid,
          },
        }),
      );
    }
  }
  // Below the transparent text layer, so selection keeps working on top.
  const canvasWrapper = view.div.querySelector('.canvasWrapper');
  if (canvasWrapper) canvasWrapper.after(layer);
  else view.div.prepend(layer);

  const noted = onPage.filter((x) => x.note.trim());
  if (!noted.length) return;
  const notes = h('div', { class: 'bl-notes' });
  const cards = noted.map((hl) =>
    h(
      'button',
      {
        type: 'button',
        class: 'note-card',
        style: { '--bar': COLOR_INFO[hl.color].solid },
        'aria-label': `Note on page ${n}: ${hl.note}. Edit note.`,
        onClick: () => editNote(hl),
      },
      h('span', { class: 'note-label', text: `Note on page ${n}` }),
      h('span', { class: 'note-text', text: hl.note }),
    ),
  );
  notes.append(...cards);
  view.div.append(notes);
  const wanted = noted.map((hl) => (bounds(hl.pdf!.rects)?.y ?? 0) * scale - 8);
  const tops = stackCards(
    wanted,
    cards.map((c) => c.offsetHeight),
  );
  cards.forEach((c, i) => (c.style.top = `${Math.max(0, tops[i]!)}px`));
}

eventBus.on('pagerendered', ({ pageNumber }: { pageNumber: number }) => renderPage(pageNumber));
eventBus.on('textlayerrendered', ({ pageNumber }: { pageNumber: number }) =>
  renderPage(pageNumber),
);
eventBus.on('scalechanging', () => requestAnimationFrame(renderAll));
let pagesReady = false;
let highlightsReady = false;

/** Scrolls to the highlight named in ?focus= once both the pages and the highlights are in. */
function maybeFocusPending(): void {
  if (!pendingFocus || !pagesReady || !highlightsReady) return;
  const id = pendingFocus;
  pendingFocus = null;
  window.setTimeout(() => focusHighlight(id), 150);
}

eventBus.on('pagesinit', () => {
  viewer.currentScaleValue = String(defaultScale());
  syncZoom();
  pagesReady = true;
  maybeFocusPending();
});
eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
  $<HTMLInputElement>('#page-input').value = String(pageNumber);
  for (const t of thumbs.querySelectorAll<HTMLElement>('.thumb')) {
    if (Number(t.dataset.page) === pageNumber) {
      t.setAttribute('aria-current', 'page');
      t.scrollIntoView({ block: 'nearest' });
    } else t.removeAttribute('aria-current');
  }
});
eventBus.on('scalechanging', syncZoom);

function focusHighlight(id: string): void {
  const hl = highlights.find((x) => x.id === id);
  if (!hl?.pdf) return;
  const r = bounds(hl.pdf.rects);
  const view = pageView(hl.pdf.page);
  if (view && r)
    container.scrollTop =
      view.div.offsetTop + r.y * view.viewport.scale - container.clientHeight / 3;
  else viewer.currentPageNumber = hl.pdf.page;
  selected = hl;
  renderPage(hl.pdf.page);
  window.setTimeout(() => {
    if (selected?.id === id) {
      selected = null;
      renderPage(hl.pdf!.page);
    }
  }, 1600);
}

// ── Creating highlights from the selection ──────────────────────────────────

interface Piece {
  page: number;
  text: string;
  rects: PdfRect[];
  quote: ReturnType<typeof describe>;
}

function selectionPieces(): Piece[] {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !pdfDoc) return [];
  const range = sel.getRangeAt(0);
  const pieces: Piece[] = [];
  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const view = pageView(n);
    const textLayer = view?.div.querySelector<HTMLElement>('.textLayer');
    if (!view || !textLayer || !range.intersectsNode(textLayer)) continue;
    const sub = range.cloneRange();
    if (range.comparePoint(textLayer, 0) > 0) sub.setStart(textLayer, 0);
    const end = document.createRange();
    end.selectNodeContents(textLayer);
    if (sub.compareBoundaryPoints(Range.END_TO_END, end) > 0)
      sub.setEnd(textLayer, textLayer.childNodes.length);
    const text = collapseWhitespace(textOf(sub));
    if (!text) continue;
    const origin = textLayer.getBoundingClientRect();
    const scale = view.viewport.scale;
    const rects = mergeRects(
      [...sub.getClientRects()]
        .filter((r) => r.width > 0.5 && r.height > 0.5)
        .map((r) => ({
          x: (r.left - origin.left) / scale,
          y: (r.top - origin.top) / scale,
          w: r.width / scale,
          h: r.height / scale,
        })),
    );
    if (!rects.length) continue;
    const index = buildTextIndex(textLayer);
    const offsets = offsetsFromRange(index, sub);
    const quote = offsets
      ? describe(index.text, offsets.start, offsets.end)
      : describe(text, 0, text.length);
    pieces.push({ page: n, text, rects, quote });
  }
  return pieces;
}

/**
 * The selected text, with a space wherever the selection wraps onto a new line.
 * pdf.js puts each line in its own element, so Range.toString() would glue the
 * last word of one line to the first word of the next.
 */
function textOf(range: Range): string {
  const root = range.commonAncestorContainer;
  const walker = document.createTreeWalker(
    root.nodeType === Node.TEXT_NODE ? root.parentNode! : root,
    NodeFilter.SHOW_TEXT,
  );
  let out = '';
  let prevTop: number | null = null;
  let prevHeight = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!range.intersectsNode(n)) continue;
    const t = n as Text;
    const start = t === range.startContainer ? range.startOffset : 0;
    const end = t === range.endContainer ? range.endOffset : t.data.length;
    const piece = t.data.slice(start, end);
    if (!piece) continue;
    const rect = t.parentElement?.getBoundingClientRect();
    if (
      rect &&
      prevTop !== null &&
      rect.top - prevTop > prevHeight * 0.5 &&
      !/\s$/.test(out) &&
      !/^\s/.test(piece)
    ) {
      out += ' ';
    }
    out += piece;
    if (rect) {
      prevTop = rect.top;
      prevHeight = rect.height;
    }
  }
  return out;
}

async function highlightSelection(color: Color, withNote = false): Promise<void> {
  if (!page) return;
  const pieces = selectionPieces();
  if (!pieces.length) return;
  window.getSelection()?.removeAllRanges();
  ui.hideToolbar();
  let first: Highlight | null = null;
  for (const p of pieces) {
    const created = await send('highlight:create', {
      source: page,
      highlight: {
        color,
        text: p.text,
        selectors: [p.quote.quote, p.quote.position],
        pdf: { page: p.page, rects: p.rects },
      },
    });
    first ??= created;
    highlights.push(created);
    renderPage(p.page);
  }
  if (!source) source = (await send('source:get', { key: page.key })).source;
  updateThumbDots();
  if (withNote && first) editNote(first);
}

function clientRectFor(hl: Highlight): DOMRect | null {
  const view = hl.pdf && pageView(hl.pdf.page);
  const b = hl.pdf && bounds(hl.pdf.rects);
  const layer = view?.div.querySelector('.textLayer') ?? view?.div;
  if (!view || !b || !layer) return null;
  const o = layer.getBoundingClientRect();
  const s = view.viewport.scale;
  return new DOMRect(o.left + b.x * s, o.top + b.y * s, b.w * s, b.h * s);
}

function editNote(hl: Highlight): void {
  ui.openNoteEditor(
    () => clientRectFor(hl),
    hl.color,
    hl.note,
    async (text) => {
      if (text === hl.note) return;
      hl.note = text;
      renderAll();
      await send('highlight:update', { id: hl.id, patch: { note: text } });
    },
  );
}

function showEditToolbar(hl: Highlight): void {
  selected = hl;
  ui.showToolbar('edit', () => clientRectFor(hl), hl.color, !!hl.note.trim(), {
    color: async (c) => {
      hl.color = c;
      renderPage(hl.pdf!.page);
      updateThumbDots();
      ui.hideToolbar();
      await send('highlight:update', { id: hl.id, patch: { color: c } });
    },
    note: () => editNote(hl),
    copy: async () => {
      await copyText(hl.text);
      ui.hideToolbar();
      ui.toast('Copied to the clipboard.', undefined, 1800);
    },
    remove: async () => {
      highlights = highlights.filter((x) => x.id !== hl.id);
      ui.hideToolbar();
      renderAll();
      updateThumbDots();
      const removed = await send('highlight:delete', { id: hl.id });
      if (!removed) return;
      ui.toast('Highlight deleted.', {
        label: 'Undo',
        run: async () => {
          const back = await send('highlight:restore', {
            highlight: removed.highlight,
            source: removed.source,
          });
          highlights.push(back);
          renderAll();
          updateThumbDots();
        },
      });
    },
  });
}

function hitTest(ev: MouseEvent): Highlight | null {
  const pageDiv = (ev.target as Element | null)?.closest<HTMLElement>('.page');
  const n = Number(pageDiv?.dataset.pageNumber);
  const view = n ? pageView(n) : null;
  const layer = view?.div.querySelector('.textLayer') ?? view?.div;
  if (!view || !layer) return null;
  const o = layer.getBoundingClientRect();
  const x = (ev.clientX - o.left) / view.viewport.scale;
  const y = (ev.clientY - o.top) / view.viewport.scale;
  const hits = highlights.filter(
    (hl) => hl.pdf?.page === n && hl.pdf.rects.some((r) => containsPoint(r, x, y)),
  );
  return hits.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

function onSelectionSettled(): void {
  if (ui.editing) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!viewerEl.contains(range.commonAncestorContainer)) return;
  if (!settings.showToolbar) return;
  ui.showToolbar('select', () => range.getBoundingClientRect(), null, false, {
    color: (c) => void highlightSelection(c),
    note: () => void highlightSelection(activeColor, true),
    copy: async () => {
      await copyText(collapseWhitespace(textOf(range)));
      ui.hideToolbar();
      ui.toast('Copied to the clipboard.', undefined, 1800);
    },
  });
}

container.addEventListener('mousedown', () => ui.hideToolbar());
container.addEventListener('mouseup', () => window.setTimeout(onSelectionSettled, 10));
container.addEventListener('click', (ev) => {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return;
  if ((ev.target as Element).closest('.note-card, a')) return;
  const hit = hitTest(ev);
  if (hit) showEditToolbar(hit);
  else selected = null;
});
container.addEventListener('scroll', () => ui.scheduleReposition(), { passive: true });

// ── Thumbnails ───────────────────────────────────────────────────────────────

const THUMB_WIDTH = 86;
let thumbQueue: Promise<void> = Promise.resolve();

function buildThumbs(doc: PDFDocumentProxy): void {
  clear(thumbs);
  thumbs.hidden = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);
        const n = Number((e.target as HTMLElement).dataset.page);
        thumbQueue = thumbQueue
          .then(() => renderThumb(doc, n, e.target as HTMLElement))
          .catch(() => undefined);
      }
    },
    { root: thumbs, rootMargin: '200px' },
  );
  for (let n = 1; n <= doc.numPages; n++) {
    const canvas = h('canvas', {
      width: String(THUMB_WIDTH),
      height: String(Math.round(THUMB_WIDTH * 1.3)),
    });
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'thumb',
        dataset: { page: String(n) },
        'aria-label': `Page ${n}`,
        onClick: () => {
          viewer.currentPageNumber = n;
        },
      },
      h('span', { class: 'thumb-frame' }, canvas),
      h('span', { class: 'thumb-dots', 'aria-hidden': 'true' }),
      h('span', { text: String(n) }),
    );
    if (n === 1) btn.setAttribute('aria-current', 'page');
    thumbs.append(btn);
    observer.observe(btn);
  }
  updateThumbDots();
}

async function renderThumb(doc: PDFDocumentProxy, n: number, btn: HTMLElement): Promise<void> {
  if (doc !== pdfDoc) return;
  const p = await doc.getPage(n);
  const base = p.getViewport({ scale: 1 });
  const dpr = window.devicePixelRatio || 1;
  const vp = p.getViewport({ scale: (THUMB_WIDTH / base.width) * dpr });
  const canvas = btn.querySelector('canvas')!;
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await p.render({ canvas, viewport: vp }).promise;
}

function updateThumbDots(): void {
  for (const t of thumbs.querySelectorAll<HTMLElement>('.thumb')) {
    const n = Number(t.dataset.page);
    const colors = [...new Set(highlights.filter((x) => x.pdf?.page === n).map((x) => x.color))];
    const dots = t.querySelector('.thumb-dots')!;
    dots.replaceChildren(
      ...colors.map((c) => h('span', { style: { background: COLOR_INFO[c].solid } })),
    );
    t.setAttribute('aria-label', colors.length ? `Page ${n}, has highlights` : `Page ${n}`);
  }
}

// ── Zoom and paging ──────────────────────────────────────────────────────────

/** "Fit": the page width that leaves room for the note margin, capped at 125%. */
function defaultScale(): number {
  const first = pageView(1);
  if (!first) return 1;
  const unscaledWidth = first.viewport.width / viewer.currentScale;
  const room = container.clientWidth - 48 - (window.innerWidth >= 1100 ? 250 : 0);
  return Math.max(0.5, Math.min(1.25, Math.floor((room / unscaledWidth) * 100) / 100));
}

function syncZoom(): void {
  const select = $<HTMLSelectElement>('#zoom');
  const pct = Math.round(viewer.currentScale * 100);
  const match = [...select.options].find(
    (o) => o.value !== 'auto' && o.value !== 'custom' && Math.round(Number(o.value) * 100) === pct,
  );
  const custom = select.querySelector<HTMLOptionElement>('option[value="custom"]')!;
  if (match) {
    select.value = match.value;
    custom.hidden = true;
  } else {
    custom.hidden = false;
    custom.textContent = `${pct}%`;
    select.value = 'custom';
  }
}

function zoomBy(dir: 1 | -1): void {
  const steps = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const cur = viewer.currentScale;
  const next =
    dir > 0
      ? steps.find((s) => s > cur + 0.001)
      : [...steps].reverse().find((s) => s < cur - 0.001);
  if (next) viewer.currentScale = next;
}

$('#zoom-in').addEventListener('click', () => zoomBy(1));
$('#zoom-out').addEventListener('click', () => zoomBy(-1));
$<HTMLSelectElement>('#zoom').addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  if (v === 'auto') viewer.currentScale = defaultScale();
  else if (v !== 'custom') viewer.currentScale = Number(v);
});
$<HTMLInputElement>('#page-input').addEventListener('change', (e) => {
  const n = Number((e.target as HTMLInputElement).value);
  if (pdfDoc && n >= 1 && n <= pdfDoc.numPages) viewer.currentPageNumber = n;
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (!pdfDoc || e.defaultPrevented || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, dialog') || t === ui.host) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod) return; // leave browser shortcuts (Ctrl+F, Ctrl+P, Ctrl+zoom) alone
  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
      if (e.key === 'PageDown' && e.shiftKey) return;
      viewer.nextPage();
      e.preventDefault();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      viewer.previousPage();
      e.preventDefault();
      break;
    case '+':
    case '=':
      zoomBy(1);
      e.preventDefault();
      break;
    case '-':
    case '_':
      zoomBy(-1);
      e.preventDefault();
      break;
    case 'h':
    case 'H':
      void highlightSelection(activeColor);
      e.preventDefault();
      break;
    case 'n':
    case 'N':
      if (window.getSelection()?.isCollapsed && selected) editNote(selected);
      else void highlightSelection(activeColor, true);
      e.preventDefault();
      break;
    case 'Escape':
      ui.hideToolbar();
      break;
  }
});

// ── Top bar ──────────────────────────────────────────────────────────────────

function renderColours(): void {
  const wrap = $('#colours');
  wrap.replaceChildren(
    ...COLORS.map((c) =>
      h('button', {
        type: 'button',
        class: 'swatch',
        role: 'radio',
        dataset: { color: c },
        title: `${colorLabel(c, settings.labels)} (press H to highlight)`,
        'aria-label': colorLabel(c, settings.labels),
        'aria-checked': String(activeColor === c),
        tabindex: activeColor === c ? '0' : '-1',
        onClick: () => {
          activeColor = c;
          renderColours();
          if (window.getSelection()?.isCollapsed === false) void highlightSelection(c);
        },
      }),
    ),
  );
  wrap.onkeydown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = COLORS.indexOf(activeColor);
    activeColor = COLORS[(i + (e.key === 'ArrowRight' ? 1 : COLORS.length - 1)) % COLORS.length]!;
    renderColours();
    wrap.querySelector<HTMLElement>(`[data-color="${activeColor}"]`)?.focus();
  };
}

$('#export').addEventListener('click', async () => {
  const library = await send('library:get', {});
  openExportDialog({
    library,
    settings,
    currentSourceId: source?.id ?? null,
    scope: source ? 'page' : 'library',
  });
});
$('#open-file').append(icon('file', 18));
$('#open-file').addEventListener('click', () => $('#file-input').click());
$<HTMLInputElement>('#file-input').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void openFile(file);
  input.value = '';
});

// Drag and drop anywhere on the page.
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragDepth++;
  $('#drop-overlay').hidden = false;
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('#drop-overlay').hidden = true;
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop-overlay').hidden = true;
  const file = [...(e.dataTransfer?.files ?? [])].find(
    (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  );
  if (file) void openFile(file);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!isBroadcast(msg)) return;
  if (
    msg.type === 'broadcast:changed' &&
    (!msg.sourceIds.length || (source && msg.sourceIds.includes(source.id)) || !source)
  ) {
    void loadHighlights();
  }
  if (msg.type === 'broadcast:viewer-focus' && msg.tabId === myTabId)
    focusHighlight(msg.highlightId);
});

// ── Start ────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  await initTheme();
  settings = await getSettings();
  activeColor = settings.defaultColor;
  onSettingsChanged((s) => {
    settings = s;
    renderColours();
  });
  renderColours();
  myTabId = (await chrome.tabs.getCurrent())?.id;
  const src = params.get('src');
  if (params.get('sample') === '1') {
    lockConnections(null);
    await openUrl(chrome.runtime.getURL('sample/bowerline-sample.pdf'));
    return;
  }
  lockConnections(src);
  if (src) await openUrl(src);
  else showOpen();
}

void init();

// Default colour changes made here persist, so the toolbar and shortcut agree.
$('#colours').addEventListener('click', () => void saveSettings({ defaultColor: activeColor }));
