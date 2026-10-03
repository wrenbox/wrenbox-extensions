/**
 * Web highlighting engine: anchors stored highlights in the live page, renders
 * them with the CSS Custom Highlight API (no DOM changes), keeps them attached
 * on dynamic pages, and turns selections into new highlights.
 *
 * Persistence is delegated to a PageStore: the real content script talks to
 * the service worker; the onboarding demo keeps everything in memory.
 */
import { anchor, describe } from '../shared/anchoring/anchor';
import {
  buildTextIndex,
  offsetsFromRange,
  rangeFromOffsets,
  type TextIndex,
} from '../shared/anchoring/text-index';
import { colorLabel } from '../shared/colors';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { collapseWhitespace } from '../shared/text';
import {
  COLORS,
  positionSelector,
  quoteSelector,
  type Color,
  type Highlight as HighlightRec,
  type HighlightInput,
  type HighlightPatch,
  type Settings,
  type Source,
  type SourceInput,
} from '../shared/types';
import { normalizeUrl } from '../shared/url';
import { PageUi } from './ui';

export interface PageStore {
  load(page: SourceInput): Promise<HighlightRec[]>;
  create(page: SourceInput, input: HighlightInput): Promise<HighlightRec>;
  update(id: string, patch: HighlightPatch): Promise<HighlightRec | null>;
  remove(id: string): Promise<{ highlight: HighlightRec; source: Source | null } | null>;
  restore(highlight: HighlightRec, source: Source | null): Promise<HighlightRec>;
  reportStatus(updates: Array<{ id: string; orphaned: boolean }>): void;
  /** Called when the page (URL) changes so the store can re-register it. */
  pageChanged?(page: SourceInput): Promise<string | null>;
}

interface Entry {
  h: HighlightRec;
  range: Range | null;
}

const MUTATION_DEBOUNCE = 500;
const URL_POLL = 1000;
const RETRY_WINDOW = 30_000;
const ORPHAN_REPORT_DELAY = 5000;
const SLICE_MS = 8;
const FOCUS_NAME = 'bowerline-focus';
const name = (c: Color) => `bowerline-${c}`;

const yieldToPage = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export function pageInfo(): SourceInput {
  return {
    kind: 'web',
    key: normalizeUrl(location.href),
    url: location.href,
    title: (document.title || location.hostname).trim().slice(0, 300),
  };
}

function pointInRange(range: Range, node: Node, offset: number): boolean {
  try {
    return range.isPointInRange(node, offset);
  } catch {
    return false; // node in another document or a doctype
  }
}

function isEditable(node: Node | null): boolean {
  const el = node && (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement);
  return !!el?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}

export interface EngineOptions {
  store: PageStore;
  settings: Settings;
  /** Root whose text is highlightable (document.body on web pages). */
  root?: () => Element | null;
  page?: () => SourceInput;
  /** Watch URL changes (single-page apps). Off for the onboarding demo. */
  watchUrl?: boolean;
}

export class Engine {
  readonly ui: PageUi;
  private entries = new Map<string, Entry>();
  private index: TextIndex | null = null;
  private registry = new Map<Color, Highlight>();
  private page: SourceInput;
  private settings: Settings;
  private retryUntil = 0;
  private reported = new Map<string, boolean>();
  private mutationTimer = 0;
  private orphanTimer = 0;
  private lastHref = location.href;
  private mouseDown = false;
  private selectTimer = 0;
  private pendingRange: Range | null = null;
  private observer: MutationObserver | null = null;
  private loading: Promise<void> | null = null;
  private loadSeq = 0;

  constructor(private opts: EngineOptions) {
    this.settings = opts.settings ?? DEFAULT_SETTINGS;
    this.page = (opts.page ?? pageInfo)();
    this.ui = new PageUi(() => this.settings.labels);
    for (const c of COLORS) {
      const hl = new Highlight();
      this.registry.set(c, hl);
    }
  }

  private get root(): Element | null {
    return this.opts.root ? this.opts.root() : document.body;
  }

  get pageKey(): string {
    return this.page.key;
  }

  get counts(): { count: number; orphans: number } {
    let orphans = 0;
    for (const e of this.entries.values()) if (!e.range) orphans++;
    return { count: this.entries.size, orphans };
  }

  setSettings(s: Settings): void {
    this.settings = s;
    if (!s.showToolbar && this.ui.shownToolbar === 'select') this.ui.hideToolbar();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): Promise<void> {
    this.ensureRegistered();
    this.listen();
    this.observer = new MutationObserver((records) => {
      if (records.every((r) => r.target === this.ui.host || this.ui.host.contains(r.target)))
        return;
      this.index = null;
      window.clearTimeout(this.mutationTimer);
      this.mutationTimer = window.setTimeout(() => void this.reconcile(), MUTATION_DEBOUNCE);
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    if (this.opts.watchUrl !== false) {
      window.setInterval(() => this.checkUrl(), URL_POLL);
      window.addEventListener('popstate', () => this.checkUrl());
    }
    return this.load();
  }

  /** Ensures our named highlights are registered (a page could clear the registry). */
  private ensureRegistered(): void {
    for (const [c, hl] of this.registry) {
      if (CSS.highlights.get(name(c)) !== hl) CSS.highlights.set(name(c), hl);
    }
  }

  /** (Re)loads this page's highlights from the store and anchors them. */
  load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading = (async () => {
      const list = await this.opts.store.load(this.page);
      if (seq !== this.loadSeq) return;
      const previous = this.entries;
      this.entries = new Map();
      for (const h of list) {
        const old = previous.get(h.id);
        // Keep live ranges for highlights we already placed; only text matters.
        const keep = old && old.range && quoteSelector(old.h)?.exact === quoteSelector(h)?.exact;
        this.entries.set(h.id, { h, range: keep ? old.range : null });
      }
      this.retryUntil = Date.now() + RETRY_WINDOW;
      await this.anchorPending();
      this.scheduleOrphanReport();
      // Text selected before Bowerline started still gets the toolbar.
      if (!this.ui.toolbarVisible) this.onSelectionSettled();
    })();
    return this.loading;
  }

  whenLoaded(): Promise<void> {
    return this.loading ?? Promise.resolve();
  }

  private getIndex(): TextIndex | null {
    const root = this.root;
    if (!root) return null;
    if (!this.index || this.index.root !== root) {
      this.index = buildTextIndex(root, (el) => el === this.ui.host);
    }
    return this.index;
  }

  private anchorOne(e: Entry, index: TextIndex): void {
    const quote = quoteSelector(e.h);
    if (!quote) return;
    const found = anchor(index.text, quote, positionSelector(e.h));
    e.range = found ? rangeFromOffsets(index, found.start, found.end) : null;
  }

  /** Anchors every unplaced highlight, yielding to the page so no task runs long. */
  private async anchorPending(): Promise<void> {
    const pending = [...this.entries.values()].filter((e) => !e.range);
    if (pending.length) {
      let index = this.getIndex();
      let sliceStart = performance.now();
      for (const e of pending) {
        if (!index) break;
        this.anchorOne(e, index);
        if (performance.now() - sliceStart > SLICE_MS) {
          await yieldToPage();
          sliceStart = performance.now();
          // The page may have changed while we yielded.
          if (!this.index) index = this.getIndex();
        }
      }
    }
    this.render();
  }

  private isBroken(range: Range): boolean {
    return range.collapsed || !range.startContainer.isConnected || !range.endContainer.isConnected;
  }

  /** After DOM changes: re-anchor broken ranges, and retry orphans within the retry window. */
  private async reconcile(): Promise<void> {
    let needs = false;
    for (const e of this.entries.values()) {
      if (e.range && this.isBroken(e.range)) {
        e.range = null;
        needs = true;
      }
    }
    const retrying = Date.now() < this.retryUntil;
    if (retrying && this.counts.orphans > 0) needs = true;
    if (needs) {
      const before = this.counts.orphans;
      await this.anchorPending();
      if (this.counts.orphans < before) this.reportFound();
    } else {
      this.ensureRegistered();
      this.ui.scheduleReposition();
    }
  }

  private scheduleOrphanReport(): void {
    window.clearTimeout(this.orphanTimer);
    this.reportFound();
    this.orphanTimer = window.setTimeout(() => this.reportOrphans(), ORPHAN_REPORT_DELAY);
    window.setTimeout(() => this.reportOrphans(), RETRY_WINDOW + 100);
  }

  /** Highlights stored as orphaned that we found again. */
  private reportFound(): void {
    const updates: Array<{ id: string; orphaned: boolean }> = [];
    for (const e of this.entries.values()) {
      if (e.range && (e.h.orphaned || this.reported.get(e.h.id) === true)) {
        updates.push({ id: e.h.id, orphaned: false });
        e.h.orphaned = false;
        this.reported.set(e.h.id, false);
      }
    }
    if (updates.length) this.opts.store.reportStatus(updates);
  }

  /** Highlights still missing: mark them orphaned (never delete them). */
  private reportOrphans(): void {
    const updates: Array<{ id: string; orphaned: boolean }> = [];
    for (const e of this.entries.values()) {
      if (!e.range && !e.h.orphaned) {
        updates.push({ id: e.h.id, orphaned: true });
        e.h.orphaned = true;
        this.reported.set(e.h.id, true);
      }
    }
    if (updates.length) this.opts.store.reportStatus(updates);
  }

  private checkUrl(): void {
    if (location.href === this.lastHref) return;
    this.lastHref = location.href;
    const next = (this.opts.page ?? pageInfo)();
    if (next.key === this.page.key) return;
    this.page = next;
    this.ui.hideToolbar();
    this.ui.closeNoteEditor();
    this.entries.clear();
    this.render();
    void (async () => {
      const focus = (await this.opts.store.pageChanged?.(this.page)) ?? null;
      await this.load();
      if (focus) this.focus(focus);
    })();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    this.ensureRegistered();
    for (const hl of this.registry.values()) hl.clear();
    for (const e of this.entries.values()) if (e.range) this.registry.get(e.h.color)?.add(e.range);
    this.ui.setMarkers(
      [...this.entries.values()]
        .filter((e) => e.range && e.h.note.trim())
        .map((e) => ({
          id: e.h.id,
          color: e.h.color,
          note: e.h.note,
          rect: () => {
            if (!e.range) return null;
            const rects = e.range.getClientRects();
            return rects.length ? rects[rects.length - 1]! : null;
          },
        })),
      (id) => this.editNote(id),
    );
  }

  focus(id: string): boolean {
    const e = this.entries.get(id);
    if (!e?.range) return false;
    const target = e.range.startContainer.parentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const flash = new Highlight(e.range);
    flash.priority = 10;
    CSS.highlights.set(FOCUS_NAME, flash);
    window.setTimeout(() => {
      if (CSS.highlights.get(FOCUS_NAME) === flash) CSS.highlights.delete(FOCUS_NAME);
    }, 1800);
    return true;
  }

  // ── Creating and editing ───────────────────────────────────────────────────

  /** Creates a highlight from a range (or the current selection). */
  async createFrom(
    range: Range | null,
    color: Color,
    opts: { note?: boolean } = {},
  ): Promise<HighlightRec | null> {
    const r = range ?? this.selectionRange();
    if (!r) return null;
    const index = this.getIndex();
    if (!index) return null;
    const offsets = offsetsFromRange(index, r);
    if (!offsets) return null;
    const { quote, position } = describe(index.text, offsets.start, offsets.end);
    const text = collapseWhitespace(r.toString()) || quote.exact;
    this.ui.hideToolbar();
    window.getSelection()?.removeAllRanges();
    this.page = { ...this.page, title: (document.title || this.page.title).trim().slice(0, 300) };
    const h = await this.opts.store.create(this.page, {
      color,
      text,
      selectors: [quote, position],
    });
    this.entries.set(h.id, { h, range: rangeFromOffsets(index, offsets.start, offsets.end) });
    this.render();
    if (opts.note) this.editNote(h.id);
    return h;
  }

  private selectionRange(): Range | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const root = this.root;
    if (!root || !root.contains(range.commonAncestorContainer)) return null;
    if (isEditable(range.startContainer) || isEditable(range.endContainer)) return null;
    if (!range.toString().trim()) return null;
    return range.cloneRange();
  }

  async highlightSelection(): Promise<boolean> {
    return !!(await this.createFrom(null, this.settings.defaultColor));
  }

  private async update(id: string, patch: HighlightPatch): Promise<void> {
    const e = this.entries.get(id);
    if (!e) return;
    Object.assign(e.h, patch);
    this.render();
    const saved = await this.opts.store.update(id, patch);
    if (saved) e.h = saved;
  }

  editNote(id: string): void {
    const e = this.entries.get(id);
    if (!e?.range) return;
    const range = e.range;
    this.ui.openNoteEditor(
      () => range.getBoundingClientRect(),
      e.h.color,
      e.h.note,
      (text) => {
        if (text !== e.h.note) void this.update(id, { note: text });
      },
    );
  }

  private async remove(id: string): Promise<void> {
    const e = this.entries.get(id);
    if (!e) return;
    this.entries.delete(id);
    this.ui.hideToolbar();
    this.render();
    const removed = await this.opts.store.remove(id);
    if (!removed) return;
    this.ui.toast('Highlight deleted.', {
      label: 'Undo',
      run: () => {
        void this.opts.store.restore(removed.highlight, removed.source).then((h) => {
          this.entries.set(h.id, { h, range: e.range });
          this.render();
        });
      },
    });
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Insecure pages have no async clipboard; fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      this.ui.host.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    this.ui.toast('Copied to the clipboard.', undefined, 1800);
  }

  // ── Hit testing ────────────────────────────────────────────────────────────

  hitTest(x: number, y: number): Entry | null {
    const pos = document.caretPositionFromPoint?.(x, y);
    const node = pos?.offsetNode;
    if (!node) return null;
    let best: Entry | null = null;
    for (const e of this.entries.values()) {
      const r = e.range;
      if (!r) continue;
      if (!pointInRange(r, node, pos.offset)) continue;
      // The caret snaps to the nearest text; confirm the click was on the text itself.
      const onText = [...r.getClientRects()].some(
        (c) => x >= c.left - 1 && x <= c.right + 1 && y >= c.top - 1 && y <= c.bottom + 1,
      );
      if (!onText) continue;
      if (!best || e.h.createdAt > best.h.createdAt) best = e;
    }
    return best;
  }

  // ── Event wiring ───────────────────────────────────────────────────────────

  private listen(): void {
    document.addEventListener(
      'mousedown',
      (ev) => {
        if (this.ui.owns(ev.target)) return;
        this.mouseDown = true;
        this.ui.hideToolbar();
      },
      true,
    );
    document.addEventListener(
      'mouseup',
      (ev) => {
        this.mouseDown = false;
        if (this.ui.owns(ev.target)) return;
        window.setTimeout(() => this.onSelectionSettled(), 10);
      },
      true,
    );
    document.addEventListener('selectionchange', () => {
      if (this.mouseDown) return;
      window.clearTimeout(this.selectTimer);
      this.selectTimer = window.setTimeout(() => this.onSelectionSettled(), 250);
    });
    document.addEventListener(
      'click',
      (ev) => {
        if (this.ui.owns(ev.target) || ev.button !== 0) return;
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        const hit = this.hitTest(ev.clientX, ev.clientY);
        if (hit) this.showEditToolbar(hit);
      },
      true,
    );
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && this.ui.toolbarVisible) this.ui.hideToolbar();
    });
  }

  private onSelectionSettled(): void {
    if (this.ui.editing) return;
    const range = this.selectionRange();
    if (!range) {
      this.pendingRange = null;
      // Only dismiss the selection toolbar; an edit toolbar opened by a click stays.
      if (this.ui.shownToolbar === 'select') this.ui.hideToolbar();
      return;
    }
    this.pendingRange = range;
    if (!this.settings.showToolbar) return;
    this.ui.showToolbar('select', () => range.getBoundingClientRect(), null, false, {
      color: (c) => void this.createFrom(range, c),
      note: () => void this.createFrom(range, this.settings.defaultColor, { note: true }),
      copy: () => {
        void this.copy(collapseWhitespace(range.toString()));
        this.ui.hideToolbar();
      },
    });
  }

  private showEditToolbar(e: Entry): void {
    const range = e.range;
    if (!range) return;
    const id = e.h.id;
    this.ui.showToolbar('edit', () => range.getBoundingClientRect(), e.h.color, !!e.h.note.trim(), {
      color: (c) => {
        void this.update(id, { color: c });
        this.ui.hideToolbar();
      },
      note: () => this.editNote(id),
      copy: () => {
        void this.copy(e.h.text);
        this.ui.hideToolbar();
      },
      remove: () => void this.remove(id),
    });
  }

  /** A one-line status for the activation toast. */
  statusLine(): string {
    const { count, orphans } = this.counts;
    if (count === 0) return 'Bowerline is on. Select text to highlight it.';
    const shown = count - orphans;
    const label = `${shown} highlight${shown === 1 ? '' : 's'} restored`;
    return orphans ? `${label}. ${orphans} not found yet: see the side panel.` : `${label}.`;
  }

  labelFor(c: Color): string {
    return colorLabel(c, this.settings.labels);
  }
}
