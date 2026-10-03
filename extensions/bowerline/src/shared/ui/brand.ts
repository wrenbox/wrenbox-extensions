/** The Bowerline mark and wordmark, drawn as inline SVG (no image or font requests). */
import { svg } from './dom';

/** The icon: a white bookmark on navy, crossed by a yellow highlighter stroke. */
export function logoMark(size = 28): SVGElement {
  return svg(
    'svg',
    {
      viewBox: '0 0 128 128',
      width: size,
      height: size,
      'aria-hidden': 'true',
      class: 'logo-mark',
    },
    svg('rect', { width: 128, height: 128, rx: 28, fill: '#18214D' }),
    svg('path', { d: 'M40 20h48v88L64 90 40 108Z', fill: '#FFFFFF' }),
    svg('path', {
      d: 'M14 78 108 50l5 13-94 28Z',
      fill: '#FFE14D',
      stroke: '#18214D',
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    }),
  );
}

/** Mark plus the "Bowerline" name, as one accessible SVG image. */
export function wordmark(height = 28): SVGElement {
  const width = Math.round(height * 4.6);
  return svg(
    'svg',
    {
      viewBox: '0 0 147 32',
      width,
      height,
      role: 'img',
      'aria-label': 'Bowerline',
      class: 'wordmark',
    },
    svg(
      'g',
      { transform: 'scale(0.25)' },
      svg('rect', { width: 128, height: 128, rx: 28, fill: '#18214D' }),
      svg('path', { d: 'M40 20h48v88L64 90 40 108Z', fill: '#FFFFFF' }),
      svg('path', {
        d: 'M14 78 108 50l5 13-94 28Z',
        fill: '#FFE14D',
        stroke: '#18214D',
        'stroke-width': 4,
        'stroke-linejoin': 'round',
      }),
    ),
    (() => {
      const t = svg('text', {
        x: 40,
        y: 23,
        'font-size': 20,
        'font-weight': 700,
        'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fill: 'currentColor',
        textLength: 105,
        lengthAdjust: 'spacingAndGlyphs',
      });
      t.textContent = 'Bowerline';
      return t;
    })(),
  );
}

export const STUDIO_LINE = 'Made by Wrenbox: small, private tools for your browser.';
export const PRIVACY_URL = 'https://wrenbox.github.io/wrenbox-extensions/bowerline/privacy';
