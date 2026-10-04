/**
 * Generates the five Chrome Web Store screenshots (1280×800) from the real,
 * built extension, framed like the designed mockups in store-assets/.
 * Output: store-assets/captured/. Run with `npm run store-screenshots`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { activate, clickInShadow, selectAcross, selectText, test, type Ext } from '../e2e/helpers';
import { ROOT } from '../e2e/paths';
import { samplePdf } from '../../scripts/lib/sample-pdf.mjs';
import { CONTENT_HEIGHT, frameHtml, WINDOW, type FrameSpec } from './frame';

const OUT = join(ROOT, 'store-assets/captured');
mkdirSync(OUT, { recursive: true });
const PANE_HEIGHT = CONTENT_HEIGHT; // the visible part of the window

async function setDefault(ext: Ext, color: string): Promise<void> {
  await ext.sw.evaluate(async (color) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...(settings ?? {}), defaultColor: color } });
  }, color);
}

async function highlightWeb(
  ext: Ext,
  page: Page,
  sel: string,
  text: string,
  color: string,
): Promise<void> {
  await setDefault(ext, color);
  await selectText(page, sel, text);
  await activate(ext, page, true);
}

async function frame(ext: Ext, name: string, spec: FrameSpec): Promise<void> {
  const page = await ext.ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(frameHtml(spec));
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, name) });
  await page.close();
}

const ARTICLE = {
  tabTitle: 'Why we forget most of what we read',
  address: 'longread.example/why-we-forget',
};

test('store screenshots', async ({ ext }) => {
  test.setTimeout(180_000);

  // ── Web page with four colours, a note and the selection toolbar ─────────
  const article = await ext.ctx.newPage();
  await article.setViewportSize({ width: WINDOW.width, height: PANE_HEIGHT });
  await article.goto(`${ext.server.url}/article.html`);
  await activate(ext, article);
  await highlightWeb(
    ext,
    article,
    '#p1',
    'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.',
    'yellow',
  );
  await highlightWeb(
    ext,
    article,
    '#p2',
    'Pulling an idea back out of memory, even imperfectly, strengthens it far more than reading it again.',
    'mint',
  );
  await highlightWeb(
    ext,
    article,
    '#p2',
    'What helps is returning to the highlights later and testing yourself on them.',
    'sky',
  );
  await highlightWeb(ext, article, '#p3', 'a day, a week and a month later.', 'pink');
  await setDefault(ext, 'yellow');
  // A note on the yellow highlight.
  const yellowPoint = await article.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')!][0] as Range;
    const rect = r.getClientRects()[0]!;
    return { x: rect.left + 40, y: rect.top + rect.height / 2 };
  });
  await article.mouse.click(yellowPoint.x, yellowPoint.y);
  await clickInShadow(article, { text: 'Add note' });
  await article.waitForTimeout(200);
  await article.keyboard.type('Good opening line for my essay intro.');
  await article.keyboard.press('Control+Enter');
  await article.waitForTimeout(300);
  // Select a sentence (toolbar appears), then hover the note marker (note card appears).
  await selectText(article, '#p2', 'Researchers have repeated the same finding for decades.');
  await article.waitForTimeout(500);
  const marker = await article.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')!][0] as Range;
    const rects = r.getClientRects();
    const last = rects[rects.length - 1]!;
    return { x: last.right + 2, y: last.top - 2 };
  });
  await article.mouse.move(marker.x, marker.y);
  await article.waitForTimeout(400);
  const shot1 = await article.screenshot();
  await frame(ext, 'screenshot-1-web-highlighting.png', {
    headline: 'Highlight any web page in four colours',
    subtitle:
      'Select text, pick a colour, add a note. Your highlights come back every time you return.',
    ...ARTICLE,
    panes: [{ png: shot1, width: WINDOW.width }],
  });

  // ── PDF viewer ───────────────────────────────────────────────────────────
  const viewer = await ext.ctx.newPage();
  await viewer.setViewportSize({ width: WINDOW.width, height: PANE_HEIGHT });
  await viewer.goto(ext.url('viewer/viewer.html'));
  await viewer.setInputFiles('#file-input', {
    name: 'spaced-retrieval-study.pdf',
    mimeType: 'application/pdf',
    buffer: samplePdf('Spaced retrieval study'),
  });
  await viewer.waitForSelector('.page[data-page-number="2"] .textLayer span');
  await viewer.waitForTimeout(500);
  const layer = (n: number) => `.page[data-page-number="${n}"] .textLayer`;
  const pdfHighlight = async (n: number, text: string, color: string, note?: string) => {
    await viewer.click(`#colours [data-color="${color}"]`);
    await viewer.evaluate((n) => {
      const page = document.querySelector<HTMLElement>(`.page[data-page-number="${n}"]`)!;
      document.getElementById('viewerContainer')!.scrollTop = page.offsetTop;
    }, n);
    await viewer.waitForSelector(`${layer(n)} span`);
    await viewer.waitForTimeout(200);
    await selectAcross(viewer, layer(n), text);
    await viewer.keyboard.press(note ? 'n' : 'h');
    if (note) {
      await viewer.waitForTimeout(300);
      await viewer.keyboard.type(note);
      await viewer.keyboard.press('Control+Enter');
    }
    await viewer.waitForTimeout(200);
  };
  await pdfHighlight(
    2,
    'The retrieval group retained 61% of key ideas at seven days, compared with 38% for the restudy group.',
    'mint',
    'Key statistic. Quote this in section 2 of my report.',
  );
  await pdfHighlight(
    2,
    'most believed rereading had helped them more, despite scoring lower.',
    'yellow',
  );
  await pdfHighlight(2, 'Spacing the retrieval sessions produced a further gain.', 'pink');
  await pdfHighlight(
    3,
    'Instructors may get more value from short, frequent recall exercises than from additional reading assignments.',
    'sky',
  );
  await viewer.click('#colours [data-color="yellow"]');
  await viewer.evaluate(() => {
    const page = document.querySelector<HTMLElement>('.page[data-page-number="2"]')!;
    document.getElementById('viewerContainer')!.scrollTop = page.offsetTop + 40;
  });
  await viewer.mouse.move(5, 5);
  await viewer.waitForTimeout(600);
  const shot2 = await viewer.screenshot();
  await frame(ext, 'screenshot-2-pdf-highlighting.png', {
    headline: 'Highlight PDFs, including files on your computer',
    subtitle:
      'Open any PDF in the Bowerline viewer. Highlights stay with the file, even if you move it.',
    tabTitle: 'spaced-retrieval-study.pdf',
    address: 'Bowerline PDF viewer',
    panes: [{ png: shot2, width: WINDOW.width }],
  });

  // ── Library search in the side panel, next to the article ───────────────
  const PANEL = 380;
  await article.bringToFront();
  await article.evaluate(() => window.getSelection()?.removeAllRanges());
  await article.mouse.move(5, 5);
  await article.setViewportSize({ width: WINDOW.width - PANEL, height: PANE_HEIGHT });
  await article.waitForTimeout(400);
  const left = await article.screenshot();
  const tabId = await ext.sw.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)!.id!,
    article.url(),
  );
  const panel = await ext.ctx.newPage();
  await panel.setViewportSize({ width: PANEL, height: PANE_HEIGHT });
  await panel.goto(ext.url(`sidepanel/sidepanel.html?tabId=${tabId}`));
  await panel.click('#tab-library');
  await panel.fill('#q', 'retrieval');
  await panel.waitForTimeout(400);
  const right = await panel.screenshot();
  await frame(ext, 'screenshot-3-library-search.png', {
    headline: 'Every highlight in one searchable library',
    subtitle:
      'Search across web pages and PDFs, filter by colour, and jump straight back to the passage.',
    ...ARTICLE,
    panes: [
      { png: left, width: WINDOW.width - PANEL },
      { png: right, width: PANEL, divider: true },
    ],
  });

  // ── Export dialog ────────────────────────────────────────────────────────
  const lib = await ext.ctx.newPage();
  await lib.setViewportSize({ width: WINDOW.width, height: PANE_HEIGHT });
  await lib.goto(ext.url('library/library.html'));
  await lib.click('#export');
  await lib.waitForTimeout(400);
  const shot4 = await lib.screenshot();
  await frame(ext, 'screenshot-4-export.png', {
    headline: 'Export to Obsidian, Notion or Markdown',
    subtitle:
      'One click turns your highlights and notes into files you own, for one page or your whole library.',
    tabTitle: 'Bowerline library',
    address: 'Bowerline library',
    panes: [{ png: shot4, width: WINDOW.width }],
  });

  // ── Settings: your data ──────────────────────────────────────────────────
  const opts = await ext.ctx.newPage();
  await opts.setViewportSize({ width: WINDOW.width, height: PANE_HEIGHT });
  await opts.goto(ext.url('options/options.html#data'));
  await opts.waitForTimeout(400);
  const shot5 = await opts.screenshot();
  await frame(ext, 'screenshot-5-privacy.png', {
    headline: 'Private by design: no account, no tracking',
    subtitle: 'Your highlights never leave your browser. Back them up to a file whenever you like.',
    tabTitle: 'Bowerline settings',
    address: 'Bowerline settings',
    panes: [{ png: shot5, width: WINDOW.width }],
  });

  writeFileSync(join(OUT, 'README.md'), CAPTURED_README);
});

const CAPTURED_README = `# Captured store screenshots

Generated from the real, built extension by \`npm run store-screenshots\`
(\`tests/screens/store.spec.ts\`), framed like the designed mockups in
\`store-assets/\`. 1280×800, ready to upload to the Chrome Web Store in this order.
Re-run after any UI change.
`;
