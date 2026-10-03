/**
 * Everything Bowerline draws on a web page lives in one closed Shadow DOM root
 * with constructed, scoped styles. Nothing is added to the page's own DOM tree
 * besides the single host element, and no page style can reach inside.
 */
import { COLOR_INFO, colorLabel } from '../shared/colors';
import { COLORS, type Color, type Settings } from '../shared/types';
import { UI_CSS } from './ui-css';

export interface ToolbarActions {
  color(c: Color): void;
  note(): void;
  copy(): void;
  remove?(): void;
}

export interface MarkerSpec {
  id: string;
  color: Color;
  note: string;
  rect(): DOMRect | null;
}

type RectSource = () => DOMRect | null;

const GAP = 10;
const MARGIN = 8;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Built with DOM calls rather than innerHTML so pages enforcing Trusted Types are unaffected. */
function noteIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute(
    'd',
    'M3 2h10a1 1 0 0 1 1 1v7.6L10.6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 11.2L13.2 10H10v3.2Z',
  );
  svg.append(path);
  return svg;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export class PageUi {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private toolbar: HTMLElement | null = null;
  private toolbarKind: 'select' | 'edit' | null = null;
  private toolbarAnchor: RectSource | null = null;
  private editor: HTMLElement | null = null;
  private editorAnchor: RectSource | null = null;
  private markerLayer: HTMLElement;
  private markers: Array<{ spec: MarkerSpec; node: HTMLButtonElement }> = [];
  private card: HTMLElement | null = null;
  private toastNode: HTMLElement | null = null;
  private toastTimer = 0;
  private frame = 0;
  private onMarkerClick: (id: string) => void = () => undefined;

  constructor(private labels: () => Settings['labels']) {
    this.host = document.createElement('bowerline-ui');
    // Inline !important beats any page rule targeting the host element.
    this.host.style.cssText =
      'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;display:block!important;contain:layout style!important;';
    this.root = this.host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(UI_CSS);
    this.root.adoptedStyleSheets = [sheet];
    this.markerLayer = el('div', { class: 'markers' });
    this.root.append(this.markerLayer);
    document.documentElement.append(this.host);
    const schedule = () => this.scheduleReposition();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }

  /** Some pages rebuild <html>'s children; put the host back if it was removed. */
  private attach(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
  }

  /** True if an event target is Bowerline's own UI (events from the shadow root retarget to the host). */
  owns(target: EventTarget | null): boolean {
    return target === this.host;
  }

  /** Which toolbar is showing: for a new selection, or for editing a highlight. */
  get shownToolbar(): 'select' | 'edit' | null {
    return this.toolbarKind;
  }

  get toolbarVisible(): boolean {
    return !!this.toolbar;
  }

  get editing(): boolean {
    return !!this.editor;
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────

  showToolbar(
    kind: 'select' | 'edit',
    anchor: RectSource,
    current: Color | null,
    hasNote: boolean,
    actions: ToolbarActions,
  ): void {
    this.attach();
    this.hideToolbar();
    const labels = this.labels();
    const bar = el('div', {
      class: 'toolbar',
      role: 'toolbar',
      'aria-label':
        kind === 'select' ? 'Bowerline: highlight selection' : 'Bowerline: edit highlight',
    });
    // Keep the page selection alive while the toolbar is clicked.
    bar.addEventListener('mousedown', (e) => e.preventDefault());
    for (const c of COLORS) {
      const label = colorLabel(c, labels);
      const b = el('button', {
        class: 'swatch',
        type: 'button',
        title: label,
        'aria-label': kind === 'select' ? `Highlight ${label}` : `Change colour to ${label}`,
        'aria-pressed': String(c === current),
      });
      b.style.background = COLOR_INFO[c].solid;
      b.addEventListener('click', () => actions.color(c));
      bar.append(b);
    }
    bar.append(el('span', { class: 'sep', 'aria-hidden': 'true' }));
    const noteBtn = el(
      'button',
      { class: 'btn', type: 'button' },
      kind === 'edit' && hasNote ? 'Edit note' : 'Add note',
    );
    noteBtn.addEventListener('click', () => actions.note());
    const copyBtn = el('button', { class: 'btn', type: 'button' }, 'Copy');
    copyBtn.addEventListener('click', () => actions.copy());
    bar.append(noteBtn, copyBtn);
    if (actions.remove) {
      const del = el('button', { class: 'btn', type: 'button' }, 'Delete');
      del.addEventListener('click', () => actions.remove!());
      bar.append(del);
    }
    bar.append(el('span', { class: 'arrow', 'aria-hidden': 'true' }));
    bar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideToolbar();
    });
    this.root.append(bar);
    this.toolbar = bar;
    this.toolbarKind = kind;
    this.toolbarAnchor = anchor;
    this.positionToolbar();
  }

  hideToolbar(): void {
    this.toolbar?.remove();
    this.toolbar = null;
    this.toolbarKind = null;
    this.toolbarAnchor = null;
  }

  focusToolbar(): void {
    this.toolbar?.querySelector<HTMLButtonElement>('button')?.focus();
  }

  private positionToolbar(): void {
    const bar = this.toolbar;
    const rect = this.toolbarAnchor?.();
    if (!bar || !rect) {
      if (bar) bar.style.visibility = 'hidden';
      return;
    }
    bar.style.visibility = '';
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const above = rect.top - GAP - h;
    const below = rect.bottom + GAP;
    // Above the selection by default; flip below when there's no room. Either
    // way the bar sits outside the selection's box, so it never covers it.
    // When there is no room above, go below if it fits there (or has more room).
    const placeBelow = above < MARGIN && (below + h <= vh - MARGIN || rect.top < vh - rect.bottom);
    const top = placeBelow ? below : Math.max(MARGIN, above);
    const centre = rect.left + rect.width / 2;
    const left = Math.min(Math.max(MARGIN, centre - w / 2), Math.max(MARGIN, vw - w - MARGIN));
    bar.style.top = `${Math.round(top)}px`;
    bar.style.left = `${Math.round(left)}px`;
    bar.classList.toggle('below', placeBelow);
    const arrow = bar.querySelector<HTMLElement>('.arrow');
    if (arrow)
      arrow.style.left = `${Math.round(Math.min(Math.max(14, centre - left), w - 14) - 5)}px`;
  }

  // ── Note editor ────────────────────────────────────────────────────────────

  openNoteEditor(
    anchor: RectSource,
    color: Color,
    initial: string,
    onSave: (text: string) => void,
    onClose?: () => void,
  ): void {
    this.attach();
    this.closeNoteEditor();
    this.hideToolbar();
    const labelText = colorLabel(color, this.labels());
    const box = el('div', {
      class: 'editor',
      role: 'dialog',
      'aria-label': 'Note for this highlight',
    });
    box.style.setProperty('--tint', COLOR_INFO[color].solid);
    const head = el('div', { class: 'editor-head' });
    head.append(
      el('span', { class: 'dot', 'aria-hidden': 'true' }),
      el('span', {}, `Note · ${labelText}`),
    );
    const area = el('textarea', {
      'aria-label': 'Note',
      placeholder: 'Why does this matter?',
      rows: '3',
      maxlength: '5000',
    });
    area.value = initial;
    const actions = el('div', { class: 'editor-actions' });
    const cancel = el('button', { class: 'btn ghost', type: 'button' }, 'Cancel');
    const save = el('button', { class: 'btn primary', type: 'button' }, 'Save note');
    actions.append(el('span', { class: 'hint' }, 'Ctrl+Enter to save'), cancel, save);
    box.append(head, area, actions);
    const close = () => {
      this.closeNoteEditor();
      onClose?.();
    };
    const commit = () => {
      const text = area.value.trim();
      this.closeNoteEditor();
      onSave(text);
      onClose?.();
    };
    cancel.addEventListener('click', close);
    save.addEventListener('click', commit);
    box.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep page shortcuts out of the textarea
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit();
    });
    box.addEventListener('keyup', (e) => e.stopPropagation());
    box.addEventListener('keypress', (e) => e.stopPropagation());
    this.root.append(box);
    this.editor = box;
    this.editorAnchor = anchor;
    this.positionEditor();
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }

  closeNoteEditor(): void {
    this.editor?.remove();
    this.editor = null;
    this.editorAnchor = null;
  }

  private positionEditor(): void {
    const box = this.editor;
    const rect = this.editorAnchor?.();
    if (!box || !rect) return;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + GAP;
    if (top + h > vh - MARGIN) top = Math.max(MARGIN, rect.top - GAP - h);
    const left = Math.min(Math.max(MARGIN, rect.left), Math.max(MARGIN, vw - w - MARGIN));
    box.style.top = `${Math.round(top)}px`;
    box.style.left = `${Math.round(left)}px`;
  }

  // ── Note markers and hover cards ───────────────────────────────────────────

  setMarkers(specs: MarkerSpec[], onClick: (id: string) => void): void {
    this.attach();
    this.onMarkerClick = onClick;
    this.hideCard();
    for (const m of this.markers) m.node.remove();
    this.markers = specs.map((spec) => {
      const node = el('button', {
        class: 'marker',
        type: 'button',
        'aria-label': `Note: ${spec.note}`,
      });
      node.append(noteIcon());
      node.style.setProperty('--tint', COLOR_INFO[spec.color].solid);
      node.addEventListener('mouseenter', () => this.showCard(spec, node));
      node.addEventListener('focus', () => this.showCard(spec, node));
      node.addEventListener('mouseleave', () => this.hideCard());
      node.addEventListener('blur', () => this.hideCard());
      node.addEventListener('click', () => this.onMarkerClick(spec.id));
      this.markerLayer.append(node);
      return { spec, node };
    });
    this.positionMarkers();
  }

  private positionMarkers(): void {
    const vh = window.innerHeight;
    for (const { spec, node } of this.markers) {
      const r = spec.rect();
      if (!r || r.bottom < -20 || r.top > vh + 20 || (r.width === 0 && r.height === 0)) {
        node.style.display = 'none';
        continue;
      }
      node.style.display = '';
      // Like a footnote mark: just above the end of the line, so it doesn't
      // sit on top of the next word.
      node.style.left = `${Math.round(r.right - 5)}px`;
      node.style.top = `${Math.round(r.top - 9)}px`;
    }
  }

  private showCard(spec: MarkerSpec, marker: HTMLElement): void {
    this.hideCard();
    const card = el('div', { class: 'card', role: 'tooltip' });
    card.style.setProperty('--tint', COLOR_INFO[spec.color].solid);
    card.append(
      el('div', { class: 'card-label' }, 'Your note'),
      el('div', { class: 'card-text' }, spec.note),
    );
    this.root.append(card);
    const r = marker.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const w = card.offsetWidth;
    let left = r.right + 8;
    if (left + w > vw - MARGIN) left = Math.max(MARGIN, r.left - 8 - w);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(Math.max(MARGIN, r.top - 6))}px`;
    this.card = card;
  }

  private hideCard(): void {
    this.card?.remove();
    this.card = null;
  }

  // ── Toasts ─────────────────────────────────────────────────────────────────

  toast(message: string, action?: { label: string; run(): void }, ms = 5000): void {
    this.attach();
    this.toastNode?.remove();
    window.clearTimeout(this.toastTimer);
    const t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    t.append(el('span', {}, message));
    if (action) {
      const b = el('button', { class: 'btn link', type: 'button' }, action.label);
      b.addEventListener('click', () => {
        action.run();
        t.remove();
      });
      t.append(b);
    }
    this.root.append(t);
    this.toastNode = t;
    this.toastTimer = window.setTimeout(() => t.remove(), ms);
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  scheduleReposition(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.positionToolbar();
      this.positionEditor();
      this.positionMarkers();
      this.hideCard();
    });
  }

  destroy(): void {
    this.host.remove();
  }
}
