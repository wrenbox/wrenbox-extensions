/** Huefinch's own pages: onboarding, popup and settings, by keyboard and screen-reader semantics. */
import {
  ALL_SITES,
  LOCAL_ONLY,
  fixture,
  getSettings,
  setSettings,
  tabId,
  test,
  expect,
} from './helpers';

const STUDIO = 'Made by Wrenbox: small, private tools for your browser.';

test.describe('onboarding, before access is granted', () => {
  test.use({ origins: LOCAL_ONLY });

  test('tells the story, explains the access and shows one button; declining explains per-tab use', async ({
    ext,
  }) => {
    const page = await ext.ctx.newPage();
    // Stand in for the user clicking "Deny" in Chrome's permission prompt.
    await page.addInitScript(() => {
      chrome.permissions.request = (() =>
        Promise.resolve(false)) as typeof chrome.permissions.request;
    });
    await page.goto(ext.url('onboarding/onboarding.html'));
    await expect(
      page.getByText(/four kinds of color-sensing cells where we have three/),
    ).toBeVisible();
    await expect(
      page.getByText('to recolor the pages you visit; it never reads them.'),
    ).toBeVisible();
    await expect(page.getByText(STUDIO)).toBeVisible();
    await expect(page.locator('#ask').getByRole('button')).toHaveCount(1);
    const grant = page.getByRole('button', { name: 'Turn on for all websites' });
    await grant.click();
    await expect(page.getByText(/Huefinch still works one tab at a time/)).toBeVisible();
    expect(await ext.sw.evaluate(() => chrome.scripting.getRegisteredContentScripts())).toEqual([]);
    expect(ext.errors).toEqual([]);
  });
});

test.describe('with access', () => {
  test.use({ origins: ALL_SITES });

  test('onboarding confirms automatic mode and points to Find my setting', async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.goto(ext.url('onboarding/onboarding.html'));
    await expect(
      page.getByRole('heading', { name: 'Huefinch is on for every website' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find my setting' })).toHaveAttribute(
      'href',
      '../options/options.html#find',
    );
    expect(ext.errors).toEqual([]);
  });

  test('the popup works by keyboard and changes apply live', async ({ ext }) => {
    const site = await ext.ctx.newPage();
    await site.goto(fixture(ext, 'blocks.html'));
    const popup = await ext.ctx.newPage();
    await popup.goto(ext.url(`popup/popup.html?tab=${await tabId(ext, site)}`));

    const master = popup.getByRole('switch', { name: 'Huefinch' });
    await expect(master).toBeChecked();
    // State in words too, not only by color or position.
    await expect(master).toHaveAccessibleDescription('On');

    await popup.getByRole('radio', { name: /Green-weak/ }).focus();
    await popup.keyboard.press('ArrowDown');
    await expect(popup.getByRole('radio', { name: /Blue-weak/ })).toBeChecked();
    await expect.poll(async () => (await getSettings(ext)).type).toBe('tritan');

    await popup.locator('label', { hasText: 'Simulate' }).click();
    await expect(popup.getByRole('radio', { name: 'Simulate' })).toBeChecked();
    await expect(popup.getByText('Simulate this vision')).toBeVisible();
    await expect(popup.getByLabel('Severity: 100%')).toBeVisible();
    await expect.poll(async () => (await getSettings(ext)).mode).toBe('simulate');

    const slider = popup.getByRole('slider');
    await slider.focus();
    await popup.keyboard.press('ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuetext', '95%');
    await expect.poll(async () => (await getSettings(ext)).severity).toBe(95);

    await master.focus();
    await popup.keyboard.press('Space');
    await expect(master).not.toBeChecked();
    await expect(master).toHaveAccessibleDescription('Off');
    await expect(popup.getByText(/Huefinch is off everywhere/)).toBeVisible();
    await expect.poll(async () => (await getSettings(ext)).enabled).toBe(false);
    await expect(popup.getByText('Alt+Shift+F')).toBeVisible();
    expect(ext.errors).toEqual([]);
  });

  test('settings: sections, About and the shortcuts page', async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.goto(ext.url('options/options.html'));
    await expect(page.getByRole('heading', { name: 'Color vision' })).toBeVisible();
    for (const [link, heading] of [
      ['Websites', 'Websites'],
      ['Keyboard shortcuts', 'Keyboard shortcuts'],
      ['Find my setting', 'Find my setting'],
      ['About', 'About Huefinch'],
    ]) {
      await page.getByRole('navigation').getByRole('link', { name: link }).click();
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible();
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeFocused();
      await expect(page.getByRole('navigation').getByRole('link', { name: link })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
    await expect(page.getByText(/^Version \d+\.\d+\.\d+$/)).toBeVisible();
    await expect(page.getByText(STUDIO)).toBeVisible();
    await expect(page.locator('#about')).toContainText(
      'Machado, Manuel M. Oliveira and Leandro A. F. Fernandes (2009)',
    );
    await expect(page.locator('#about')).toContainText(
      'Onur Fidaner, Poliang Lin and Nevran Ozguven (2005)',
    );
    await expect(page.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      'https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy',
    );

    await page.getByRole('link', { name: 'Keyboard shortcuts' }).click();
    await expect(page.locator('#toggle-key')).toHaveText('Alt+Shift+F');
    const [shortcuts] = await Promise.all([
      ext.ctx.waitForEvent('page'),
      page.getByRole('button', { name: 'Open Chrome shortcuts' }).click(),
    ]);
    await expect.poll(() => shortcuts.url()).toBe('chrome://extensions/shortcuts');
    expect(ext.errors).toEqual([]);
  });

  test('Find my setting: mark pairs, take the suggestion, tune the strength', async ({ ext }) => {
    await setSettings(ext, { type: 'tritan', mode: 'simulate' });
    const page = await ext.ctx.newPage();
    await page.goto(ext.url('options/options.html#find'));
    await expect(page.locator('#find-note')).toContainText('comfort setting, not a medical test');
    const pairs = page.getByRole('button', { name: /^Pair \d: the two colors look alike$/ });
    await expect(pairs).toHaveCount(9);
    // Pairs 1 and 5 are protan pairs, pair 2 a deutan pair.
    for (const n of [1, 5, 2])
      await page.getByRole('button', { name: `Pair ${n}: the two colors look alike` }).click();
    await expect(
      page.getByRole('button', { name: 'Pair 1: the two colors look alike' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Suggested: Red-weak (protan)')).toBeVisible();
    await page.getByRole('button', { name: 'Use Red-weak' }).click();
    await expect
      .poll(async () => {
        const s = await getSettings(ext);
        return [s.mode, s.type];
      })
      .toEqual(['correct', 'protan']);
    const tune = page.locator('#tune');
    await expect(tune.getByLabel('Strength: 80%')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await getSettings(ext)).strength).toBe(90);
    // The tuned pairs are recolored with the chosen correction, live.
    await expect(page.locator('#tuned')).toHaveCSS('filter', /huefinch-tune/);
    expect(ext.errors).toEqual([]);
  });

  test('dark mode and reduced motion are respected', async ({ ext }) => {
    const page = await ext.ctx.newPage();
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(ext.url('options/options.html'));
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 30, 66)');
    await expect(page.locator('#master')).toHaveCSS('transition-duration', '0s');
    expect(ext.errors).toEqual([]);
  });
});
