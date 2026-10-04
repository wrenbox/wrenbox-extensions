import { STUDY_PDF, expect, selectAcross, selectText, storedHighlights, test } from './helpers';

test('highlights a PDF opened from the computer, then restores it by fingerprint when opened from a URL', async ({
  ext,
}) => {
  const viewer = await ext.ctx.newPage();
  await viewer.goto(ext.url('viewer/viewer.html'));
  await expect(viewer.getByRole('heading', { name: 'Open a PDF' })).toBeVisible();
  await viewer.setInputFiles('#file-input', {
    name: 'my-copy.pdf',
    mimeType: 'application/pdf',
    buffer: STUDY_PDF,
  });
  await viewer.waitForSelector('.page[data-page-number="2"] .textLayer span');
  await expect(viewer.locator('#page-count')).toHaveText('2');
  await expect(viewer.locator('#file-name')).toHaveText('my-copy.pdf');

  await selectText(
    viewer,
    '.page[data-page-number="2"] .textLayer',
    'The retrieval group retained 61%',
  );
  await viewer.keyboard.press('h');
  await expect(viewer.locator('.page[data-page-number="2"] .bl-hl')).toHaveCount(1);
  const [saved] = await storedHighlights(ext);
  expect(saved).toMatchObject({
    text: 'The retrieval group retained 61%',
    color: 'yellow',
    pdf: { page: 2 },
  });

  // N: highlight and add a note in one go.
  await selectText(
    viewer,
    '.page[data-page-number="2"] .textLayer',
    'Spacing the retrieval sessions',
  );
  await viewer.keyboard.press('n');
  await viewer.waitForTimeout(300);
  await viewer.keyboard.type('Second key finding.');
  await viewer.keyboard.press('Control+Enter');
  await expect(viewer.locator('.note-card')).toContainText('Second key finding.');
  await expect(viewer.locator('.thumb[data-page="2"] .thumb-dots span')).toHaveCount(1);

  // A selection that wraps onto the next line keeps the space between the lines.
  await selectAcross(
    viewer,
    '.page[data-page-number="2"] .textLayer',
    'compared with 38% for the restudy group.',
  );
  await viewer.keyboard.press('h');
  await expect
    .poll(async () => (await storedHighlights(ext)).map((h) => h.text))
    .toContain('compared with 38% for the restudy group.');

  // Overlays follow the zoom.
  const before = await viewer.locator('.bl-hl').first().boundingBox();
  await viewer.keyboard.press('+');
  await expect
    .poll(async () => (await viewer.locator('.bl-hl').first().boundingBox())?.width ?? 0)
    .toBeGreaterThan(before!.width * 1.05);

  // The same file from a different place (a URL, a different name) shows the same highlights.
  const again = await ext.ctx.newPage();
  await again.goto(
    ext.url(`viewer/viewer.html?src=${encodeURIComponent(`${ext.server.url}/cors/renamed.pdf`)}`),
  );
  await again.waitForSelector('.page[data-page-number="2"] .textLayer span');
  await expect(again.locator('.page[data-page-number="2"] .bl-hl')).toHaveCount(4);
  await expect(again.locator('.note-card')).toContainText('Second key finding.');

  // One source, keyed by fingerprint, now with the URL recorded.
  const lib = await ext.ctx.newPage();
  await lib.goto(ext.url('library/library.html'));
  await expect(lib.locator('.group')).toHaveCount(1);
  await expect(lib.locator('.group-kind')).toHaveText('PDF');
  expect(ext.errors).toEqual([]);
});

test('explains a blocked PDF and offers to allow access or open a downloaded file', async ({
  ext,
}) => {
  const viewer = await ext.ctx.newPage();
  // 127.0.0.1 is granted in tests, so use "localhost": same server, no access, no CORS.
  const url = `${ext.server.url.replace('127.0.0.1', 'localhost')}/nocors/study.pdf`;
  await viewer.goto(ext.url(`viewer/viewer.html?src=${encodeURIComponent(url)}`));
  await expect(
    viewer.getByRole('heading', { name: "Bowerline couldn't open this PDF" }),
  ).toBeVisible();
  await expect(
    viewer.getByRole('button', { name: 'Allow Bowerline to open this PDF' }),
  ).toBeVisible();
  await expect(viewer.getByText('then open the file here.')).toBeVisible();
  await expect(viewer.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute('href', url);
  // A CORS failure is logged by Chrome as a console error; nothing else should be.
  expect(ext.errors.filter((e) => !/CORS|Failed to fetch|ERR_FAILED/.test(e))).toEqual([]);
});

test('opens the bundled sample PDF without any network access', async ({ ext }) => {
  const viewer = await ext.ctx.newPage();
  await viewer.goto(ext.url('viewer/viewer.html?sample=1'));
  await viewer.waitForSelector('.page[data-page-number="1"] .textLayer span');
  await expect(viewer.locator('#page-count')).toHaveText('3');
  expect(ext.errors).toEqual([]);
});
