import { BLOCKS, blockCenter } from './colors';
import {
  expectClose,
  expected,
  fixture,
  matrixOf,
  pixels,
  shadowText,
  test,
  expect,
  waitForFilter,
} from './helpers';

const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });
const points = BLOCKS.map((_, i) => blockCenter(i));

test('holding Alt+Shift+X shows the original pixels; letting go brings the filter back', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);

  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyX');
  await waitForFilter(page, null);
  let got = await pixels(page, points);
  BLOCKS.forEach((c, i) => expectClose(got[i]!, c, `held rgb(${c})`, 0));
  expect(await shadowText(page, 'huefinch-pill')).toBe('Showing original colors');

  // Key repeat while held keeps the original colors.
  await page.keyboard.down('KeyX');
  await waitForFilter(page, null);

  await page.keyboard.up('KeyX');
  await waitForFilter(page, M);
  got = await pixels(page, points);
  BLOCKS.forEach((c, i) => expectClose(got[i]!, expected(M, c), `released rgb(${c})`));
  expect(await shadowText(page, 'huefinch-pill')).toBe('');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');
  expect(ext.errors).toEqual([]);
});

test('releasing Alt or Shift first, or the window losing focus, also restores the filter', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);

  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyX');
  await waitForFilter(page, null);
  await page.keyboard.up('Alt');
  await waitForFilter(page, M);
  await page.keyboard.up('KeyX');
  await page.keyboard.up('Shift');

  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyX');
  await waitForFilter(page, null);
  // Switching windows while holding: keyup never arrives, blur does.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitForFilter(page, M);
});

test('the keys do nothing while typing in a text field', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);
  await page.focus('#field');
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyX');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyX');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');
  await waitForFilter(page, M);
  await page.keyboard.press('Alt+Shift+KeyC');
  await page.waitForTimeout(150);
  expect(await shadowText(page, 'huefinch-identify')).toBe('');
});
