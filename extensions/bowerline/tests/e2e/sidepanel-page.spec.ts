import {
  activate,
  backupFile,
  expect,
  importBackup,
  renderedHighlights,
  selectText,
  test,
} from './helpers';

test('side panel "This page" lists found highlights, a "Not found" section, and jumps to a passage', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.setViewportSize({ width: 900, height: 500 });
  await page.goto(`${ext.server.url}/article.html`);
  const key = page.url();
  // A highlight whose text is no longer on the page.
  await importBackup(
    ext,
    backupFile(
      [
        {
          id: 'art',
          kind: 'web',
          key,
          url: key,
          title: 'Why we forget most of what we read',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      [
        {
          id: 'gone',
          sourceId: 'art',
          color: 'sky',
          text: 'A paragraph the author later removed.',
          note: '',
          selectors: [
            {
              type: 'TextQuoteSelector',
              exact: 'A paragraph the author later removed.',
              prefix: '',
              suffix: '',
            },
          ],
          orphaned: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    ),
  );
  await activate(ext, page);
  await selectText(page, '#p5', 'Context tells the copies apart.');
  await activate(ext, page, true);
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ yellow: ['Context tells the copies apart.'] });

  const tabId = await ext.sw.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)!.id!,
    page.url(),
  );
  const panel = await ext.ctx.newPage();
  await panel.setViewportSize({ width: 400, height: 800 });
  await panel.goto(ext.url(`sidepanel/sidepanel.html?tabId=${tabId}`));
  await expect(panel.locator('#list .hl-card')).toHaveCount(1);
  await expect(panel.locator('#list .hl-card')).toContainText('Context tells the copies apart.');
  await expect(panel.locator('#orphans')).toBeVisible();
  await expect(panel.locator('#orphans h2')).toHaveText('Not found on this page');
  await expect(panel.locator('#orphan-list .hl-card')).toContainText(
    'A paragraph the author later removed.',
  );

  // Clicking a card focuses the page and scrolls to the passage.
  await page.evaluate(() => window.scrollTo(0, 0));
  await panel.locator('#list .hl-main').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => CSS.highlights.has('bowerline-focus'))).toBe(true);
  expect(ext.errors).toEqual([]);
});
