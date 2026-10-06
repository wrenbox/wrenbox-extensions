/**
 * Captures every Huefinch screen from the real, built extension:
 *  - tests/output/screens/: each screen at 1280×800 (and the popup at its own
 *    size), for review against store-assets/;
 *  - store-assets/captured/: the five store screenshots, framed like the
 *    designed mockups. Run with `npm run screens`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { feColorMatrixValues, simulationMatrix } from '../../src/shared/matrix';
import {
  evalInContentWorld,
  fixture,
  matrixOf,
  setSettings,
  tabId,
  test,
  waitForFilter,
  type Ext,
} from '../e2e/helpers';
import { OUTPUT, ROOT } from '../e2e/paths';
import { CONTENT_HEIGHT, WINDOW, dataUrl, esc, frameHtml, type FrameSpec } from './frame';

const RAW = join(OUTPUT, 'screens');
const STORE = join(ROOT, 'store-assets/captured');
mkdirSync(RAW, { recursive: true });
mkdirSync(STORE, { recursive: true });

async function popupShot(ext: Ext, tab: number, name: string): Promise<Buffer> {
  const p = await ext.ctx.newPage();
  await p.setViewportSize({ width: 340, height: 800 });
  await p.goto(ext.url(`popup/popup.html?tab=${tab}`));
  await p.locator('#hints p').first().waitFor();
  await p.waitForTimeout(300);
  const box = (await p.locator('body').boundingBox())!;
  const png = await p.screenshot({
    clip: { x: 0, y: 0, width: 340, height: Math.ceil(box.height) },
  });
  writeFileSync(join(RAW, name), png);
  await p.close();
  return png;
}

async function pageAt(
  ext: Ext,
  path: string,
  size = { width: WINDOW.width, height: CONTENT_HEIGHT },
  host?: string,
): Promise<Page> {
  const p = await ext.ctx.newPage();
  await p.setViewportSize(size);
  await p.goto(path.startsWith('chrome-extension:') ? path : fixture(ext, path, host));
  await p.waitForTimeout(500); // let fades and switch transitions finish
  return p;
}

async function store(ext: Ext, name: string, spec: FrameSpec): Promise<void> {
  const p = await ext.ctx.newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.setContent(frameHtml(spec));
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(STORE, name) });
  await p.close();
}

test('capture screens', async ({ ext }) => {
  test.setTimeout(240_000);
  const M80 = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });

  // ── 1. Before / after: the dashboard chart as a green-weak eye sees it ─────────
  const chart = await pageAt(ext, 'dashboard.html', { width: 900, height: 700 });
  await waitForFilter(chart, M80);
  const corrected = await chart.locator('.panel').screenshot();
  await setSettings(ext, { enabled: false });
  await waitForFilter(chart, null);
  const original = await chart.locator('.panel').screenshot();
  await setSettings(ext, { enabled: true });
  await chart.close();
  const sim = feColorMatrixValues(simulationMatrix('deutan', 1));
  const card = (title: string, tag: string, dark: boolean, png: Buffer) => `
    <div class="card"><div class="head"><b>${esc(title)}</b><span class="tag${dark ? ' dark' : ''}">${esc(tag)}</span></div>
    <img src="${dataUrl(png)}" width="520"></div>`;
  await store(ext, 'screenshot-1-before-after.png', {
    headline: 'Tell red and green apart again',
    subtitle: 'How a green-weak eye sees the same chart, without and with Huefinch.',
    footnote:
      'Both images simulate green-weak (deuteranopia) vision using the Machado, Oliveira and Fernandes (2009) model. Right: the page as Huefinch shows it (Green-weak, 80%).',
    body: `<svg width="0" height="0" style="position:absolute"><filter id="seen" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${sim}"/></filter></svg>
      <style>
        .cards { position: absolute; left: 64px; top: 168px; display: grid; grid-template-columns: 560px 560px; gap: 32px; }
        .card { background: #fff; border-radius: 14px; box-shadow: 0 30px 70px rgba(24,33,77,.12), 0 4px 14px rgba(24,33,77,.05); overflow: hidden; height: 498px; }
        .head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #DCE1EC; font-size: 17px; }
        .tag { padding: 6px 12px; border-radius: 999px; background: #EEF1F7; color: #2C3870; font-size: 13px; font-weight: 700; }
        .tag.dark { background: #18214D; color: #fff; }
        .card img { display: block; margin: 8px auto 0; filter: url(#seen); }
      </style>
      <div class="cards">${card('Without Huefinch', 'Lines look the same', false, original)}${card('With Huefinch', 'Easy to tell apart', true, corrected)}</div>`,
  });

  // ── 2. Popup over the dashboard (Correct colors) ─────────────────────────────
  const dash = await pageAt(ext, 'dashboard.html', undefined, 'dashboard.example');
  await waitForFilter(dash, M80);
  const dashPng = await dash.screenshot();
  const popupCorrect = await popupShot(ext, await tabId(ext, dash), 'popup-correct.png');
  await dash.setViewportSize({ width: 1280, height: 800 });
  await dash.screenshot({ path: join(RAW, 'page-dashboard-corrected.png') });
  await store(ext, 'screenshot-2-popup.png', {
    headline: 'Works on every website, automatically',
    subtitle: 'Choose your type of color vision once. Huefinch remembers it everywhere.',
    window: {
      tabTitle: 'Weekly orders, Sales dashboard',
      address: 'dashboard.example/sales',
      page: dashPng,
      popup: popupCorrect,
    },
  });

  // ── 3. Identify a color on the shop page ──────────────────────────────────────
  await ext.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: fixture(ext, '', 'shop.example').slice(0, -1),
  });
  const shop = await pageAt(ext, 'shop.html', undefined, 'shop.example');
  await waitForFilter(shop, M80);
  await evalInContentWorld(
    shop,
    `globalThis.EyeDropper = class { open() { return Promise.resolve({ sRGBHex: '#6b7a2e' }); } };`,
  );
  await shop.keyboard.press('Alt+Shift+KeyC');
  await shop.waitForTimeout(500);
  const shopPng = await shop.screenshot();
  await shop.setViewportSize({ width: 1280, height: 800 });
  await shop.waitForTimeout(200);
  await shop.screenshot({ path: join(RAW, 'page-identify-card.png') });
  await store(ext, 'screenshot-3-identify.png', {
    headline: 'Name any color on your screen',
    subtitle: 'Press Alt+Shift+C and click. Huefinch tells you the color, even inside photos.',
    window: { tabTitle: 'Everyday cotton tee', address: 'shop.example/cotton-tee', page: shopPng },
  });
  // Overlay from the popup's "Identify a color" button.
  await shop.keyboard.press('Escape');
  await ext.sw.evaluate(
    (id) =>
      (
        globalThis as unknown as { huefinch: { identify(i: number): Promise<unknown> } }
      ).huefinch.identify(id),
    await tabId(ext, shop),
  );
  await shop.bringToFront();
  await shop.waitForTimeout(400);
  await shop.screenshot({ path: join(RAW, 'page-identify-overlay.png') });
  await shop.keyboard.press('Escape');

  // ── 4. Simulate on the sign-up form ─────────────────────────────────────────
  await setSettings(ext, { mode: 'simulate', severity: 100 });
  const signup = await pageAt(ext, 'signup.html', undefined, 'app.example');
  await waitForFilter(signup, matrixOf({ mode: 'simulate', type: 'deutan', amount: 100 }));
  await signup.waitForTimeout(500);
  const signupPng = await signup.screenshot();
  const popupSim = await popupShot(ext, await tabId(ext, signup), 'popup-simulate.png');
  await store(ext, 'screenshot-4-simulate.png', {
    headline: 'Check designs the way color-blind people see them',
    subtitle: 'Simulate red-, green- or blue-weak vision on any page while you design.',
    window: {
      tabTitle: 'Sign up',
      address: 'app.example/sign-up',
      page: signupPng,
      popup: popupSim,
    },
  });
  await setSettings(ext, { mode: 'correct' });

  // ── 5. Settings → Websites ──────────────────────────────────────────────────
  await setSettings(ext, { offSites: ['photos.example.com', 'design.example.com'] });
  const opts = await pageAt(ext, ext.url('options/options.html#websites'));
  await opts.waitForSelector('html[data-ready]');
  const optsPng = await opts.screenshot();
  await store(ext, 'screenshot-5-settings.png', {
    headline: 'Set it once. Private by design.',
    subtitle:
      'Huefinch runs entirely in your browser: no account, no tracking, nothing sent anywhere.',
    window: { tabTitle: 'Huefinch settings', address: 'Huefinch settings', page: optsPng },
  });

  // ── Every other screen, for review ───────────────────────────────────────────
  await opts.setViewportSize({ width: 1280, height: 800 });
  for (const s of ['vision', 'websites', 'shortcuts', 'find', 'about']) {
    await opts.evaluate((s) => (location.hash = s), s);
    await opts.waitForTimeout(200);
    await opts.screenshot({ path: join(RAW, `options-${s}.png`) });
  }
  await opts.evaluate(() => (location.hash = 'find'));
  for (const id of ['d1', 'd2', 'p1'])
    await opts
      .locator('.pair')
      .nth(['p1', 'd1', 't1', 'd2', 'p2', 't2', 't3', 'd3', 'p3'].indexOf(id))
      .click();
  await opts.getByRole('button', { name: 'Use Green-weak' }).click();
  await opts.waitForTimeout(200);
  await opts.screenshot({ path: join(RAW, 'options-find-result.png'), fullPage: true });

  const onboarding = await pageAt(ext, ext.url('onboarding/onboarding.html'), {
    width: 1280,
    height: 800,
  });
  await onboarding.waitForSelector('html[data-ready]');
  await onboarding.screenshot({ path: join(RAW, 'onboarding-granted.png'), fullPage: true });

  await setSettings(ext, { enabled: false });
  await popupShot(ext, await tabId(ext, dash), 'popup-off.png');
  await setSettings(ext, { enabled: true });
});
