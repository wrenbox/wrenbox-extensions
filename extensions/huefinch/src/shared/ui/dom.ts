/** A tiny, dependency-free element builder for Huefinch's extension pages. */

type Child = Node | string | number | null | undefined | false;
type Handler = (ev: Event) => void;

export interface Props {
  class?: string;
  text?: string;
  style?: Record<string, string>;
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
        for (const [k, v] of Object.entries(value as Record<string, string>)) el.style.setProperty(k, v);
      } else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as Handler);
      } else if (key === 'value' && 'value' in el) (el as HTMLInputElement).value = String(value);
      else if (key === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = !!value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
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
