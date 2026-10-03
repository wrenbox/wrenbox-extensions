import type { Worker } from '@playwright/test';
import {
  ALWAYS_ON,
  clickInShadow,
  expect,
  renderedHighlights,
  selectText,
  storedHighlights,
  test,
} from './helpers';

const registered = (ext: { sw: Worker }) =>
  ext.sw.evaluate(async () =>
    (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id),
  );

test.describe('when the user has granted Always on', () => {
  // Granting in the profile is the test equivalent of accepting Chrome's prompt.
  test.use({ origins: ALWAYS_ON });

  test('restores highlights automatically on revisit, and revoking in Settings turns it off', async ({
    ext,
  }) => {
    await expect.poll(() => registered(ext)).toEqual(['bowerline-always-on']);

    const page = await ext.ctx.newPage();
    await page.goto(`${ext.server.url}/article.html`);
    // No toolbar click or shortcut: the registered content script runs by itself.
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('bowerline-ui')))
      .toBe(true);
    await page.waitForTimeout(300);
    await selectText(page, '#p4', 'A highlight that disappears is a promise broken.');
    await clickInShadow(page, { label: 'Highlight Pink' });
    await expect.poll(async () => (await storedHighlights(ext)).length).toBe(1);

    await page.reload();
    await expect
      .poll(() => renderedHighlights(page))
      .toMatchObject({ pink: ['A highlight that disappears is a promise broken.'] });

    const settings = await ext.ctx.newPage();
    await settings.goto(ext.url('options/options.html#data'));
    await expect(settings.locator('#always-on')).toBeChecked();
    await settings.click('label[for=always-on]');
    await expect(settings.locator('#always-on')).not.toBeChecked();
    await expect.poll(() => registered(ext)).toEqual([]);

    await page.reload();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => !!document.querySelector('bowerline-ui'))).toBe(false);
    expect(ext.errors).toEqual([]);
  });
});

test('turning Always on requests exactly the optional host permissions', async ({ ext }) => {
  await ext.ctx.addInitScript(() => {
    if (!location.href.includes('/options/')) return;
    const w = window as unknown as { __requested: unknown[] };
    w.__requested = [];
    chrome.permissions.request = (async (p: chrome.permissions.Permissions) => {
      w.__requested.push(p);
      return false; // the user clicks "Cancel" on Chrome's prompt
    }) as typeof chrome.permissions.request;
  });
  const settings = await ext.ctx.newPage();
  await settings.goto(ext.url('options/options.html#data'));
  await expect(settings.locator('#always-on')).not.toBeChecked();
  await settings.click('label[for=always-on]');
  await expect(settings.locator('.toast')).toContainText("permission wasn't granted");
  await expect(settings.locator('#always-on')).not.toBeChecked();
  const requested = await settings.evaluate(
    () => (window as unknown as { __requested: unknown[] }).__requested,
  );
  expect(requested).toEqual([{ origins: ['https://*/*', 'http://*/*'] }]);
  expect(await registered(ext)).toEqual([]);
});
