/**
 * Huefinch on realistic pages: no flash of uncorrected color, no double
 * filtering, nothing broken, no console errors.
 *
 * "No flash" is checked from inside the page: a probe registered before any
 * page script asks for the first animation frame, which runs right before the
 * first paint. The filter must already be in place then.
 */
import type { Page } from '@playwright/test';
import { BLOCKS, blockCenter } from './colors';
import {
  expectClose,
  expected,
  filterState,
  fixture,
  matrixOf,
  pixels,
  test,
  expect,
  waitForFilter,
  type Ext,
} from './helpers';

const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });

async function probe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __firstFrame: Promise<string> };
    w.__firstFrame = new Promise((resolve) =>
      requestAnimationFrame(() => resolve(getComputedStyle(document.documentElement).filter)),
    );
  });
}

async function visit(ext: Ext, path: string): Promise<Page> {
  const page = await ext.ctx.newPage();
  await probe(page);
  await page.goto(fixture(ext, path));
  const first = await page.evaluate(
    () => (window as unknown as { __firstFrame: Promise<string> }).__firstFrame,
  );
  expect(first, `${path}: filter in place at the first frame`).toContain('huefinch-filter');
  await waitForFilter(page, M);
  return page;
}

async function checkSingle(page: Page, label: string) {
  const s = await filterState(page);
  expect(s.roots, `${label}: one Huefinch container`).toBe(1);
  // Only <html> (and top-layer content) carry the filter; nothing inside is filtered again.
  const doubled = await page.evaluate(
    () =>
      [...document.querySelectorAll('body, body *')].filter((el) =>
        getComputedStyle(el).filter.includes('huefinch'),
      ).length,
  );
  expect(doubled, `${label}: no element inside <html> filtered again`).toBe(0);
}

for (const path of [
  'article.html',
  'dashboard.html',
  'shop.html',
  'signup.html',
  'transit.html',
  'dark.html',
  'iframe.html',
]) {
  test(`${path}: filtered from the first frame, once, without errors`, async ({ ext }) => {
    const page = await visit(ext, path);
    await checkSingle(page, path);
    expect(ext.errors).toEqual([]);
  });
}

test('dialog.html: the modal, its backdrop and a popover menu are recolored, once', async ({
  ext,
}) => {
  const page = await visit(ext, 'dialog.html');
  await page.click('#menu-button');
  await expect(page.locator('#menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.click('#open');
  await expect(page.locator('#confirm')).toBeVisible();
  const f = await page.evaluate(() => [
    getComputedStyle(document.getElementById('confirm')!).filter,
    getComputedStyle(document.getElementById('confirm')!, '::backdrop').filter,
  ]);
  expect(f.every((x) => x.includes('huefinch-filter'))).toBe(true);
  await page.click('#keep');
  await checkSingle(page, 'dialog.html');
  expect(ext.errors).toEqual([]);
});

test('video.html: a playing video and a long scroll stay recolored', async ({ ext }) => {
  const page = await visit(ext, 'video.html');
  await expect
    .poll(() =>
      page.evaluate(() => (document.getElementById('video') as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.2);
  await page.mouse.wheel(0, 6000);
  await page.waitForTimeout(300);
  await checkSingle(page, 'video.html');
  expect(ext.errors).toEqual([]);
});

test('spa.html (with <base href>): client-side navigation keeps the filter', async ({ ext }) => {
  const page = await visit(ext, 'spa/overview');
  await page.click('text=Alerts');
  await expect(page.locator('h1')).toHaveText('Alerts');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Overview');
  await waitForFilter(page, M);
  await checkSingle(page, 'spa.html');
  expect(ext.errors).toEqual([]);
});

test('hostile.html: a page that keeps removing Huefinch gets it back every time', async ({
  ext,
}) => {
  const page = await visit(ext, 'hostile.html');
  await expect(page.locator('#status')).toHaveText('Done');
  await waitForFilter(page, M);
  await checkSingle(page, 'hostile.html');
  expect(ext.errors).toEqual([]);
});

test('a strict Content-Security-Policy page (no inline styles) is recolored exactly', async ({
  ext,
}) => {
  const page = await visit(ext, 'csp/blocks.html');
  const got = await pixels(
    page,
    BLOCKS.map((_, i) => blockCenter(i)),
  );
  BLOCKS.forEach((c, i) => expectClose(got[i]!, expected(M, c), `CSP page rgb(${c})`));
  await checkSingle(page, 'csp');
});

test('a container left by an older version is replaced, so there is one filter', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  // Simulate the leftover of an orphaned older version: a stale container
  // whose filter has the same id but a different (identity) matrix.
  await page.addInitScript(() => {
    const ns = 'http://www.w3.org/2000/svg';
    const stale = document.createElement('huefinch-root');
    const svg = document.createElementNS(ns, 'svg');
    const filter = document.createElementNS(ns, 'filter');
    filter.id = 'huefinch-filter';
    const m = document.createElementNS(ns, 'feColorMatrix');
    m.setAttribute('values', '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0');
    filter.append(m);
    svg.append(filter);
    stale.append(svg);
    document.documentElement.append(stale);
  });
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);
  await checkSingle(page, 'stale container');
  const got = await pixels(
    page,
    BLOCKS.map((_, i) => blockCenter(i)),
  );
  BLOCKS.forEach((c, i) => expectClose(got[i]!, expected(M, c), `rgb(${c})`));
});

for (const [path, color] of [
  ['short.html', [250, 228, 196]],
  ['short-body.html', [16, 22, 40]],
] as const) {
  test(`${path}: the page background still reaches the bottom of a short page`, async ({ ext }) => {
    // With a filter on <html>, Chrome paints the root background only over <html>'s
    // own box; below short content the default canvas (white) would show instead.
    const page = await visit(ext, path);
    const [top, bottom] = await pixels(page, [
      [1200, 100],
      [1200, 790],
    ]);
    expectClose(top!, expected(M, [...color]), `${path} background near the top`);
    expectClose(bottom!, expected(M, [...color]), `${path} background at the bottom`);
  });
}
