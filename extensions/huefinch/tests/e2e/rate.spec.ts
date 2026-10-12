import type { Page } from '@playwright/test';
import {
  expect,
  fixture,
  setSettings,
  tabId,
  test,
  waitForFilter,
  matrixOf,
  type Ext,
} from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });

/** A store install: its update URL names the store (unpacked copies have none). */
async function asStoreInstall(ext: Ext, updateUrl: string): Promise<void> {
  await ext.ctx.addInitScript((url) => {
    if (location.protocol !== 'chrome-extension:') return;
    chrome.management.getSelf = (async () => ({
      updateUrl: url,
    })) as unknown as typeof chrome.management.getSelf;
    // Remember what the page opens (the store itself can't be loaded offline).
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = (async (props: chrome.tabs.CreateProperties) => {
      await chrome.storage.local.set({ 'test:opened': props.url });
      return create(props);
    }) as typeof chrome.tabs.create;
  }, updateUrl);
}

async function reminder(ext: Ext, daysAgo: number, opens: number): Promise<void> {
  await ext.sw.evaluate(
    ([t, n]) => chrome.storage.local.set({ ratePrompt: { firstSeen: t, opens: n } }),
    [Date.now() - daysAgo * DAY, opens] as const,
  );
}

async function stored(ext: Ext, key: string): Promise<unknown> {
  return ext.sw.evaluate(async (k) => (await chrome.storage.local.get(k))[k], key);
}

/** Opens the popup for a page and waits until it has finished starting up. */
async function popupFor(ext: Ext, page: Page): Promise<Page> {
  const id = await tabId(ext, page);
  const popup = await ext.ctx.newPage();
  await popup.goto(ext.url(`popup/popup.html?tab=${id}`));
  await expect(popup.getByRole('switch', { name: 'On for this site' })).toBeEnabled();
  await popup.waitForTimeout(400);
  return popup;
}

test('asks once, after three days and five opens, while Huefinch recolors the page', async ({
  ext,
}) => {
  await asStoreInstall(ext, 'https://clients2.google.com/service/update2/crx');
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);

  // The first open starts the clock; on its own it never asks.
  let popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();
  expect(await stored(ext, 'ratePrompt')).toMatchObject({ opens: 1 });
  await popup.close();

  await reminder(ext, 2, 10); // regular, but too soon
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();
  await popup.close();

  await reminder(ext, 4, 3); // this is the fourth open: not yet
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();
  await popup.close();

  // Fifth open, days later, Huefinch working on this page: ask.
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeVisible();
  await expect(popup.locator('#rate')).toContainText(
    'A rating on the Chrome Web Store helps others who see colors differently find it.',
  );
  await popup.getByRole('button', { name: 'Rate Huefinch' }).click();
  await expect
    .poll(() => stored(ext, 'test:opened'))
    .toBe(`https://chromewebstore.google.com/detail/${ext.id}/reviews`);
  expect(await stored(ext, 'ratePrompt')).toMatchObject({ done: true });

  // Answered: it never comes back.
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();
  expect(ext.errors).toEqual([]);
});

test('never asks while Huefinch is off for the page; "No thanks" is for good', async ({ ext }) => {
  await asStoreInstall(ext, 'https://edge.microsoft.com/extensionwebstorebase/v1/crx');
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);
  await reminder(ext, 30, 30);

  // Off for this site: nothing to rate on this page, so no request.
  await setSettings(ext, { offSites: ['127.0.0.1'] });
  let popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();
  await popup.close();
  await setSettings(ext, { offSites: [] });

  // Installed from Edge Add-ons: the request names it.
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toContainText('A rating on Edge Add-ons helps');
  await popup.getByRole('button', { name: 'No thanks' }).click();
  await expect(popup.locator('#rate')).toBeHidden();
  expect(await stored(ext, 'test:opened')).toBeUndefined();
  await popup.close();
  popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();

  // Settings → About keeps a quiet link for anyone who wants it later.
  const settings = await ext.ctx.newPage();
  await settings.goto(ext.url('options/options.html#about'));
  await expect(settings.locator('#rate-link')).toHaveAttribute(
    'href',
    `https://microsoftedge.microsoft.com/addons/detail/${ext.id}`,
  );
  await expect(settings.locator('#rate-item')).toHaveText('Rate Huefinch on Edge Add-ons');
  expect(ext.errors).toEqual([]);
});

test('an unpacked copy never asks and shows no rating link', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(fixture(ext, 'blocks.html'));
  await waitForFilter(page, M);
  await reminder(ext, 30, 30);
  const popup = await popupFor(ext, page);
  await expect(popup.locator('#rate')).toBeHidden();
  const settings = await ext.ctx.newPage();
  await settings.goto(ext.url('options/options.html#about'));
  await expect(settings.locator('#about-privacy')).toBeVisible();
  await expect(settings.locator('#rate-item')).toBeHidden();
  expect(ext.errors).toEqual([]);
});
