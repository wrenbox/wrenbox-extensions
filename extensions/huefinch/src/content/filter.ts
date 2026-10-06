/**
 * The page filter: one inline SVG <filter> with an feColorMatrix, applied to
 * <html> by a style rule. Both live in a container attached to <html> as early
 * as document_start, and are put back if the page removes them.
 *
 * Huefinch never reads the page: it only adds these elements and watches
 * whether they're still attached.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
export const FILTER_ID = 'huefinch-filter';
export const ROOT_TAG = 'huefinch-root';

/**
 * <html> gets the filter, so everything inside it (text, images, video,
 * canvas, iframes) is recolored once.
 *
 * With a filter on <html>, Chrome paints the page background only over
 * <html>'s own box, so below a short page the default (white) canvas would
 * show. A minimum height of 100% makes <html> cover the window. It has zero
 * specificity, so any page that sizes <html> itself keeps its own rule. Top-layer content (modal dialogs,
 * popovers, full-screen elements and their backdrops) is painted outside
 * <html>, so it gets the same filter itself; it is never inside another
 * filtered box, so it is recolored exactly once too.
 */
export const FILTER_CSS = `html { filter: url(#${FILTER_ID}) !important; }
dialog:modal, :popover-open, :fullscreen, ::backdrop { filter: url(#${FILTER_ID}) !important; }
:where(html) { min-height: 100%; }`;

/** Inline style that keeps an element out of the page's layout and away from its CSS. */
export function hideFromLayout(el: HTMLElement | SVGElement): void {
  const s = el.style;
  s.setProperty('display', 'contents', 'important');
}

export class PageFilter {
  readonly root: HTMLElement;
  private readonly style: HTMLStyleElement;
  private readonly matrix: SVGElement;
  private values: string | null = null;
  private observer: MutationObserver;
  private reattachTimes: number[] = [];
  private pausedUntil = 0;

  constructor() {
    this.root = document.createElement(ROOT_TAG);
    hideFromLayout(this.root);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    for (const [k, v] of [
      ['position', 'absolute'],
      ['width', '0'],
      ['height', '0'],
      ['overflow', 'hidden'],
      ['pointer-events', 'none'],
    ])
      svg.style.setProperty(k!, v!, 'important');
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', FILTER_ID);
    // The matrices are defined in linear RGB, the default for SVG filters. Set
    // it inline as well, so a site's CSS can't switch the filter to sRGB.
    filter.style.setProperty('color-interpolation-filters', 'linearRGB', 'important');
    this.matrix = document.createElementNS(SVG_NS, 'feColorMatrix');
    this.matrix.setAttribute('type', 'matrix');
    this.matrix.style.setProperty('color-interpolation-filters', 'linearRGB', 'important');
    filter.append(this.matrix);
    svg.append(filter);

    this.style = document.createElement('style');
    this.style.dataset.huefinch = '';
    this.root.append(svg, this.style);

    this.observer = new MutationObserver(() => this.ensureAttached());
    // A container left by an older Huefinch (its script is orphaned after an
    // update) is replaced by this one, so there is only ever one filter.
    for (const el of [...(document.documentElement?.children ?? [])])
      if (el.localName === ROOT_TAG) el.remove();
    this.attach();
  }

  /** Applies a matrix (feColorMatrix values), or removes the filter with null. */
  set(values: string | null): void {
    if (values === this.values) return;
    this.values = values;
    if (values) this.matrix.setAttribute('values', values);
    const css = values ? FILTER_CSS : '';
    if (this.style.textContent !== css) this.style.textContent = css;
  }

  get applied(): boolean {
    return this.values !== null;
  }

  private attach(): void {
    const html = document.documentElement;
    if (html && this.root.parentNode !== html) html.append(this.root);
    this.observer.disconnect();
    // The container itself, and <html> being replaced (document.open, some frameworks).
    this.observer.observe(document, { childList: true });
    if (html) this.observer.observe(html, { childList: true });
    this.observer.observe(this.root, { childList: true });
  }

  private ensureAttached(): void {
    // After an update or removal this script is orphaned: stop maintaining the
    // old container and let the new version (or nothing) take over.
    if (!chrome.runtime?.id) {
      this.observer.disconnect();
      return;
    }
    const html = document.documentElement;
    const intact =
      !!html &&
      this.root.parentNode === html &&
      this.style.parentNode === this.root &&
      this.matrix.isConnected;
    if (intact) return;
    // A page that keeps removing us shouldn't get stuck in a loop with us.
    const now = performance.now();
    if (now < this.pausedUntil) return;
    this.reattachTimes = this.reattachTimes.filter((t) => now - t < 2000);
    if (this.reattachTimes.length >= 30) {
      this.pausedUntil = now + 5000;
      setTimeout(() => this.ensureAttached(), 5100);
      return;
    }
    this.reattachTimes.push(now);
    if (this.style.parentNode !== this.root) this.root.append(this.style);
    if (!this.matrix.isConnected) {
      const svg = this.matrix.parentNode?.parentNode as SVGElement | null;
      if (svg) this.root.prepend(svg);
    }
    this.attach();
  }
}
