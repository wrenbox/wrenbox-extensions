/**
 * Iframes are recolored exactly once, whatever their origin and however deeply
 * they are nested. Up to Chromium 150 the top page's filter reaches every
 * frame; from 151 it skips frames of another origin, which then recolor
 * themselves (src/content/frames.ts). This suite runs in Playwright's Chromium
 * and in real Microsoft Edge (npm run test:e2e:edge), so both cases are covered.
 */
import type { Page } from '@playwright/test';
import type { Vec3 } from '../../src/shared/matrix';
import {
  expect,
  expected,
  fixture,
  matrixOf,
  pixels,
  setSettings,
  test,
  waitForFilter,
  type Ext,
} from './helpers';

const RED: Vec3 = [255, 0, 0];
const BLUE: Vec3 = [0, 0, 255];
const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 100 });

/** Where frames.html puts each thing, and its own color. */
const POINTS: Array<{ name: string; at: [number, number]; color: Vec3 }> = [
  { name: 'frame of another origin', at: [100, 75], color: RED },
  { name: 'frame of the page’s origin', at: [320, 75], color: RED },
  { name: 'frame inside it, of its own origin', at: [515, 50], color: RED },
  { name: 'frame inside it, of the top page’s origin', at: [515, 170], color: RED },
  { name: 'the outer frame’s own background', at: [740, 250], color: BLUE },
  { name: 'the page itself', at: [100, 400], color: BLUE },
];

const close = (a: Vec3, b: Vec3) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= 3;

/** Waits until every point shows its color recolored `times` times (0 = original). */
async function expectAll(page: Page, times: 0 | 1): Promise<void> {
  const want = POINTS.map((p) => (times ? expected(M, p.color, 1) : p.color));
  // Sanity: once, twice and never really differ for these colors.
  for (const p of POINTS) expect(expected(M, p.color, 1)).not.toEqual(expected(M, p.color, 2));
  await expect
    .poll(
      async () => {
        const got = await pixels(
          page,
          POINTS.map((p) => p.at),
        );
        return POINTS.flatMap((p, i) =>
          close(got[i]!, want[i]!) ? [] : [`${p.name}: rgb(${got[i]}), want rgb(${want[i]})`],
        );
      },
      { timeout: 10_000, message: times ? 'every point recolored exactly once' : 'all original' },
    )
    .toEqual([]);
}

async function open(ext: Ext, host?: string): Promise<Page> {
  await setSettings(ext, { strength: 100 });
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'frames.html', host));
  await waitForFilter(page, M);
  await expect.poll(() => page.frames().length).toBe(6);
  return page;
}

for (const host of [undefined, 'shop.example'])
  test(`every frame is recolored exactly once (page on ${host ?? '127.0.0.1'})`, async ({
    ext,
  }) => {
    const page = await open(ext, host);
    await expectAll(page, 1);
    expect(ext.errors).toEqual([]);
  });

test('holding Alt+Shift+X shows the original colors in the frames too', async ({ ext }) => {
  const page = await open(ext);
  await expectAll(page, 1);
  await page.mouse.click(100, 450);
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyX');
  await expectAll(page, 0);
  await page.keyboard.up('KeyX');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');
  await expectAll(page, 1);
});

test('switching the page’s site off turns its frames off too, and back on', async ({ ext }) => {
  const page = await open(ext, 'shop.example');
  await expectAll(page, 1);
  // The frames come from 127.0.0.1; the switch that counts is the page's own site.
  await setSettings(ext, { offSites: ['shop.example'] });
  await expectAll(page, 0);
  await setSettings(ext, { offSites: [] });
  await expectAll(page, 1);
  // A page loaded while switched off stays off in its frames as well.
  await setSettings(ext, { offSites: ['shop.example'] });
  await page.reload();
  await expect.poll(() => page.frames().length).toBe(6);
  await page.waitForTimeout(500);
  await expectAll(page, 0);
});
