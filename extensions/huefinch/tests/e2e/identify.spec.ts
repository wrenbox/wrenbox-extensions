/**
 * The color identifier. The browser's EyeDropper opens a native picker that a
 * test can't click, so it is replaced inside Huefinch's content-script world
 * with a stand-in that records what the page looked like when it opened.
 */
import type { Page } from '@playwright/test';
import { api, evalInContentWorld, fixture, matrixOf, shadowText, tabId, test, expect, waitForFilter, type Ext } from './helpers';

const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });

async function mockEyeDropper(page: Page, hex: string | null): Promise<void> {
  await evalInContentWorld(
    page,
    `globalThis.__opened = [];
     globalThis.EyeDropper = class {
       open() {
         globalThis.__opened.push(getComputedStyle(document.documentElement).filter);
         return ${hex ? `Promise.resolve({ sRGBHex: ${JSON.stringify(hex)} })` : "Promise.reject(new DOMException('Canceled', 'AbortError'))"};
       }
     };`,
  );
}

async function setup(ext: Ext, hex: string | null) {
  await ext.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ext.server.url });
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);
  await mockEyeDropper(page, hex);
  return page;
}

test('Alt+Shift+C picks the true color (filter off while picking), names it and copies the hex', async ({ ext }) => {
  const page = await setup(ext, '#6b7a2e');
  await page.keyboard.press('Alt+Shift+KeyC');
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toContain('Olive green');
  const card = await shadowText(page, 'huefinch-identify');
  expect(card).toContain('#6B7A2E, copied');
  expect(card).toContain('Close to: dark olive green');
  // The picker opened on the page's real colors…
  expect(await evalInContentWorld(page, 'globalThis.__opened')).toEqual(['none']);
  // …and the filter came back afterwards.
  await waitForFilter(page, M);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#6B7A2E');
  // The card is in the top layer, above everything on the page.
  expect(await page.evaluate(() => document.querySelector('huefinch-identify')?.matches(':popover-open'))).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toBe('');
  expect(ext.errors).toEqual([]);
});

test('clicking away closes the card; cancelling the picker restores the filter', async ({ ext }) => {
  const page = await setup(ext, '#ff0000');
  await page.keyboard.press('Alt+Shift+KeyC');
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toContain('Bright red');
  await page.mouse.click(300, 600);
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toBe('');

  await mockEyeDropper(page, null);
  await page.keyboard.press('Alt+Shift+KeyC');
  await waitForFilter(page, M);
  expect(await shadowText(page, 'huefinch-identify')).toBe('');
  expect(await evalInContentWorld(page, 'globalThis.__opened')).toEqual(['none']);
});

test('the popup button shows "Click anywhere to pick a color"; that click opens the picker', async ({ ext }) => {
  const page = await setup(ext, '#18214d');
  const id = await tabId(ext, page);
  expect(await api<{ ok: boolean }>(ext, 'identify', id)).toEqual({ ok: true });
  await page.bringToFront();
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toContain('Click anywhere to pick a color');
  await page.mouse.click(640, 500);
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toContain('Navy blue');
  expect(await shadowText(page, 'huefinch-identify')).toContain('Close to: midnight blue');
  expect(await evalInContentWorld(page, 'globalThis.__opened')).toEqual(['none']);
});

test('Escape cancels the overlay without picking', async ({ ext }) => {
  const page = await setup(ext, '#18214d');
  const id = await tabId(ext, page);
  await api(ext, 'identify', id);
  await page.bringToFront();
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toContain('Click anywhere');
  await page.keyboard.press('Escape');
  await expect.poll(() => shadowText(page, 'huefinch-identify')).toBe('');
  expect(await evalInContentWorld(page, 'globalThis.__opened')).toEqual([]);
  await waitForFilter(page, M);
});
