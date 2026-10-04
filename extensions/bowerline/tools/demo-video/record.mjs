/**
 * Records the demo scenes from the real, built extension (dist/) in headed
 * Chromium with Playwright's recordVideo at 1280×800.
 *
 * 1. Setup (not recorded): install the extension into a fresh profile, grant
 *    the optional host permission in the profile (no permission prompt ever
 *    appears) and create the supporting highlights.
 * 2. Recording: relaunch with recordVideo and act out each scene with a
 *    visible cursor, smooth mouse moves, 60 ms typing and pauses after every
 *    visible change. Scene boundaries are written to out/manifest.json.
 *
 * Run through run.mjs (which provides a virtual display when needed).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { samplePdf } from '../../scripts/lib/sample-pdf.mjs';
import { DIST, OUT, REC, SCENES, TOOL_DIR } from './config.mjs';

const PAUSE = 600; // after every visible change
const STEPS = 30; // smooth mouse moves
const TYPE_DELAY = 60;
const ALWAYS_ON = ['http://*/*', 'https://*/*'];
const PDF_NAME = 'spaced-retrieval-study.pdf';
const PDF = samplePdf('Spaced retrieval study');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = [
  `--disable-extensions-except=${DIST}`,
  `--load-extension=${DIST}`,
  '--window-size=1400,1100',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,DownloadBubble',
  // Side-by-side windows must keep painting while another one has focus.
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
];

// ── Fixture server ──────────────────────────────────────────────────────────

function serve() {
  const article = readFileSync(join(TOOL_DIR, 'fixtures/article.html'));
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path === '/why-we-forget') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(article);
    } else if (path === `/${PDF_NAME}`) {
      res.writeHead(200, { 'content-type': 'application/pdf', 'access-control-allow-origin': '*' });
      res.end(PDF);
    } else if (path === '/blank') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>Bowerline demo</title>');
    } else {
      res.writeHead(204);
      res.end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }),
    ),
  );
}

// ── Profile with the permission already granted ─────────────────────────────

async function makeProfile() {
  const dir = mkdtempSync(join(tmpdir(), 'bowerline-demo-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: true,
    args,
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  await sleep(1500);
  await ctx.close();
  // What Chrome records when a user accepts the "Always on" permission prompt.
  const prefsFile = join(dir, 'Default/Preferences');
  const prefs = JSON.parse(readFileSync(prefsFile, 'utf8'));
  const s = prefs.extensions.settings[id];
  for (const key of ['granted_permissions', 'active_permissions']) {
    s[key] = { ...(s[key] ?? {}), explicit_host: ALWAYS_ON, scriptable_host: [] };
  }
  writeFileSync(prefsFile, JSON.stringify(prefs));
  return { dir, id };
}

async function launch(dir, record) {
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: false,
    // Recording uses real window sizes (see newPage); setup can emulate.
    viewport: record ? null : REC,
    args,
    acceptDownloads: true,
    ...(record ? { recordVideo: { dir: join(OUT, 'raw'), size: REC } } : {}),
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  // Close the restored/onboarding tabs: only the scenes' own pages are used.
  for (const p of ctx.pages())
    if (!p.url().startsWith('about:blank')) await p.close().catch(() => {});
  return { ctx, sw };
}

// ── Page helpers ────────────────────────────────────────────────────────────

/** A 22 px dark arrow with a soft shadow that follows the real mouse events. */
function installCursor() {
  if (window.top !== window) return;
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.setAttribute('popover', 'manual');
    c.style.cssText =
      'position:fixed;inset:auto;left:0;top:0;width:22px;height:22px;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;transform:translate(-200px,-200px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));';
    c.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M2 1.5v17.2l4.6-4.4 3 6.6 3-1.4-3-6.4h6.4z" fill="#18214D" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.append(c);
    const top = () => {
      try {
        c.hidePopover();
        c.showPopover();
      } catch {
        /* not connected yet */
      }
    };
    top();
    document.addEventListener(
      'mousemove',
      (e) => (c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`),
      true,
    );
    // Modal dialogs join the top layer later; lift the cursor back above them.
    new MutationObserver(top).observe(document.documentElement, {
      subtree: true,
      attributeFilter: ['open'],
    });
  };
  if (document.documentElement) add();
  document.addEventListener('DOMContentLoaded', add);
}

class Actor {
  /** `note(type, wall, area)` logs a sound-worthy moment and where it shows (see record()). */
  constructor(page, note) {
    this.page = page;
    this.note = note;
    this.x = 640;
    this.y = 400;
  }
  async moveTo(x, y, steps = STEPS) {
    await this.page.mouse.move(x, y, { steps });
    this.x = x;
    this.y = y;
  }
  /** With `sound`, logs the click at the button release, when the page reacts. */
  async click(x, y, sound) {
    await this.moveTo(x, y);
    await sleep(120);
    await this.page.mouse.down();
    await sleep(60);
    const t0 = Date.now();
    await this.page.mouse.up();
    if (sound)
      this.note(sound, (t0 + Date.now()) / 2, {
        page: this.page,
        x: x - 40,
        y: y - 24,
        w: 80,
        h: 48,
      });
  }
  async drag(from, to) {
    await this.moveTo(from.x, from.y);
    await sleep(150);
    await this.page.mouse.down();
    await this.page.mouse.move(to.x, to.y, { steps: 40 });
    this.x = to.x;
    this.y = to.y;
    await sleep(80);
    await this.page.mouse.up();
  }
  async clickLocator(locator) {
    const b = await locator.boundingBox();
    if (!b) throw new Error(`No box for ${locator}`);
    await this.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  /** Center of a button inside Bowerline's closed shadow root. */
  async shadowCenter(match) {
    const b = await this.shadowBox(match);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  /**
   * Box of an element inside Bowerline's closed shadow root, via DevTools' DOM view:
   * a button by aria-label or text, or the first element with a tag name.
   */
  async shadowBox(match, timeout = 4000) {
    const until = Date.now() + timeout;
    for (;;) {
      const cdp = await this.page.context().newCDPSession(this.page);
      const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
      const textOf = (n) => (n.nodeValue ?? '') + (n.children ?? []).map(textOf).join('');
      let found = null;
      const visit = (n, inShadow) => {
        if (found) return;
        const a = n.attributes ?? [];
        const label = a.includes('aria-label') ? a[a.indexOf('aria-label') + 1] : null;
        const hit = match.tag
          ? n.nodeName === match.tag
          : n.nodeName === 'BUTTON' &&
            ((match.label && label === match.label) ||
              (match.text && textOf(n).trim() === match.text));
        if (inShadow && hit) {
          found = n;
          return;
        }
        for (const s of n.shadowRoots ?? []) visit(s, true);
        for (const c of n.children ?? []) visit(c, inShadow);
      };
      visit(root, false);
      if (found) {
        const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId: found.backendNodeId });
        await cdp.detach();
        const q = model.content;
        const xs = [q[0], q[2], q[4], q[6]];
        const ys = [q[1], q[3], q[5], q[7]];
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
      }
      await cdp.detach();
      if (Date.now() > until) throw new Error(`Shadow button not found: ${JSON.stringify(match)}`);
      await sleep(100);
    }
  }
  async clickShadow(match, sound) {
    const p = await this.shadowCenter(match);
    await this.click(p.x, p.y, sound);
  }
  /** Types one character every TYPE_DELAY ms, logging each keystroke and the field's box. */
  async type(text, box) {
    for (const ch of text) {
      const t0 = Date.now();
      await this.page.keyboard.type(ch);
      this.note('key', (t0 + Date.now()) / 2, { page: this.page, ...box });
      await sleep(TYPE_DELAY);
    }
  }
}

/** Screen points at the start and end of `text` inside `selector` (across text nodes). */
async function textEnds(page, selector, text) {
  return page.evaluate(
    ({ selector, text }) => {
      const root = document.querySelector(selector);
      const nodes = [];
      let all = '';
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        nodes.push({ node: n, start: all.length });
        all += n.data;
      }
      const words = text.split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = new RegExp(words.join('\\s*')).exec(all);
      if (!m) throw new Error(`Not found: ${text}`);
      const at = (offset) => {
        const hit = [...nodes].reverse().find((x) => x.start <= offset);
        return { node: hit.node, offset: offset - hit.start };
      };
      const charRect = (offset) => {
        const p = at(offset);
        const r = document.createRange();
        r.setStart(p.node, p.offset);
        r.setEnd(p.node, Math.min(p.offset + 1, p.node.data.length));
        return r.getBoundingClientRect();
      };
      const a = charRect(m.index);
      const b = charRect(m.index + m[0].length - 1);
      return {
        start: { x: a.left + 1, y: a.top + a.height / 2 },
        end: { x: b.right - 1, y: b.top + b.height / 2 },
      };
    },
    { selector, text },
  );
}

async function setDefault(sw, color) {
  await sw.evaluate(async (color) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...(settings ?? {}), defaultColor: color } });
  }, color);
}

async function selectText(page, selector, text) {
  await page.evaluate(
    ({ selector, text }) => {
      const root = document.querySelector(selector);
      const nodes = [];
      let all = '';
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        nodes.push({ node: n, start: all.length });
        all += n.data;
      }
      const words = text.split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = new RegExp(words.join('\\s*')).exec(all);
      if (!m) throw new Error(`Not found: ${text}`);
      const at = (offset, end) => {
        const hit = [...nodes].reverse().find((x) => (end ? x.start < offset : x.start <= offset));
        return { node: hit.node, offset: offset - hit.start };
      };
      const s = at(m.index, false);
      const e = at(m.index + m[0].length, true);
      const r = document.createRange();
      r.setStart(s.node, s.offset);
      r.setEnd(e.node, e.offset);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    },
    { selector, text },
  );
}

/**
 * Waits for `stamp`, checked once per frame in the page, to return a value: it
 * returns the page's clock (`Date.now()`) on the frame where the change first shows.
 */
async function appears(page, stamp, arg) {
  return (await page.waitForFunction(stamp, arg, { polling: 'raf' })).jsonValue();
}

async function highlightCount(page) {
  return page.evaluate(() =>
    ['yellow', 'mint', 'pink', 'sky'].reduce(
      (n, c) => n + (CSS.highlights.get(`bowerline-${c}`)?.size ?? 0),
      0,
    ),
  );
}

async function openPdf(page) {
  await page.setInputFiles('#file-input', {
    name: PDF_NAME,
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  await page.waitForSelector('.page[data-page-number="2"] .textLayer span');
}

async function scrollViewerTo(page, pageNumber, extra = 0) {
  await page.evaluate(
    ({ n, extra }) => {
      const el = document.querySelector(`.page[data-page-number="${n}"]`);
      document.getElementById('viewerContainer').scrollTop = el.offsetTop + extra;
    },
    { n: pageNumber, extra },
  );
}

// ── 1. Setup: supporting highlights (not recorded) ──────────────────────────

async function setup(dir, server) {
  const { ctx, sw } = await launch(dir, false);
  const article = await ctx.newPage();
  await article.goto(`${server.url}/why-we-forget`);
  await article.waitForFunction(() => !!document.querySelector('bowerline-ui'));
  await sleep(500);
  const make = async (sel, text, color) => {
    await setDefault(sw, color);
    const before = await highlightCount(article);
    await selectText(article, sel, text);
    await sw.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
      await globalThis.bowerline.activateTab(tab, { highlightSelection: true, announce: false });
    }, article.url());
    await article.waitForFunction(
      (n) =>
        ['yellow', 'mint', 'pink', 'sky'].reduce(
          (a, c) => a + (CSS.highlights.get(`bowerline-${c}`)?.size ?? 0),
          0,
        ) > n,
      before,
    );
  };
  await make(
    '#p2',
    'Pulling an idea back out of memory, even imperfectly, strengthens it far more than reading it again.',
    'mint',
  );
  await make(
    '#p2',
    'What helps is returning to the highlights later and testing yourself on them.',
    'sky',
  );
  await make('#p3', 'a day, a week and a month later.', 'pink');

  const viewer = await ctx.newPage();
  await viewer.goto(`chrome-extension://${new URL(sw.url()).host}/viewer/viewer.html`);
  await openPdf(viewer);
  const pdfMake = async (n, text, color) => {
    await viewer.click(`#colours [data-color="${color}"]`);
    await scrollViewerTo(viewer, n);
    await viewer.waitForSelector(`.page[data-page-number="${n}"] .textLayer span`);
    await selectText(viewer, `.page[data-page-number="${n}"] .textLayer`, text);
    await viewer.keyboard.press('h');
    await sleep(300);
  };
  await pdfMake(
    2,
    'most believed rereading had helped them more, despite scoring lower.',
    'yellow',
  );
  await pdfMake(2, 'Spacing the retrieval sessions produced a further gain.', 'pink');
  await pdfMake(
    3,
    'Instructors may get more value from short, frequent recall exercises than from additional reading assignments.',
    'sky',
  );
  await setDefault(sw, 'yellow');
  await sleep(500);
  await ctx.close();
}

// ── 2. Recording ────────────────────────────────────────────────────────────

async function record(dir, server, extId) {
  const { ctx, sw } = await launch(dir, true);
  await ctx.addInitScript(installCursor);
  const ext = (p) => `chrome-extension://${extId}/${p}`;
  const scenes = {};
  // Moments on the wall clock: sounds (click, swipe, key, pop) are placed on them, and
  // `end` marks a scene's last visible change, so audio.py knows how far its pause can shrink.
  const events = [];
  const note = (type, wall = Date.now(), area = null) => events.push({ type, wall, area });
  /** Box of a page's yellow highlight / mint PDF highlight, for the swipe's area. */
  const yellowBox = (page) =>
    page.evaluate(() => {
      const r = [...CSS.highlights.get('bowerline-yellow')][0].getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  const mintBox = (page) =>
    page.evaluate(() => {
      const rs = [...document.querySelectorAll('.bl-hl[data-color="mint"]')].map((e) =>
        e.getBoundingClientRect(),
      );
      const x = Math.min(...rs.map((r) => r.left));
      const y = Math.min(...rs.map((r) => r.top));
      return {
        x,
        y,
        w: Math.max(...rs.map((r) => r.right)) - x,
        h: Math.max(...rs.map((r) => r.bottom)) - y,
      };
    });
  const pages = new Map(); // page → { syncs: wall times of its sync flashes }
  /**
   * Every recorded page gets its own window whose content area is exactly the
   * wanted size. Headed Chromium's screencast captures the real content area
   * (not an emulated viewport), so this is what makes the footage pixel-exact,
   * and it lets two narrow pages sit side by side on screen.
   */
  let windows = 0;
  const newPage = async (viewport = REC, left = 0) => {
    // A unique address identifies this window's page among any others Chrome opens.
    const token = `${server.url}/blank?window=${++windows}`;
    const windowId = await sw.evaluate(
      async ({ token, left, width, height }) =>
        (
          await chrome.windows.create({
            url: token,
            type: 'popup',
            left,
            top: 0,
            width,
            height,
          })
        ).id,
      { token, left, ...viewport },
    );
    let page;
    for (let i = 0; !page; i++) {
      page = ctx.pages().find((p) => p.url() === token);
      if (i > 100) throw new Error(`Window ${token} never appeared`);
      if (!page) await sleep(50);
    }
    pages.set(page, { syncs: [] });
    for (let i = 0; i < 5; i++) {
      const m = await page.evaluate(() => ({
        ow: outerWidth,
        oh: outerHeight,
        iw: innerWidth,
        ih: innerHeight,
      }));
      if (m.iw === viewport.width && m.ih === viewport.height) break;
      await sw.evaluate(
        ({ windowId, width, height }) => chrome.windows.update(windowId, { width, height }),
        {
          windowId,
          width: viewport.width + m.ow - m.iw,
          height: viewport.height + m.oh - m.ih,
        },
      );
      await sleep(250);
    }
    const size = await page.evaluate(() => [innerWidth, innerHeight]);
    if (size[0] !== viewport.width || size[1] !== viewport.height)
      throw new Error(
        `Window content is ${size.join('×')}, wanted ${viewport.width}×${viewport.height}`,
      );
    return page;
  };
  const mark = (id, parts, actionsDone) => {
    scenes[id] = {
      ...(scenes[id] ?? {}),
      parts,
      actions: actionsDone,
    };
  };
  /**
   * Flash the page magenta for a moment, outside any scene: once after it
   * loads and once before it closes. The recording starts with an unknown delay
   * and doesn't run exactly at wall-clock speed, so scene times are mapped onto
   * each video through these two flashes, found again in the video afterwards.
   */
  const sync = async (page) => {
    // The recording's first frames can lag the page by a second; don't flash before them.
    if (pages.get(page).syncs.length === 0) await sleep(1200);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const d = document.createElement('div');
          d.id = '__demo_sync';
          // A popover, so it also covers modal dialogs (the top layer).
          d.setAttribute('popover', 'manual');
          d.style.cssText =
            'position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#ff00ff;pointer-events:none';
          document.documentElement.append(d);
          d.showPopover();
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );
    pages.get(page).syncs.push(Date.now());
    await sleep(500);
    await page.evaluate(() => document.getElementById('__demo_sync')?.remove());
    await sleep(500);
  };
  /** Closing sync flash, then close once the recording has caught up (it lags). */
  const finish = async (...ps) => {
    await Promise.all(ps.map(sync));
    await sleep(3000);
    for (const p of ps) await p.close();
  };
  /** Begin a scene: remember the wall time for each page in it. */
  const begin = (pagesInScene) => {
    const now = Date.now();
    return pagesInScene.map(({ page, crop, x }) => ({ page, crop, x, wall: now }));
  };
  /** Keep the page still after a scene until its slot (plus margin) is covered. */
  const tail = (id) =>
    sleep(
      Math.max(1500, (SCENES.find((s) => s.id === id).duration - scenes[id].actions + 1) * 1000),
    );
  const done = (t0) => (Date.now() - t0) / 1000;

  // Scene: highlight + note (article)
  const article = await newPage();
  await article.goto(`${server.url}/why-we-forget`);
  await article.waitForFunction(() => !!document.querySelector('bowerline-ui'));
  await article.waitForFunction(() => (CSS.highlights.get('bowerline-mint')?.size ?? 0) > 0);
  await sync(article);
  const a = new Actor(article, note);
  await a.moveTo(900, 640, 5);
  await sleep(400);
  let t0 = Date.now();
  const partsA = begin([{ page: article }]);
  const sentence =
    'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.';
  const ends = await textEnds(article, '#p1', sentence);
  await a.drag(ends.start, ends.end);
  await sleep(PAUSE); // toolbar is showing
  await a.clickShadow({ label: 'Highlight Yellow' }, 'click');
  const yellowAt = await appears(
    article,
    () => CSS.highlights.get('bowerline-yellow')?.size && Date.now(),
  );
  note('swipe', yellowAt, { page: article, ...(await yellowBox(article)) });
  await sleep(PAUSE); // highlighted
  const mid = await article.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')][0];
    const rect = r.getClientRects()[0];
    return { x: rect.left + rect.width * 0.35, y: rect.top + rect.height / 2 };
  });
  await a.click(mid.x, mid.y);
  await sleep(450); // edit toolbar
  await a.clickShadow({ text: 'Add note' });
  await sleep(450); // note editor
  await a.type('Good opening line for my essay', await a.shadowBox({ tag: 'TEXTAREA' }));
  await sleep(200);
  await a.clickShadow({ text: 'Save note' });
  note('end'); // the marker appears: the scene's last visible change
  await sleep(PAUSE);
  mark('highlight', partsA, done(t0));
  await tail('highlight');

  // Scene: reload, the highlights (and the note) come back
  t0 = Date.now();
  const partsB = begin([{ page: article }]);
  await sleep(350);
  // Leave and come back (a reload alone is too quick to see).
  const url = article.url();
  await article.goto('about:blank');
  await sleep(350);
  await article.goto(url);
  const backAt = await appears(
    article,
    () => CSS.highlights.get('bowerline-yellow')?.size && Date.now(),
  );
  note('swipe', backAt, { page: article, ...(await yellowBox(article)) });
  await sleep(PAUSE);
  const marker = await article.evaluate(() => {
    const r = [...CSS.highlights.get('bowerline-yellow')][0];
    const rects = r.getClientRects();
    const last = rects[rects.length - 1];
    return { x: last.right + 2, y: last.top - 2 };
  });
  await a.moveTo(marker.x, marker.y);
  await sleep(PAUSE); // the note card opens on hover
  note('end');
  await sleep(PAUSE);
  mark('reload', partsB, done(t0));
  await tail('reload');
  await finish(article);

  // Scene: open the PDF from the computer, highlight the 61% sentence in mint
  const viewer = await newPage();
  await viewer.goto(ext('viewer/viewer.html'));
  await viewer.waitForSelector('#open-card button');
  await sync(viewer);
  const v = new Actor(viewer, note);
  await v.moveTo(900, 560, 5);
  await sleep(500);
  t0 = Date.now();
  const partsC = begin([{ page: viewer }]);
  await sleep(300);
  const chooser = viewer.waitForEvent('filechooser');
  await v.clickLocator(viewer.getByRole('button', { name: 'Choose a PDF' }));
  await (await chooser).setFiles({ name: PDF_NAME, mimeType: 'application/pdf', buffer: PDF });
  await viewer.waitForSelector('.page[data-page-number="2"] .textLayer span');
  await sleep(PAUSE);
  // Scroll to page 2 with the wheel, in visible steps.
  await v.moveTo(700, 500, 20);
  const target = await viewer.evaluate(
    () => document.querySelector('.page[data-page-number="2"]').offsetTop + 30,
  );
  for (let y = 0; y < target; y += 90) {
    await viewer.mouse.wheel(0, Math.min(90, target - y));
    await sleep(16);
  }
  await viewer.waitForSelector('.page[data-page-number="2"] .textLayer span');
  await sleep(PAUSE);
  const pdfEnds = await textEnds(
    viewer,
    '.page[data-page-number="2"] .textLayer',
    'The retrieval group retained 61% of key ideas at seven days, compared with 38% for the restudy group.',
  );
  await v.drag(pdfEnds.start, pdfEnds.end);
  await sleep(PAUSE);
  await v.clickShadow({ label: 'Highlight Mint' }, 'click');
  const mintAt = await appears(
    viewer,
    () => document.querySelector('.bl-hl[data-color="mint"]') && Date.now(),
  );
  note('swipe', mintAt, { page: viewer, ...(await mintBox(viewer)) });
  await sleep(PAUSE);
  await v.moveTo(1180, 470);
  note('end');
  mark('pdf', partsC, done(t0));
  await tail('pdf');
  await finish(viewer);

  // Scene: side panel next to the PDF viewer — search, click a card, jump
  const PANEL = 500; // a realistic side-panel width (and above Chrome's 500 px window minimum)
  const viewer2 = await newPage({ width: REC.width - PANEL, height: REC.height }, 0);
  await viewer2.goto(ext('viewer/viewer.html'));
  await openPdf(viewer2);
  await sleep(800);
  await viewer2.evaluate(() => (document.getElementById('viewerContainer').scrollTop = 0));
  await sync(viewer2);
  const tabId = await viewer2.evaluate(async () => (await chrome.tabs.getCurrent()).id);
  const panel = await newPage({ width: PANEL, height: REC.height }, 1320);
  await panel.goto(ext(`sidepanel/sidepanel.html?tabId=${tabId}`));
  await panel.waitForSelector('#tab-library');
  await sync(panel);
  const p = new Actor(panel, note);
  await p.moveTo(300, 600, 5);
  await sleep(600);
  t0 = Date.now();
  const partsD = begin([
    { page: viewer2, crop: { w: REC.width - PANEL, h: REC.height }, x: 0 },
    { page: panel, crop: { w: PANEL, h: REC.height }, x: REC.width - PANEL },
  ]);
  await sleep(300);
  await p.clickLocator(panel.locator('#tab-library'));
  await sleep(PAUSE);
  await p.clickLocator(panel.locator('#q'));
  // Every time the result count changes, on the page's clock.
  await panel.evaluate(() => {
    const el = document.getElementById('summary');
    window.__counts = [];
    let last = el.textContent;
    new MutationObserver(() => {
      if (el.textContent !== last) window.__counts.push(Date.now());
      last = el.textContent;
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  const q = await panel.locator('#q').boundingBox();
  await p.type('retrieval', { x: q.x, y: q.y, w: q.width, h: q.height });
  await sleep(PAUSE);
  // One pop when the results settle: the last change of the count.
  const counts = await panel.evaluate(() => window.__counts);
  if (!counts.length) throw new Error('Search results never updated');
  const sum = await panel.locator('#summary').boundingBox();
  note('pop', counts[counts.length - 1], {
    page: panel,
    x: sum.x,
    y: sum.y,
    w: sum.width,
    h: sum.height,
  });
  const card = panel.locator('.hl-card', { hasText: '61%' }).locator('.hl-main');
  await p.clickLocator(card);
  await sleep(PAUSE * 1.5); // the viewer scrolls to the passage and outlines it
  note('end');
  await sleep(PAUSE);
  mark('library', partsD, done(t0));
  await tail('library');
  await finish(viewer2, panel);

  // Scene: export
  const lib = await newPage();
  await lib.goto(ext('library/library.html'));
  await lib.waitForSelector('.hl-card');
  await sync(lib);
  const l = new Actor(lib, note);
  await l.moveTo(1000, 120, 5);
  await sleep(500);
  t0 = Date.now();
  const partsE = begin([{ page: lib }]);
  await sleep(250);
  await l.clickLocator(lib.locator('#export'));
  await sleep(PAUSE);
  await l.clickLocator(lib.getByRole('radio', { name: /^Markdown/ }));
  await sleep(PAUSE);
  await l.clickLocator(lib.getByRole('radio', { name: /^Obsidian/ }));
  await sleep(PAUSE);
  const download = lib.waitForEvent('download');
  await l.clickLocator(lib.getByRole('button', { name: /Download .md file/ }));
  await download;
  note('end');
  await sleep(PAUSE);
  mark('export', partsE, done(t0));
  await tail('export');
  await finish(lib);

  // Scene: settings, your data
  const opts = await newPage();
  await opts.goto(ext('options/options.html#data'));
  await opts.waitForSelector('#stat-highlights');
  await sync(opts);
  await sleep(400);
  const o = new Actor(opts, note);
  await o.moveTo(1150, 700, 5);
  await sleep(400);
  t0 = Date.now();
  const partsF = begin([{ page: opts }]);
  await sleep(500);
  // Rest just right of each number (they are at most two digits), never on it or its label.
  const besideNumber = async (i) => {
    const box = await opts.locator('.stat strong').nth(i).boundingBox();
    return { x: box.x + 50, y: box.y + 2 };
  };
  const first = await besideNumber(0);
  await o.moveTo(first.x, first.y);
  await sleep(PAUSE);
  const zero = await besideNumber(2);
  await o.moveTo(zero.x, zero.y);
  note('end');
  await sleep(PAUSE * 2);
  mark('privacy', partsF, done(t0));
  await tail('privacy');
  await finish(opts);

  // Videos are finalised when their pages close; collect the paths.
  for (const s of Object.values(scenes)) {
    const from = s.parts[0].wall;
    const next = Math.min(
      ...Object.values(scenes)
        .map((x) => x.parts[0].wall)
        .filter((w) => w > from),
    );
    s.events = events
      .filter((e) => e.wall >= from && e.wall < next)
      .map(({ type, wall, area }) => ({
        type,
        t: +((wall - from) / 1000).toFixed(3),
        // Where it shows, in the recorded page's CSS px, and which part of the scene.
        ...(area && {
          area: {
            part: s.parts.findIndex((x) => x.page === area.page),
            x: Math.round(area.x),
            y: Math.round(area.y),
            w: Math.round(area.w),
            h: Math.round(area.h),
          },
        }),
      }));
    for (const part of s.parts) {
      part.video = await part.page.video().path();
      part.syncs = pages.get(part.page).syncs;
    }
  }
  await ctx.close();
  return scenes;
}

/** Times (s) at which each magenta flash starts in a recording. */
function flashTimes(video) {
  const pts = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v',
      '-show_entries',
      'frame=pts_time',
      '-of',
      'csv=p=0',
      video,
    ],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .map(Number);
  const rgb = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      video,
      '-fps_mode',
      'passthrough',
      '-vf',
      'crop=16:16:8:8,scale=1:1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    {
      maxBuffer: 1 << 26,
    },
  );
  const starts = [];
  let on = false;
  for (let i = 0; i < rgb.length / 3; i++) {
    const [r, g, b] = rgb.subarray(i * 3, i * 3 + 3);
    const magenta = r > 200 && g < 70 && b > 200;
    if (magenta && !on) starts.push(pts[i]);
    on = magenta;
  }
  if (starts.length !== 2)
    throw new Error(
      `Expected 2 sync flashes in ${video}, found ${starts.length} (at ${starts.join(', ')} s)`,
    );
  return starts;
}

// ── Main ────────────────────────────────────────────────────────────────────

rmSync(join(OUT, 'raw'), { recursive: true, force: true });
mkdirSync(join(OUT, 'raw'), { recursive: true });
const server = await serve();
const { dir, id } = await makeProfile();
try {
  await setup(dir, server);
  const scenes = await record(dir, server, id);
  const manifest = {};
  for (const [sceneId, s] of Object.entries(scenes)) {
    const slot = SCENES.find((x) => x.id === sceneId).duration;
    manifest[sceneId] = {
      actions: s.actions,
      events: s.events, // t: seconds after the scene begins; shown at its start + LEAD + t
      parts: s.parts.map(({ video, wall, syncs, crop, x }) => {
        const [v1, v2] = flashTimes(video);
        const rate = (v2 - v1) / ((syncs[1] - syncs[0]) / 1000); // video seconds per wall second
        return {
          video,
          offset: +(v1 + ((wall - syncs[0]) / 1000) * rate).toFixed(3),
          rate: +rate.toFixed(4),
          crop: crop ?? null,
          x: x ?? 0,
        };
      }),
    };
    const flag = s.actions > slot - 0.4 ? '  ⚠ longer than its slot' : '';
    console.log(
      `  ${sceneId.padEnd(10)} actions ${s.actions.toFixed(2)} s / slot ${slot} s${flag}`,
    );
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Recorded scenes → tools/demo-video/out/manifest.json');
} finally {
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
