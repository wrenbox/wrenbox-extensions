import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { activate, clickInShadow, selectText, test, type Ext } from '../e2e/helpers';
import { OUTPUT } from '../e2e/paths';

const OUT = join(OUTPUT, 'screens');
mkdirSync(OUT, { recursive: true });

async function setDefault(ext: Ext, color: string) {
  await ext.sw.evaluate(async (color) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...(settings ?? {}), defaultColor: color } });
  }, color);
}

async function hl(ext: Ext, page: Page, sel: string, text: string, color: string) {
  await setDefault(ext, color);
  await selectText(page, sel, text);
  await activate(ext, page, true);
}

async function seedArticle(ext: Ext): Promise<Page> {
  const page = await ext.ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${ext.server.url}/article.html`);
  await activate(ext, page);
  await hl(
    ext,
    page,
    '#p1',
    'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.',
    'yellow',
  );
  await hl(
    ext,
    page,
    '#p2',
    'Pulling an idea back out of memory, even imperfectly, strengthens it far more than reading it again.',
    'mint',
  );
  await hl(
    ext,
    page,
    '#p2',
    'What helps is returning to the highlights later and testing yourself on them.',
    'sky',
  );
  await hl(ext, page, '#p3', 'a day, a week and a month later.', 'pink');
  await setDefault(ext, 'yellow');
  return page;
}

test('capture screens', async ({ ext }) => {
  // 1. Web highlighting with the selection toolbar
  const page = await seedArticle(ext);
  await page.mouse.move(10, 10);
  await selectText(page, '#p2', 'Researchers have repeated the same finding for decades.');
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, '1-web-toolbar.png') });

  // Note on the first highlight, then hover its marker
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const box = await page.locator('#p1').boundingBox();
  await page.mouse.click(box!.x + box!.width - 120, box!.y + 52);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '1b-web-edit-toolbar.png') });
  await clickInShadow(page, { text: 'Add note' });
  await page.keyboard.type('Good opening line for my essay intro.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, '1c-web-note-editor.png') });
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '1d-web-note-marker.png') });
  const markerBox = await page.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')!][0] as Range;
    const rects = r.getClientRects();
    const last = rects[rects.length - 1]!;
    return { x: last.right + 2, y: last.top - 2 };
  });
  await page.mouse.move(markerBox.x, markerBox.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, '1e-web-note-card.png') });

  // 2. PDF viewer
  const viewer = await ext.ctx.newPage();
  await viewer.setViewportSize({ width: 1280, height: 800 });
  await viewer.goto(
    ext.url(`viewer/viewer.html?src=${encodeURIComponent(`${ext.server.url}/cors/study.pdf`)}`),
  );
  await viewer.waitForSelector('.textLayer span');
  await viewer.waitForTimeout(800);
  await selectText(
    viewer,
    '.page[data-page-number="2"] .textLayer',
    'The retrieval group retained 61%',
  );
  await viewer.keyboard.press('h');
  await selectText(
    viewer,
    '.page[data-page-number="2"] .textLayer',
    'Spacing the retrieval sessions',
  );
  await viewer.keyboard.press('n');
  await viewer.waitForTimeout(400);
  await viewer.keyboard.type('Key statistic. Quote this in section 2 of my report.');
  await viewer.keyboard.press('Control+Enter');
  await viewer.evaluate(() => {
    const page = document.querySelector<HTMLElement>('.page[data-page-number="2"]')!;
    document.getElementById('viewerContainer')!.scrollTop = page.offsetTop - 16;
  });
  await viewer.waitForTimeout(500);
  await viewer.screenshot({ path: join(OUT, '2-pdf-viewer.png') });

  // 3. Side panel and library
  const panel = await ext.ctx.newPage();
  await panel.setViewportSize({ width: 400, height: 800 });
  await panel.goto(ext.url('sidepanel/sidepanel.html'));
  await panel.click('#tab-library');
  await panel.fill('#q', 'retriev');
  await panel.waitForTimeout(300);
  await panel.screenshot({ path: join(OUT, '3-sidepanel-library.png') });

  const lib = await ext.ctx.newPage();
  await lib.setViewportSize({ width: 1280, height: 800 });
  await lib.goto(ext.url('library/library.html'));
  await lib.waitForTimeout(300);
  await lib.screenshot({ path: join(OUT, '3b-library.png') });

  // 4. Export dialog
  await lib.click('#export');
  await lib.waitForTimeout(300);
  await lib.screenshot({ path: join(OUT, '4-export.png') });

  // 5. Settings: your data
  const opts = await ext.ctx.newPage();
  await opts.setViewportSize({ width: 1280, height: 800 });
  await opts.goto(ext.url('options/options.html#data'));
  await opts.waitForTimeout(300);
  await opts.screenshot({ path: join(OUT, '5-settings-data.png') });
  for (const s of ['general', 'colours', 'shortcuts', 'about']) {
    await opts.goto(ext.url(`options/options.html#${s}`));
    await opts.waitForTimeout(200);
    await opts.screenshot({ path: join(OUT, `5-settings-${s}.png`) });
  }

  // Popup and onboarding
  const popup = await ext.ctx.newPage();
  await popup.setViewportSize({ width: 340, height: 520 });
  const tabId = await ext.sw.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)?.id,
    page.url(),
  );
  await popup.goto(ext.url(`popup/popup.html?tabId=${tabId}`));
  await popup.waitForTimeout(600);
  await popup.screenshot({ path: join(OUT, '6-popup.png') });

  const onboarding = await ext.ctx.newPage();
  await onboarding.setViewportSize({ width: 1280, height: 800 });
  await onboarding.goto(ext.url('onboarding/onboarding.html'));
  await onboarding.waitForTimeout(400);
  await onboarding.screenshot({ path: join(OUT, '7-onboarding.png'), fullPage: true });

  const empty = await ext.ctx.newPage();
  await empty.setViewportSize({ width: 1280, height: 800 });
  await empty.goto(ext.url('viewer/viewer.html'));
  await empty.waitForTimeout(300);
  await empty.screenshot({ path: join(OUT, '8-viewer-open.png') });

  console.log('errors:', JSON.stringify(ext.errors, null, 1));
});
