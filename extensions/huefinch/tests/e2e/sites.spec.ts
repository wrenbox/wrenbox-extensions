import { BLOCKS, blockCenter } from './colors';
import { expectClose, expected, fixture, getSettings, matrixOf, pixels, setSettings, tabId, test, expect, waitForFilter } from './helpers';

const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });
const points = BLOCKS.map((_, i) => blockCenter(i));

test('a site on the off-list keeps its original colors, live and after reload', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);

  await setSettings(ext, { offSites: ['127.0.0.1'] });
  await waitForFilter(page, null);
  let got = await pixels(page, points);
  BLOCKS.forEach((c, i) => expectClose(got[i]!, c, `off-listed rgb(${c})`, 0));

  await page.reload();
  await page.waitForTimeout(300);
  await waitForFilter(page, null);

  // Other sites are unaffected (a different hostname, not a different port).
  await setSettings(ext, { offSites: ['photos.example.com'] });
  await waitForFilter(page, M);
  got = await pixels(page, points);
  BLOCKS.forEach((c, i) => expectClose(got[i]!, expected(M, c), `back on rgb(${c})`));
});

test('the popup’s "On for this site" switch adds and removes the hostname', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);
  const id = await tabId(ext, page);

  const popup = await ext.ctx.newPage();
  await popup.goto(ext.url(`popup/popup.html?tab=${id}`));
  const site = popup.getByRole('switch', { name: 'On for this site' });
  await expect(site).toBeChecked();
  await expect(popup.locator('#site-host')).toHaveText('127.0.0.1');
  await site.click();
  await expect(site).not.toBeChecked();
  await expect.poll(async () => (await getSettings(ext)).offSites).toEqual(['127.0.0.1']);
  await waitForFilter(page, null);

  await site.click();
  await expect.poll(async () => (await getSettings(ext)).offSites).toEqual([]);
  await waitForFilter(page, M);
  expect(ext.errors).toEqual([]);
});

test('settings → Websites lists off sites with remove buttons', async ({ ext }) => {
  await setSettings(ext, { offSites: ['photos.example.com', 'design.example.com'] });
  const page = await ext.ctx.newPage();
  await page.goto(ext.url('options/options.html#websites'));
  const list = page.getByRole('list', { name: 'Sites where Huefinch is off' });
  await expect(list.getByRole('listitem')).toHaveText(['photos.example.com', 'design.example.com']);
  await page.getByRole('button', { name: 'Turn Huefinch back on for photos.example.com' }).click();
  await expect(list.getByRole('listitem')).toHaveText(['design.example.com']);
  await expect.poll(async () => (await getSettings(ext)).offSites).toEqual(['design.example.com']);
  expect(ext.errors).toEqual([]);
});
