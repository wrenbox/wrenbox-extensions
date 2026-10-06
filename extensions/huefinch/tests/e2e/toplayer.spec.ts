/**
 * Content the filter on <html> doesn't reach on its own (the top layer) must be
 * recolored once, and content already inside <html> (iframes) must not be
 * recolored twice. "Once" vs "twice" vs "never" give different pixels at full
 * strength, so the checks tell them apart.
 */
import type { Vec3 } from '../../src/shared/matrix';
import {
  expectClose,
  expected,
  fixture,
  matrixOf,
  pixels,
  setSettings,
  test,
  expect,
  waitForFilter,
  type Ext,
} from './helpers';

const RED: Vec3 = [255, 0, 0];
const BLUE: Vec3 = [0, 0, 255];
const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 100 });

async function open(ext: Ext) {
  await setSettings(ext, { strength: 100 });
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'toplayer.html'));
  await waitForFilter(page, M);
  return page;
}

function once(actual: Vec3, color: Vec3, label: string) {
  // Sanity: the three outcomes really differ for this color.
  expect(expected(M, color, 1)).not.toEqual(expected(M, color, 2));
  expect(expected(M, color, 1)).not.toEqual(color);
  expectClose(actual, expected(M, color, 1), `${label} filtered exactly once`);
}

test('a modal <dialog> and its ::backdrop are filtered exactly once', async ({ ext }) => {
  const page = await open(ext);
  await page.evaluate(() => (document.getElementById('modal') as HTMLDialogElement).showModal());
  await page.waitForTimeout(100);
  const [dialog, backdrop] = await pixels(page, [
    [400, 400],
    [1000, 700],
  ]);
  once(dialog!, RED, 'modal dialog');
  once(backdrop!, BLUE, 'dialog backdrop');
  expect(ext.errors).toEqual([]);
});

test('a non-modal dialog and an open popover are filtered exactly once', async ({ ext }) => {
  const page = await open(ext);
  await page.evaluate(() => {
    document.getElementById('pop')!.showPopover();
    (document.getElementById('modal') as HTMLDialogElement).show();
  });
  await page.waitForTimeout(100);
  const [popover, dialog, normal] = await pixels(page, [
    [700, 100],
    [400, 400],
    [50, 50],
  ]);
  once(popover!, RED, 'popover');
  once(dialog!, RED, 'non-modal dialog');
  once(normal!, RED, 'page content');
});

test('a full-screen element is filtered exactly once', async ({ ext }) => {
  const page = await open(ext);
  await page.click('#go-fullscreen');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('fs');
  await page.waitForTimeout(300);
  const [center] = await pixels(page, [[640, 400]]);
  once(center!, RED, 'full-screen element');
  await page.evaluate(() => document.exitFullscreen());
});

test('a cross-origin iframe is filtered exactly once, by the top frame only', async ({ ext }) => {
  const page = await open(ext);
  const frame = page.frameLocator('#frame');
  await expect(frame.locator('body')).toBeAttached();
  // Huefinch runs in the top frame only: nothing is injected into the iframe.
  const child = page.frames().find((f) => f !== page.mainFrame())!;
  expect(await child.evaluate(() => document.querySelectorAll('huefinch-root').length)).toBe(0);
  const [inside] = await pixels(page, [[400, 75]]);
  once(inside!, RED, 'iframe content');
});
