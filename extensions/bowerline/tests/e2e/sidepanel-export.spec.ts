import { readFileSync } from 'node:fs';
import { backupFile, expect, importBackup, test } from './helpers';

const WEB = {
  id: 's1',
  kind: 'web',
  key: 'https://longread.example/why-we-forget',
  url: 'https://longread.example/why-we-forget',
  title: 'Why we forget most of what we read',
  createdAt: 1,
  updatedAt: 2,
};
const PDF = {
  id: 's2',
  kind: 'pdf',
  key: 'fingerprint-abc',
  url: '',
  title: 'Spaced retrieval study',
  fileName: 'spaced-retrieval-study.pdf',
  createdAt: 3,
  updatedAt: 4,
};
const q = (exact: string) => [{ type: 'TextQuoteSelector', exact, prefix: '', suffix: '' }];
const HL = [
  {
    id: 'h1',
    sourceId: 's1',
    color: 'yellow',
    text: 'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.',
    note: 'Good opening line for my essay intro.',
    selectors: q('x'),
    orphaned: false,
    createdAt: 10,
    updatedAt: 10,
  },
  {
    id: 'h2',
    sourceId: 's2',
    color: 'mint',
    text: 'The retrieval group retained 61% of key ideas at seven days.',
    note: 'Key statistic for the café talk.',
    selectors: q('x'),
    pdf: { page: 3, rects: [{ x: 1, y: 2, w: 3, h: 4 }] },
    orphaned: false,
    createdAt: 11,
    updatedAt: 11,
  },
  {
    id: 'h3',
    sourceId: 's2',
    color: 'pink',
    text: 'Spacing the sessions produced a further gain.',
    note: '',
    selectors: q('x'),
    pdf: { page: 4, rects: [] },
    orphaned: false,
    createdAt: 12,
    updatedAt: 12,
  },
];

test('side panel library search is case- and accent-insensitive, with colour filters', async ({
  ext,
}) => {
  await importBackup(ext, backupFile([WEB, PDF], HL));
  const panel = await ext.ctx.newPage();
  await panel.setViewportSize({ width: 400, height: 800 });
  await panel.goto(ext.url('sidepanel/sidepanel.html'));
  await panel.click('#tab-library');
  await expect(panel.locator('#summary')).toHaveText('3 highlights in 2 sources');

  await panel.fill('#q', 'RETRIEV');
  await expect(panel.locator('#summary')).toHaveText('2 matches in 2 sources');
  await expect(panel.locator('.hl-card mark').first()).toHaveText(/retriev/i);
  await expect(panel.locator('.group-kind')).toHaveText(['Web', 'PDF'].reverse());

  // Accent-insensitive across notes: "cafe" finds "café".
  await panel.fill('#q', 'cafe');
  await expect(panel.locator('#summary')).toHaveText('1 match in 1 source');
  await expect(panel.locator('.hl-note mark')).toHaveText('café');

  // Colour filter.
  await panel.fill('#q', '');
  await panel.click('.color-filter [data-color="pink"]');
  await expect(panel.locator('#summary')).toHaveText('1 match in 1 source');
  await expect(panel.locator('.hl-card')).toHaveCount(1);
  await panel.click('.all-colours');
  await expect(panel.locator('.hl-card')).toHaveCount(3);

  // Inline note editing.
  await panel.locator('.hl-card[data-id="h3"]').hover();
  await panel.locator('.hl-card[data-id="h3"] [aria-label="Add note"]').click();
  await panel.locator('.hl-card[data-id="h3"] textarea').fill('Spacing matters.');
  await panel.locator('.hl-card[data-id="h3"] button:has-text("Save")').click();
  await expect(panel.locator('.hl-card[data-id="h3"] .hl-note')).toHaveText('Spacing matters.');

  // Delete with undo.
  await panel.locator('.hl-card[data-id="h3"]').hover();
  await panel.locator('.hl-card[data-id="h3"] [aria-label="Delete highlight"]').click();
  await expect(panel.locator('#summary')).toHaveText('2 highlights in 2 sources');
  await panel.locator('.toast button:has-text("Undo")').click();
  await expect(panel.locator('#summary')).toHaveText('3 highlights in 2 sources');
  expect(ext.errors).toEqual([]);
});

test('exports Markdown from the library and downloads it as a file', async ({ ext }) => {
  await importBackup(ext, backupFile([WEB, PDF], HL));
  const lib = await ext.ctx.newPage();
  await lib.goto(ext.url('library/library.html'));
  await lib.click('#export');
  await lib.getByRole('radio', { name: /^Markdown/ }).click();
  await expect(lib.locator('.preview')).toContainText('# Bowerline highlights');
  const [download] = await Promise.all([
    lib.waitForEvent('download'),
    lib.click('button:has-text("Download .md file")'),
  ]);
  expect(download.suggestedFilename()).toMatch(/^bowerline-highlights-\d{4}-\d{2}-\d{2}\.md$/);
  const text = readFileSync((await download.path())!, 'utf8');
  expect(text).toContain('## Why we forget most of what we read');
  expect(text).toContain('Source: https://longread.example/why-we-forget');
  expect(text).toContain(
    '- The problem is rarely comprehension; it is that nothing asks us to retrieve what we read. (Yellow)',
  );
  expect(text).toContain('    - Good opening line for my essay intro.');
  expect(text).toContain(
    '- The retrieval group retained 61% of key ideas at seven days. (p. 3 · Mint)',
  );

  // Choose sources: only the PDF.
  await lib.click('.chip:has-text("Choose sources")');
  await expect(lib.locator('.preview')).toContainText('Choose at least one source.');
  await lib.check('label.pick:has-text("Spaced retrieval study") input');
  await expect(lib.locator('.preview')).toContainText('# Spaced retrieval study');
  await expect(lib.locator('.preview')).not.toContainText('Why we forget');
  expect(ext.errors).toEqual([]);
});
