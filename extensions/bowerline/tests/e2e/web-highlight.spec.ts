import {
  activate,
  clickInShadow,
  expect,
  libraryCount,
  renderedHighlights,
  selectText,
  test,
} from './helpers';

test('highlights a passage on an article and restores it after reload', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);
  await activate(ext, page);

  await selectText(page, '#p1', 'The problem is rarely comprehension');
  await clickInShadow(page, { label: 'Highlight Mint' });
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ mint: ['The problem is rarely comprehension'] });
  expect(await libraryCount(ext)).toBe(1);

  // The page's own DOM is untouched: no wrappers, no injected styles.
  expect(await page.locator('#p1 mark, #p1 span').count()).toBe(0);

  await page.reload();
  await activate(ext, page);
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ mint: ['The problem is rarely comprehension'] });
  expect(ext.errors).toEqual([]);
});
