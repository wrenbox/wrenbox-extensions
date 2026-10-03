import {
  activate,
  clickInShadow,
  expect,
  renderedHighlights,
  selectText,
  shadowHas,
  storedHighlights,
  test,
} from './helpers';

test('adds a note from the selection toolbar, then edits it from the highlight', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);
  await activate(ext, page);

  await selectText(page, '#p3', 'mark only what you would want to explain to a friend');
  await clickInShadow(page, { text: 'Add note' });
  await page.waitForTimeout(200);
  await page.keyboard.type('My rule for highlighting.');
  await page.keyboard.press('Control+Enter');
  await expect
    .poll(async () => (await storedHighlights(ext))[0]?.note)
    .toBe('My rule for highlighting.');
  // Default colour is yellow; the note gets a marker.
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ yellow: ['mark only what you would want to explain to a friend'] });
  await expect.poll(() => shadowHas(page, { label: 'Note: My rule for highlighting.' })).toBe(true);

  // Click the highlight → edit toolbar → Edit note.
  const point = await page.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')!][0] as Range;
    const rect = r.getClientRects()[0]!;
    return { x: rect.left + 20, y: rect.top + rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await clickInShadow(page, { text: 'Edit note' });
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Explain it to a friend, then revisit.');
  await clickInShadow(page, { text: 'Save note' });
  await expect
    .poll(async () => (await storedHighlights(ext))[0]?.note)
    .toBe('Explain it to a friend, then revisit.');

  // Change colour from the edit toolbar.
  await page.mouse.click(point.x, point.y);
  await clickInShadow(page, { label: 'Change colour to Pink' });
  await expect.poll(async () => (await storedHighlights(ext))[0]?.color).toBe('pink');
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ pink: ['mark only what you would want to explain to a friend'], yellow: [] });

  // Delete, then undo.
  await page.mouse.click(point.x, point.y);
  await clickInShadow(page, { text: 'Delete' });
  await expect.poll(async () => (await storedHighlights(ext)).length).toBe(0);
  await clickInShadow(page, { text: 'Undo' });
  await expect.poll(async () => (await storedHighlights(ext)).length).toBe(1);
  await expect
    .poll(() => renderedHighlights(page))
    .toMatchObject({ pink: ['mark only what you would want to explain to a friend'] });
  expect(ext.errors).toEqual([]);
});

test('never highlights inside a textarea, and disambiguates repeated sentences', async ({
  ext,
}) => {
  const page = await ext.ctx.newPage();
  await page.goto(`${ext.server.url}/article.html`);
  await activate(ext, page);
  await page.evaluate(() => {
    const ta = document.getElementById('comment') as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(0, 10);
  });
  await page.waitForTimeout(400);
  expect(await shadowHas(page, { text: 'Add note' })).toBe(false);

  // Second copy of a repeated sentence.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await selectText(page, '#p5', 'The same sentence can appear twice on a page.', 1);
  await activate(ext, page, true);
  await page.reload();
  await activate(ext, page);
  const offset = await page.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')!][0] as Range;
    return r.startOffset;
  });
  const secondAt = await page.evaluate(() =>
    document.getElementById('p5')!.textContent!.lastIndexOf('The same sentence'),
  );
  expect(offset).toBe(secondAt);
});
