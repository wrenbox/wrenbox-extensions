/** A tiny, dependency-free element builder for Bowerline's extension pages. */

type Child = Node | string | number | null | undefined | false;
type Handler = (ev: Event) => void;

export interface Props {
  class?: string;
  text?: string;
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  dataset?: Record<string, string>;
  [attr: string]: unknown;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'style') {
        for (const [k, v] of Object.entries(value as Record<string, string>)) {
          if (k.startsWith('--')) el.style.setProperty(k, v);
          else (el.style as unknown as Record<string, string>)[k] = v;
        }
      } else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as Handler);
      } else if (key === 'value' && 'value' in el) (el as HTMLInputElement).value = String(value);
      else if (key === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = !!value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove();
}

export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds SVG from a compact description, without innerHTML. */
export function svg(
  tag: string,
  attrs: Record<string, string | number>,
  ...children: SVGElement[]
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
}

/** Marks every match of `ranges` inside `text` with <mark>. */
export function markText(text: string, ranges: Array<[number, number]>): Array<Node> {
  if (!ranges.length) return [document.createTextNode(text)];
  const out: Node[] = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s > at) out.push(document.createTextNode(text.slice(at, s)));
    out.push(h('mark', { text: text.slice(s, e) }));
    at = e;
  }
  if (at < text.length) out.push(document.createTextNode(text.slice(at)));
  return out;
}
