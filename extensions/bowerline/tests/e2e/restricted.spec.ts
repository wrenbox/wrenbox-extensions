import type { Worker } from '@playwright/test';
import { activate, expect, test } from './helpers';

async function tabIdFor(ext: { sw: Worker }, match: string): Promise<number> {
  return ext.sw.evaluate(
    async (match) =>
      (await chrome.tabs.query({})).find((t) => (t.url ?? t.pendingUrl ?? '').includes(match))!.id!,
    match,
  );
}

test('the popup explains why Bowerline cannot run on Chrome pages', async ({ ext }) => {
  const chromePage = await ext.ctx.newPage();
  await chromePage.goto('chrome://version');
  // Without access, tab URLs are hidden; Chrome's own error message names the chrome:// tab.
  const tabId = await ext.sw.evaluate(async () => {
    for (const t of await chrome.tabs.query({})) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: t.id! }, func: () => 0 });
      } catch (e) {
        if (String(e).includes('chrome://')) return t.id;
      }
    }
    return undefined;
  });
  expect(tabId).toBeDefined();
  const popup = await ext.ctx.newPage();
  await popup.goto(ext.url(`popup/popup.html?tabId=${tabId}`));
  await expect(popup.locator('#status-title')).toHaveText("Bowerline can't run on this page");
  await expect(popup.locator('#status-sub')).toContainText(
    "Chrome doesn't let extensions run on its own pages",
  );
  await expect(popup.locator('#highlight')).toBeDisabled();
  await expect(popup.locator('#open-this-pdf')).toBeHidden();
  expect(ext.errors).toEqual([]);
});

test('the popup shows status, default colour and actions on a normal page', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);
  const popup = await ext.ctx.newPage();
  await popup.goto(ext.url(`popup/popup.html?tabId=${await tabIdFor(ext, '/article.html')}`));
  await expect(popup.locator('#status-title')).toHaveText('Active on this page');
  await expect(popup.locator('#status-sub')).toHaveText('Select text on the page to highlight it.');
  await expect(popup.getByRole('radio', { name: 'Yellow' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await popup.getByRole('radio', { name: 'Sky' }).click();
  await expect(popup.locator('#colour-name')).toHaveText('Sky');
  for (const name of [
    'Highlight this page',
    'Open side panel',
    'Open a PDF from your computer',
    'Settings',
  ]) {
    await expect(popup.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(popup.locator('#open-this-pdf')).toBeHidden();
  // Opening the popup injected Bowerline into the page.
  await expect.poll(() => page.evaluate(() => !!document.querySelector('bowerline-ui'))).toBe(true);
  expect(ext.errors).toEqual([]);
});

test('offers "Open this PDF in Bowerline" for a PDF tab', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);
  await page.evaluate(() => history.replaceState({}, '', '/papers/study.pdf'));
  const popup = await ext.ctx.newPage();
  await popup.goto(ext.url(`popup/popup.html?tabId=${await tabIdFor(ext, '/papers/study.pdf')}`));
  await expect(popup.getByRole('button', { name: 'Open this PDF in Bowerline' })).toBeVisible();
});

test('shows a short notice on canvas-rendered pages', async ({ ext }) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/canvas.html`);
  await page.bringToFront();
  await ext.sw.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url)!;
    const g = globalThis as unknown as {
      bowerline: { activateTab(t: chrome.tabs.Tab, o: object): Promise<unknown> };
    };
    await g.bowerline.activateTab(tab, { highlightSelection: true, announce: true });
  }, page.url());
  const cdp = await page.context().newCDPSession(page);
  await expect
    .poll(async () =>
      JSON.stringify((await cdp.send('DOM.getDocument', { depth: -1, pierce: true })).root),
    )
    .toContain('draws its text on a canvas');
  await activate(ext, page);
});
