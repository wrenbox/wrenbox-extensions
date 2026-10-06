/**
 * How Huefinch gets onto pages: automatically with "all websites" access, or
 * one tab at a time through activeTab when the user declined.
 */
import {
  ALL_SITES,
  LOCAL_ONLY,
  activate,
  api,
  filterState,
  fixture,
  matrixOf,
  tabId,
  test,
  expect,
  waitForFilter,
} from './helpers';

const M = matrixOf({ mode: 'correct', type: 'deutan', amount: 80 });

test.describe('with access to all websites', () => {
  test.use({ origins: ALL_SITES });

  test('the content script is registered at document_start, top frame only, across sessions', async ({
    ext,
  }) => {
    const scripts = await ext.sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
    expect(scripts[0]?.matches).toHaveLength(2);
    expect(scripts).toEqual([
      expect.objectContaining({
        id: 'huefinch-filter',
        // Current mode, type and amount first (so the first frame is right), then the script.
        js: [
          'content/initial/mode-correct.js',
          'content/initial/type-deutan.js',
          'content/initial/amount-80.js',
          'content/content.js',
        ],
        matches: expect.arrayContaining(['https://*/*', 'http://*/*']),
        runAt: 'document_start',
        allFrames: false,
        persistAcrossSessions: true,
      }),
    ]);
  });

  test('the registration follows the settings and leaves off-listed sites alone', async ({
    ext,
  }) => {
    await ext.sw.evaluate(() =>
      chrome.storage.local.set({
        mode: 'simulate',
        type: 'tritan',
        severity: 60,
        offSites: ['photos.example.com'],
      }),
    );
    await expect
      .poll(
        async () =>
          (await ext.sw.evaluate(() => chrome.scripting.getRegisteredContentScripts()))[0],
      )
      .toMatchObject({
        js: [
          'content/initial/mode-simulate.js',
          'content/initial/type-tritan.js',
          'content/initial/amount-60.js',
          'content/content.js',
        ],
        excludeMatches: ['*://photos.example.com/*', '*://www.photos.example.com/*'],
      });
    await ext.sw.evaluate(() => chrome.storage.local.set({ enabled: false, offSites: [] }));
    await expect
      .poll(async () => {
        const [s] = await ext.sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
        return [s?.js?.[0], s?.excludeMatches ?? []];
      })
      .toEqual(['content/initial/mode-off.js', []]);
  });

  test('removing the permission unregisters the script and updates the settings page', async ({
    ext,
  }) => {
    const options = await ext.ctx.newPage();
    await options.goto(ext.url('options/options.html#websites'));
    const auto = options.getByRole('switch', { name: 'Turn on automatically on every website' });
    await expect(auto).toBeChecked();

    await ext.sw.evaluate((o) => chrome.permissions.remove({ origins: o }), ALL_SITES);
    await expect
      .poll(() => ext.sw.evaluate(() => chrome.scripting.getRegisteredContentScripts()))
      .toEqual([]);
    await expect(auto).not.toBeChecked();

    const page = await ext.ctx.newPage();
    await page.goto(fixture(ext, 'blocks.html'));
    await page.waitForTimeout(400);
    expect((await filterState(page)).roots).toBe(0);
  });

  test('Alt+Shift+F turns Huefinch off and on everywhere, and grays the icon', async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.goto(fixture(ext, 'blocks.html'));
    await waitForFilter(page, M);
    expect(await api<boolean>(ext, 'toggle')).toBe(false);
    await waitForFilter(page, null);
    await expect
      .poll(() => ext.sw.evaluate(() => chrome.action.getTitle({})))
      .toBe('Huefinch (off)');
    expect(await api<boolean>(ext, 'toggle')).toBe(true);
    await waitForFilter(page, M);
    await expect.poll(() => ext.sw.evaluate(() => chrome.action.getTitle({}))).toBe('Huefinch');
    const commands = await ext.sw.evaluate(() => chrome.commands.getAll());
    expect(commands.find((c) => c.name === 'toggle-huefinch')?.shortcut).toBe('Alt+Shift+F');
  });
});

test.describe('after declining website access', () => {
  test.use({ origins: LOCAL_ONLY });

  test('nothing runs until the icon is clicked; then this tab is recolored until it navigates', async ({
    ext,
  }) => {
    expect(await ext.sw.evaluate(() => chrome.scripting.getRegisteredContentScripts())).toEqual([]);
    const page = await ext.ctx.newPage();
    await page.goto(fixture(ext, 'blocks.html'));
    await page.waitForTimeout(400);
    expect((await filterState(page)).roots).toBe(0);

    // A click on the toolbar icon (activeTab).
    expect(await activate(ext, page)).toEqual({ ok: true });
    await waitForFilter(page, M);
    // Clicking again doesn't inject a second copy.
    expect(await activate(ext, page)).toEqual({ ok: true });
    expect((await filterState(page)).roots).toBe(1);

    await page.reload();
    await page.waitForTimeout(400);
    expect((await filterState(page)).roots).toBe(0);
    expect(ext.errors).toEqual([]);
  });

  test('the popup recolors the tab and explains how to turn on automatic mode', async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.goto(fixture(ext, 'blocks.html'));
    const id = await tabId(ext, page);
    const popup = await ext.ctx.newPage();
    await popup.goto(ext.url(`popup/popup.html?tab=${id}`));
    await expect(
      popup.getByText('Huefinch is on for this tab until you leave the page.'),
    ).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Turn on for all websites' })).toBeVisible();
    await waitForFilter(page, M);
    expect(ext.errors).toEqual([]);
  });

  test('Chrome’s own pages are explained, not attempted', async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.goto('chrome://version');
    await page.bringToFront();
    // The URL of a chrome:// tab is hidden without access, so find it as the active tab.
    const id = await ext.sw.evaluate(
      async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id ?? -1,
    );
    const popup = await ext.ctx.newPage();
    await popup.goto(ext.url(`popup/popup.html?tab=${id}`));
    await expect(
      popup.getByText(/Huefinch can’t reach this tab|doesn’t let extensions change this page/),
    ).toBeVisible();
    await expect(popup.getByRole('switch', { name: 'On for this site' })).toBeDisabled();
    await expect(popup.getByRole('button', { name: 'Identify a color' })).toBeDisabled();
  });
});
