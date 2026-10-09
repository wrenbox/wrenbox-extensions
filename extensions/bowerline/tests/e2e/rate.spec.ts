import type { Page } from '@playwright/test';
import { backupFile, expect, importBackup, test, type Ext } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const SOURCE = {
  id: 's1',
  kind: 'web',
  key: 'https://longread.example/a',
  url: 'https://longread.example/a',
  title: 'A long read',
  createdAt: 1,
  updatedAt: 1,
};
const highlights = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    sourceId: 's1',
    color: 'yellow',
    text: `Passage ${i}`,
    note: '',
    selectors: [{ type: 'TextQuoteSelector', exact: `Passage ${i}`, prefix: '', suffix: '' }],
    orphaned: false,
    createdAt: 10 + i,
    updatedAt: 10 + i,
  }));

/** A store install: its update URL names the Chrome Web Store (unpacked copies have none). */
async function asStoreInstall(ext: Ext): Promise<void> {
  await ext.ctx.addInitScript(() => {
    if (location.protocol !== 'chrome-extension:') return;
    chrome.management.getSelf = (async () => ({
      updateUrl: 'https://clients2.google.com/service/update2/crx',
    })) as unknown as typeof chrome.management.getSelf;
    // Remember what the page opens (the store itself can't be loaded offline).
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = (async (props: chrome.tabs.CreateProperties) => {
      await chrome.storage.local.set({ 'test:opened': props.url });
      return create(props);
    }) as typeof chrome.tabs.create;
  });
}

async function firstSeen(ext: Ext, daysAgo: number): Promise<void> {
  await ext.sw.evaluate(
    (t) => chrome.storage.local.set({ ratePrompt: { firstSeen: t } }),
    Date.now() - daysAgo * DAY,
  );
}

async function popupFor(ext: Ext, page: Page): Promise<Page> {
  const tabId = await ext.sw.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)!.id!,
    page.url(),
  );
  const popup = await ext.ctx.newPage();
  await popup.goto(ext.url(`popup/popup.html?tabId=${tabId}`));
  await expect(popup.locator('#status-title')).toHaveText('Active on this page');
  return popup;
}

test('asks for a rating once, after three days and ten highlights, and never again', async ({
  ext,
}) => {
  await asStoreInstall(ext);
  await importBackup(ext, backupFile([SOURCE], highlights(10)));
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);

  await firstSeen(ext, 2); // too soon
  let popup = await popupFor(ext, page);
  await popup.waitForTimeout(500);
  await expect(popup.locator('#rate')).toBeHidden();
  await popup.close();

  await firstSeen(ext, 4);
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeVisible();
  await expect(popup.locator('#rate')).toContainText(
    'A rating on the Chrome Web Store helps other readers find it.',
  );
  await popup.getByRole('button', { name: 'Rate Bowerline' }).click();
  await expect
    .poll(() =>
      ext.sw.evaluate(async () => (await chrome.storage.local.get('test:opened'))['test:opened']),
    )
    .toBe(`https://chromewebstore.google.com/detail/${ext.id}/reviews`);

  // Answered: it never comes back.
  popup = await popupFor(ext, page);
  await popup.waitForTimeout(500);
  await expect(popup.locator('#rate')).toBeHidden();
  expect(
    await ext.sw.evaluate(
      async () =>
        ((await chrome.storage.local.get('ratePrompt')).ratePrompt as { done?: boolean }).done,
    ),
  ).toBe(true);
});

test('"No thanks" closes it for good, and light users are never asked', async ({ ext }) => {
  await asStoreInstall(ext);
  await importBackup(ext, backupFile([SOURCE], highlights(9)));
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);
  await firstSeen(ext, 30);
  let popup = await popupFor(ext, page);
  await popup.waitForTimeout(500);
  await expect(popup.locator('#rate')).toBeHidden(); // 9 highlights

  await importBackup(ext, backupFile([SOURCE], highlights(12)));
  await popup.close();
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeVisible();
  await popup.getByRole('button', { name: 'No thanks' }).click();
  await expect(popup.locator('#rate')).toBeHidden();
  await popup.close();
  popup = await popupFor(ext, page);
  await popup.waitForTimeout(500);
  await expect(popup.locator('#rate')).toBeHidden();

  // Settings → About keeps a quiet "Rate Bowerline" link for anyone who wants it later.
  const settings = await ext.ctx.newPage();
  await settings.goto(ext.url('options/options.html#about'));
  await expect(settings.locator('#rate-link')).toHaveAttribute(
    'href',
    `https://chromewebstore.google.com/detail/${ext.id}/reviews`,
  );
  await expect(settings.locator('#rate-item')).toContainText(
    'Rate Bowerline on the Chrome Web Store',
  );
  expect(ext.errors).toEqual([]);
});
