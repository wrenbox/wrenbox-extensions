/**
 * Pixel checks: what Chromium paints must match Huefinch's maths
 * (sRGB → linear → matrix → sRGB) within ±3 per channel.
 */
import { CVD_TYPES } from '../../src/shared/matrix';
import { BLOCKS, blockCenter } from './colors';
import { expectClose, expected, filterState, fixture, matrixOf, pixels, setSettings, test, expect, waitForFilter } from './helpers';

test('default setting (Correct, Green-weak, 80%) is applied automatically and matches the maths', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  const m = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });
  await waitForFilter(page, m);
  const got = await pixels(page, BLOCKS.map((_, i) => blockCenter(i)));
  BLOCKS.forEach((c, i) => expectClose(got[i]!, expected(m, c), `block rgb(${c})`));
  // Grays stay gray.
  expect(got[8]).toEqual([128, 128, 128]);
  expect((await filterState(page)).roots).toBe(1);
  expect(ext.errors).toEqual([]);
});

for (const mode of ['correct', 'simulate'] as const) {
  test(`${mode}: every type and a partial amount, applied live`, async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.goto(fixture(ext, 'blocks.html'));
    for (const type of CVD_TYPES) {
      for (const amount of [100, 45]) {
        await setSettings(ext, mode === 'correct' ? { mode, type, strength: amount } : { mode, type, severity: amount });
        const m = matrixOf({ mode, type, amount });
        await waitForFilter(page, m);
        const got = await pixels(page, BLOCKS.map((_, i) => blockCenter(i)));
        BLOCKS.forEach((c, i) => expectClose(got[i]!, expected(m, c), `${mode} ${type} ${amount}% rgb(${c})`));
      }
    }
    expect(ext.errors).toEqual([]);
  });
}

test('turning Huefinch off restores the original pixels', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, matrixOf({ mode: 'correct', type: 'deutan', amount: 80 }));
  await setSettings(ext, { enabled: false });
  await waitForFilter(page, null);
  const got = await pixels(page, BLOCKS.map((_, i) => blockCenter(i)));
  BLOCKS.forEach((c, i) => expectClose(got[i]!, c, `off rgb(${c})`, 0));
  expect((await filterState(page)).css).toBe('');
});
