import {
  activate,
  clickInShadow,
  expect,
  renderedHighlights,
  selectText,
  storedHighlights,
  test,
} from './helpers';

const PASSAGE = 'The comment that loads last is the one you will want to highlight.';

test('restores highlights on a dynamic page whose content loads late, and follows pushState navigation', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/spa.html`);
  await page.waitForSelector('#post-1');
  await activate(ext, page);
  await selectText(page, '#post-1', PASSAGE);
  await clickInShadow(page, { label: 'Highlight Sky' });
  await expect.poll(() => renderedHighlights(page)).toMatchObject({ sky: [PASSAGE] });

  // Reload with a slow render: Bowerline starts before the comments exist.
  await page.evaluate(() => sessionStorage.setItem('delay', '2500'));
  await page.reload();
  await activate(ext, page);
  expect((await renderedHighlights(page)).sky).toEqual([]);
  await page.waitForSelector('#post-1');
  await expect
    .poll(() => renderedHighlights(page), { timeout: 8000 })
    .toMatchObject({ sky: [PASSAGE] });

  // Client-side navigation to another thread clears it; going back restores it.
  await page.click('#next');
  await expect.poll(() => renderedHighlights(page), { timeout: 5000 }).toMatchObject({ sky: [] });
  await page.goBack();
  await expect
    .poll(() => renderedHighlights(page), { timeout: 8000 })
    .toMatchObject({ sky: [PASSAGE] });

  // Never deleted, and not marked orphaned once found.
  const stored = await storedHighlights(ext);
  expect(stored).toHaveLength(1);
  expect(stored[0]!.orphaned).toBe(false);
  expect(ext.errors).toEqual([]);
});

test('marks a highlight orphaned (never deletes it) when its text is gone', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/spa.html`);
  await page.waitForSelector('#post-1');
  await activate(ext, page);
  await selectText(page, '#post-1', PASSAGE);
  await clickInShadow(page, { label: 'Highlight Pink' });
  await expect.poll(() => renderedHighlights(page)).toMatchObject({ pink: [PASSAGE] });

  // The thread changes for good: the passage is gone.
  await page.evaluate(() => {
    document.getElementById('post-1')!.textContent = 'This comment was deleted by its author.';
  });
  await expect
    .poll(async () => (await storedHighlights(ext))[0]?.orphaned, { timeout: 15_000 })
    .toBe(true);
  expect(await storedHighlights(ext)).toHaveLength(1);
});
