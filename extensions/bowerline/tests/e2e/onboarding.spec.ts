import {
  clickInShadow,
  expect,
  libraryCount,
  renderedHighlights,
  selectText,
  test,
} from './helpers';

test('onboarding: the demo paragraph works without permissions and saves nothing', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.goto(ext.url('onboarding/onboarding.html'));
  await expect(page.getByRole('heading', { name: 'Try it right here' })).toBeVisible();
  await expect(
    page.getByText('Made by Wrenbox: small, private tools for your browser.'),
  ).toBeVisible();
  await expect(page.getByText(/BOW-er-line/)).toBeVisible();
  // The seeded example highlight is shown.
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ mint: ['strengthens it far more than reading it again'] });

  await selectText(page, '#demo', 'nothing asks us to retrieve what we read');
  await clickInShadow(page, { label: 'Highlight Yellow' });
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ yellow: ['nothing asks us to retrieve what we read'] });
  await expect(page.locator('#demo-status')).toContainText('1 highlight so far');
  expect(await libraryCount(ext)).toBe(0);

  await expect(page.getByRole('button', { name: 'Open a PDF from your computer' })).toBeVisible();
  await expect(
    page.getByRole('switch', { name: /Show my highlights automatically/ }),
  ).not.toBeChecked();
  expect(ext.errors).toEqual([]);
});
