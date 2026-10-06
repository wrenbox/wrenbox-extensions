/**
 * Huefinch's in-page UI, each part in its own closed shadow root so the page
 * can't style or read it, and it can't affect the page:
 *  - the Simulate pill at the top of the page,
 *  - the "Click anywhere to pick a color" overlay,
 *  - the identify card.
 * The overlay and card are shown in the top layer (as a manual popover), so
 * they appear above modal dialogs and full-screen video too.
 *
 * All of it sits under the page filter, so it is recolored like the page.
 * Its colors (navy on white, white on navy) keep their contrast under every
 * matrix Huefinch applies; tests/unit/contrast.test.ts checks this.
 */
import type { ColorReport } from '../shared/color';
import { hideFromLayout } from './filter';

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer {
  font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #18214d;
  -webkit-font-smoothing: antialiased;
}
.pill {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 32px);
  padding: 8px 16px;
  border-radius: 999px;
  background: #18214d;
  color: #ffffff;
  font: 700 13px/1.3 system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 4px 14px rgba(24, 33, 77, 0.28);
  pointer-events: none;
  z-index: 2147483647;
  animation: fade 0.18s ease-out;
}
.overlay {
  appearance: none;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: rgba(24, 33, 77, 0.12);
  cursor: crosshair;
  pointer-events: auto;
  display: grid;
  place-items: center;
  font: inherit;
  color: inherit;
}
.overlay:focus { outline: none; }
.overlay:focus-visible .prompt { outline: 3px solid #ffffff; outline-offset: 3px; }
.prompt {
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 14px 22px;
  border-radius: 14px;
  background: #18214d;
  color: #ffffff;
  box-shadow: 0 12px 32px rgba(24, 33, 77, 0.35);
  animation: fade 0.18s ease-out;
}
.prompt strong { font-size: 16px; font-weight: 700; }
.prompt span { font-size: 13px; color: #dfe4f5; }
.card {
  position: fixed;
  top: 16px;
  right: 16px;
  width: min(330px, calc(100vw - 32px));
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 14px;
  align-items: start;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid #dce1ec;
  background: #ffffff;
  color: #18214d;
  box-shadow: 0 1px 2px rgba(24, 33, 77, 0.08), 0 18px 48px rgba(24, 33, 77, 0.24);
  pointer-events: auto;
  animation: fade 0.18s ease-out;
}
.swatch {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(24, 33, 77, 0.18);
}
.text { min-width: 0; display: grid; gap: 3px; }
.name { margin: 0; font-size: 20px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; }
.line { margin: 0; font-size: 13px; color: #4a5380; }
.copy {
  appearance: none;
  justify-self: start;
  margin-top: 4px;
  padding: 5px 10px;
  border-radius: 10px;
  border: 1.5px solid #18214d;
  background: #ffffff;
  color: #18214d;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.close {
  appearance: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: -6px -6px 0 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4a5380;
  cursor: pointer;
}
.close:hover { background: #f4f6fb; color: #18214d; }
.close svg { width: 14px; height: 14px; }
button:focus-visible { outline: 2px solid #18214d; outline-offset: 2px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pill, .prompt, .card { animation: none; } }
`;

let sheet: CSSStyleSheet | null = null;
function styles(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
  }
  return sheet;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Styles are always set through the CSSOM, never as style="" attributes, so a
 * site's Content-Security-Policy can't block them.
 */
function swatch(color: string): HTMLElement {
  const s = el('div', { class: 'swatch', 'aria-hidden': 'true' });
  s.style.setProperty('background', color);
  return s;
}

/** A host element with a closed shadow root, kept out of the page's layout. */
function makeHost(tag: string): { host: HTMLElement; shadow: ShadowRoot; layer: HTMLElement } {
  const host = document.createElement(tag);
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.adoptedStyleSheets = [styles()];
  const layer = el('div', { class: 'layer' });
  shadow.append(layer);
  return { host, shadow, layer };
}

/** Styles for the popover host: full-viewport, transparent, click-through. */
function makeTopLayerHost(host: HTMLElement): void {
  host.setAttribute('popover', 'manual');
  const s = host.style;
  for (const [k, v] of [
    ['position', 'fixed'],
    ['inset', '0'],
    ['width', '100%'],
    ['height', '100%'],
    ['max-width', 'none'],
    ['max-height', 'none'],
    ['margin', '0'],
    ['padding', '0'],
    ['border', '0'],
    ['background', 'transparent'],
    ['overflow', 'visible'],
    ['pointer-events', 'none'],
    ['z-index', '2147483647'],
  ] as const)
    s.setProperty(k, v, 'important');
}

const CLOSE_ICON = 'M3 3l10 10M13 3L3 13';

function closeIcon(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', CLOSE_ICON);
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
}

/**
 * Copies text. The Clipboard API exists only on secure (https) pages; on
 * plain http pages a temporary text field and the copy command are used.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Not allowed here (no focus or no permission): try the copy command.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  for (const [k, v] of [
    ['position', 'fixed'],
    ['opacity', '0'],
    ['pointer-events', 'none'],
    ['left', '0'],
    ['top', '0'],
  ] as const)
    area.style.setProperty(k, v, 'important');
  const host = document.createElement('huefinch-copy');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.append(area);
  document.documentElement.append(host);
  const before = document.activeElement;
  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    host.remove();
    if (before instanceof HTMLElement) before.focus({ preventScroll: true });
  }
}

export interface UiCallbacks {
  /** The overlay was clicked (or Enter pressed on it): open the eyedropper now. */
  onPick(): void;
}

export class PageUi {
  private readonly pill = makeHost('huefinch-pill');
  private readonly top = makeHost('huefinch-identify');
  private pillText: string | null = null;
  private mode: 'none' | 'overlay' | 'card' = 'none';
  private returnFocus: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly cb: UiCallbacks,
  ) {
    hideFromLayout(this.pill.host);
    makeTopLayerHost(this.top.host);
    this.onKey = this.onKey.bind(this);
    this.onPointer = this.onPointer.bind(this);
  }

  // --- Simulate pill -------------------------------------------------------

  setPill(text: string | null): void {
    if (text === this.pillText) return;
    this.pillText = text;
    this.pill.layer.replaceChildren();
    if (!text) {
      this.pill.host.remove();
      return;
    }
    this.pill.layer.append(el('div', { class: 'pill', 'aria-hidden': 'true' }, text));
    if (this.pill.host.parentNode !== this.root) this.root.append(this.pill.host);
  }

  // --- Overlay and card ----------------------------------------------------

  get showing(): 'none' | 'overlay' | 'card' {
    return this.mode;
  }

  /** "Click anywhere to pick a color": the click is the gesture the eyedropper needs. */
  showOverlay(): void {
    this.rememberFocus();
    const button = el('button', { type: 'button', class: 'overlay' });
    const prompt = el('span', { class: 'prompt' });
    prompt.append(
      el('strong', {}, 'Click anywhere to pick a color'),
      el('span', {}, 'Esc to cancel'),
    );
    button.append(prompt);
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide(false);
      this.cb.onPick();
    });
    this.show('overlay', button);
    button.focus({ preventScroll: true });
  }

  showCard(report: ColorReport | null, copied: Promise<boolean>): void {
    this.rememberFocus();
    const card = el('div', { class: 'card', role: 'dialog', 'aria-labelledby': 'hf-name' });
    const close = el('button', { type: 'button', class: 'close', 'aria-label': 'Close' });
    close.append(closeIcon());
    close.addEventListener('click', () => this.hide(true));

    if (!report) {
      card.append(
        swatch('#f4f6fb'),
        (() => {
          const t = el('div', { class: 'text' });
          t.append(
            el('p', { class: 'name', id: 'hf-name' }, 'No color picked'),
            el('p', { class: 'line' }, 'This browser can’t pick colors from the screen here.'),
          );
          return t;
        })(),
        close,
      );
    } else {
      const hexLine = el('p', { class: 'line', id: 'hf-hex' }, report.hex);
      const text = el('div', { class: 'text' });
      text.append(
        el('p', { class: 'name', id: 'hf-name' }, report.name),
        hexLine,
        el(
          'p',
          { class: 'line', title: `CSS: ${report.cssKeyword}` },
          `Close to: ${report.closeTo}`,
        ),
      );
      const status = el('p', { class: 'sr', role: 'status' });
      text.append(status);
      card.setAttribute('aria-describedby', 'hf-hex');
      card.append(swatch(report.hex), text, close);
      void copied.then((ok) => {
        if (ok) {
          hexLine.textContent = `${report.hex}, copied`;
          status.textContent = `${report.name}, ${report.hex}, copied to the clipboard`;
          return;
        }
        status.textContent = `${report.name}, ${report.hex}`;
        const copy = el('button', { type: 'button', class: 'copy' }, 'Copy hex');
        copy.addEventListener('click', () => {
          void copyText(report.hex).then((ok) => {
            if (!ok) {
              copy.textContent = 'Copy failed';
              return;
            }
            hexLine.textContent = `${report.hex}, copied`;
            status.textContent = 'Copied';
            copy.remove();
            close.focus({ preventScroll: true });
          });
        });
        text.append(copy);
      });
    }
    this.show('card', card);
    close.focus({ preventScroll: true });
  }

  /** Closes the overlay or card. */
  hide(restoreFocus = true): void {
    if (this.mode === 'none') return;
    this.mode = 'none';
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('pointerdown', this.onPointer, true);
    this.top.layer.replaceChildren();
    try {
      if (this.top.host.matches(':popover-open')) this.top.host.hidePopover();
    } catch {
      /* not shown as a popover */
    }
    this.top.host.remove();
    const back = this.returnFocus;
    this.returnFocus = null;
    if (restoreFocus && back?.isConnected) back.focus({ preventScroll: true });
  }

  private show(mode: 'overlay' | 'card', content: HTMLElement): void {
    this.mode = mode;
    this.top.layer.replaceChildren(content);
    if (this.top.host.parentNode !== this.root) this.root.append(this.top.host);
    try {
      if (!this.top.host.matches(':popover-open')) this.top.host.showPopover();
    } catch {
      /* Popover API unavailable: the host is still a fixed, top-most layer. */
    }
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('pointerdown', this.onPointer, true);
  }

  private rememberFocus(): void {
    if (this.mode !== 'none') return;
    const a = document.activeElement;
    this.returnFocus = a instanceof HTMLElement && a !== document.body ? a : null;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    this.hide(true);
  }

  /**
   * Click-away closes the card. Only the card itself takes pointer events (the
   * host is click-through), so any event whose path includes the host is a
   * click on the card.
   */
  private onPointer(e: PointerEvent): void {
    if (this.mode !== 'card') return;
    if (e.composedPath().includes(this.top.host)) return;
    this.hide(false);
  }
}
