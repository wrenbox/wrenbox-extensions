/**
 * The store-screenshot frame: a headline, a subtitle and a browser window,
 * matching the layout of the designed mockups in store-assets/. Real captures
 * of the extension are placed inside the window.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../e2e/paths';

export interface FrameSpec {
  headline: string;
  subtitle: string;
  /** A browser window with one capture inside, and optionally the popup over it. */
  window?: { tabTitle: string; address: string; page: Buffer; popup?: Buffer };
  /** Free-form HTML instead of a window (the before/after cards). */
  body?: string;
  footnote?: string;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
const icon = () => dataUrl(readFileSync(join(ROOT, 'public/icons/icon-32.png')));

/** Window geometry (1280×800 canvas). The window runs off the bottom edge, as in the mockups. */
export const WINDOW = { x: 64, y: 155, width: 1152, chrome: 85 };
export const CONTENT_HEIGHT = 800 - WINDOW.y - WINDOW.chrome; // 560

export function frameHtml(spec: FrameSpec): string {
  const w = spec.window;
  const win = w
    ? `<div class="win">
    <div class="tabs"><div class="tab"><span class="fav"></span>${esc(w.tabTitle)}</div></div>
    <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <div class="url">${esc(w.address)}</div>
      <div class="ext"><img src="${icon()}" alt=""></div></div>
    <div class="content"><img src="${dataUrl(w.page)}" width="${WINDOW.width}"></div>
  </div>${w.popup ? `<img class="popup" src="${dataUrl(w.popup)}" width="340">` : ''}`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
  body { background: #F4F6FB; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18214D; position: relative; }
  h1 { position: absolute; left: 64px; top: 34px; margin: 0; font-size: 42px; font-weight: 750; letter-spacing: -0.025em; }
  p.sub { position: absolute; left: 64px; top: 97px; margin: 0; font-size: 19px; color: #5D6690; }
  p.foot { position: absolute; left: 64px; bottom: 34px; margin: 0; font-size: 14px; color: #5D6690; }
  .win { position: absolute; left: ${WINDOW.x}px; top: ${WINDOW.y}px; width: ${WINDOW.width}px; height: ${800 - WINDOW.y + 40}px;
         border-radius: 16px; background: #fff; border: 1px solid #DCE1EC; overflow: hidden;
         box-shadow: 0 30px 70px rgba(24,33,77,.14), 0 4px 14px rgba(24,33,77,.06); }
  .tabs { height: 41px; background: #E6E9F2; position: relative; }
  .tab { position: absolute; left: 14px; bottom: 0; width: 270px; height: 32px; background: #fff; border-radius: 10px 10px 0 0;
         display: flex; align-items: center; gap: 9px; padding: 0 14px; font-size: 13px; white-space: nowrap; overflow: hidden; }
  .fav { width: 14px; height: 14px; border-radius: 3px; background: #2C3870; flex: none; }
  .bar { height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid #DCE1EC; }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: #CDD3E2; }
  .url { flex: 1; height: 30px; margin-left: 10px; border-radius: 15px; background: #F0F2F8; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #2C3870; }
  .ext { width: 30px; height: 30px; border-radius: 8px; background: #E6E9F2; display: grid; place-items: center; }
  .ext img { width: 20px; height: 20px; }
  .content img { display: block; }
  .popup { position: absolute; right: 78px; top: ${WINDOW.y + WINDOW.chrome + 4}px; border-radius: 14px; border: 1px solid #DCE1EC;
           box-shadow: 0 18px 48px rgba(24,33,77,.22), 0 2px 6px rgba(24,33,77,.08); }
  ${spec.body ? '' : ''}
</style></head><body>
  <h1>${esc(spec.headline)}</h1>
  <p class="sub">${esc(spec.subtitle)}</p>
  ${win}${spec.body ?? ''}
  ${spec.footnote ? `<p class="foot">${esc(spec.footnote)}</p>` : ''}
</body></html>`;
}
