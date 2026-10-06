/**
 * Records the demo scenes from the real, built extension (dist/) in headed
 * Chromium with Playwright's recordVideo at 1280×800.
 *
 * 1. Setup (not recorded): install the extension into a fresh profile and grant
 *    "all websites" in the profile (what Chrome stores after the user accepts
 *    the prompt, so no prompt ever appears). Sample the true color of the
 *    T-shirt that the identify scene picks, with Huefinch off.
 * 2. Recording: relaunch with recordVideo and act out each scene with a visible
 *    cursor, smooth mouse moves and pauses after every visible change. Every
 *    sound-worthy action is logged with its time and the screen area it changes.
 *
 * The toolbar popup can't be recorded where Chrome draws it, so it is opened as
 * a tab (popup.html?tab=<id>, the same page) in its own window, recorded, and
 * drawn over the page by compose.mjs where Chrome would show it.
 *
 * Chrome's eyedropper is a native overlay that recordings can't capture and
 * scripts can't click. In the identify scene only that picker is replaced: a
 * stand-in returns the page's true pixel color at the clicked point (sampled
 * from the real page with Huefinch off), and Huefinch's own code does the rest
 * (removing the filter while picking, naming, the card, copying).
 *
 * Run through run.mjs (which provides a virtual display when needed).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { DIST, OUT, POPUP, REC, SCENES, TOOL_DIR } from './config.mjs';

const PAUSE = 600; // after every visible change
const STEPS = 30; // smooth mouse moves
const ALL_SITES = ['https://*/*', 'http://*/*'];
const EXTENSION_NAME = 'Huefinch – Color Blind Filter & Color Identifier';
/** Where the identify scene clicks: on the first T-shirt's chest. */
const TEE_POINT = { x: 215, y: 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = [
  `--disable-extensions-except=${DIST}`,
  `--load-extension=${DIST}`,
  '--window-size=1400,1100',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,DownloadBubble',
  '--force-color-profile=srgb',
  // Each demo site gets a plain name, so the popup shows "shop.example", not "127.0.0.1".
  '--host-resolver-rules=MAP *.example 127.0.0.1',
  // Side-by-side windows must keep painting while another one has focus.
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
];

/** The demo's websites, served from the fixture server under these names. */
const SITES = ['dashboard', 'metro', 'shop', 'app'];

// ── Fixture server ──────────────────────────────────────────────────────────

function serve() {
  const dir = join(TOOL_DIR, 'fixtures');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css' };
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const file = join(dir, path === '/blank' ? '' : path);
    if (path === '/blank') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>Huefinch demo</title>');
    } else if (path !== '/' && existsSync(file)) {
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain' });
      res.end(readFileSync(file));
    } else {
      res.writeHead(204);
      res.end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        site: (name) => `http://${name}.example:${server.address().port}`,
        close: () => server.close(),
      }),
    ),
  );
}

// ── Profile with website access already granted ─────────────────────────────

async function makeProfile() {
  const dir = mkdtempSync(join(tmpdir(), 'huefinch-demo-'));
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
  // What Chrome records when the user clicks "Turn on for all websites" and allows it.
  const prefsFile = join(dir, 'Default/Preferences');
  const prefs = JSON.parse(readFileSync(prefsFile, 'utf8'));
  const s = prefs.extensions.settings[id];
  for (const key of ['granted_permissions', 'active_permissions'])
    s[key] = { ...(s[key] ?? {}), explicit_host: ALL_SITES, scriptable_host: [] };
  writeFileSync(prefsFile, JSON.stringify(prefs));
  return { dir, id };
}

async function launch(dir, record, server) {
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: false,
    // Recording uses real window sizes (see newPage); setup can emulate.
    viewport: record ? null : REC,
    args: [
      ...args,
      // Real sites are https; the demo serves plain http, so let them count as secure
      // (the clipboard and EyeDropper only exist in secure contexts).
      `--unsafely-treat-insecure-origin-as-secure=${SITES.map(server.site).join(',')}`,
    ],
    ...(record ? { recordVideo: { dir: join(OUT, 'raw'), size: REC } } : {}),
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: server.site('shop'),
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  for (let i = 0; i < 100 && !(await sw.evaluate(() => 'huefinch' in globalThis)); i++)
    await sleep(50);
  await sw.evaluate(() => globalThis.huefinch.ready);
  // Close the restored/onboarding tabs: only the scenes' own pages are used.
  for (const p of ctx.pages())
    if (!p.url().startsWith('about:blank')) await p.close().catch(() => {});
  return { ctx, sw };
}

const settings = (sw, patch) => sw.evaluate((patch) => chrome.storage.local.set(patch), patch);

// ── Page helpers ────────────────────────────────────────────────────────────

/**
 * A 22 px dark arrow with a soft shadow that follows the real mouse events,
 * plus two demo-only props: a loupe ring standing in for Chrome's eyedropper
 * magnifier, and a key-hint pill showing the keys being held.
 */
function installCursor() {
  if (window.top !== window) return;
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.setAttribute('popover', 'manual');
    c.style.cssText =
      'position:fixed;inset:auto;left:0;top:0;width:22px;height:22px;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;transform:translate(-200px,-200px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));';
    const arrow =
      '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M2 1.5v17.2l4.6-4.4 3 6.6 3-1.4-3-6.4h6.4z" fill="#18214D" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const loupe =
      '<svg width="64" height="64" viewBox="0 0 64 64" style="position:absolute;left:-32px;top:-32px" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="24" fill="none" stroke="#18214D" stroke-width="6"/><circle cx="32" cy="32" r="24" fill="none" stroke="#fff" stroke-width="3"/><circle cx="32" cy="32" r="2.5" fill="#fff" stroke="#18214D" stroke-width="1"/></svg>';
    c.innerHTML = arrow;
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
    // Huefinch's card and other top-layer content arrive later; stay above them.
    new MutationObserver(top).observe(document.documentElement, { childList: true, subtree: true });
    window.__demo = {
      cursor: (visible) => (c.style.visibility = visible ? 'visible' : 'hidden'),
      loupe: (on) => (c.innerHTML = on ? loupe : arrow),
      keys: (list) => {
        document.getElementById('__demo_keys')?.remove();
        if (!list) return;
        const k = document.createElement('div');
        k.id = '__demo_keys';
        k.setAttribute('popover', 'manual');
        k.style.cssText =
          'position:fixed;inset:auto;left:50%;bottom:28px;transform:translateX(-50%);margin:0;display:flex;gap:10px;align-items:center;padding:12px 18px;border:0;border-radius:16px;background:#18214D;color:#fff;font:700 22px/1 system-ui,sans-serif;box-shadow:0 10px 30px rgba(24,33,77,.35);pointer-events:none';
        k.innerHTML = list
          .map(
            (key) =>
              `<span style="padding:8px 12px;border-radius:9px;background:#fff;color:#18214D;box-shadow:inset 0 -3px 0 #c9cfe2">${key}</span>`,
          )
          .join('<span style="opacity:.8">+</span>');
        document.documentElement.append(k);
        k.showPopover();
        top();
      },
    };
  };
  if (document.documentElement) add();
  document.addEventListener('DOMContentLoaded', add);
}

class Actor {
  /** `note(type, wall, area)` logs a sound-worthy moment and where it shows (see record()). */
  constructor(page, note) {
    this.page = page;
    this.note = note;
  }
  async moveTo(x, y, steps = STEPS) {
    await this.page.mouse.move(x, y, { steps });
  }
  /** With `sound`, logs the click at the button release, when the page reacts. */
  async click(x, y, sound, area) {
    await this.moveTo(x, y);
    await sleep(140);
    await this.page.mouse.down();
    await sleep(60);
    const t0 = Date.now();
    await this.page.mouse.up();
    if (sound) this.note(sound, (t0 + Date.now()) / 2, { page: this.page, ...area });
  }
  async clickLocator(locator, sound) {
    const b = await locator.boundingBox();
    if (!b) throw new Error(`No box for ${locator}`);
    await this.click(b.x + b.width / 2, b.y + b.height / 2, sound, {
      x: b.x,
      y: b.y,
      w: b.width,
      h: b.height,
    });
  }
}

/**
 * Waits for `stamp`, checked once per frame in the page, to return a value: it
 * returns the page's clock (`Date.now()`) on the frame where the change first shows.
 */
async function appears(page, stamp, arg) {
  return (await page.waitForFunction(stamp, arg, { polling: 'raf' })).jsonValue();
}

const filtered = (page, on) =>
  appears(
    page,
    (on) =>
      getComputedStyle(document.documentElement).filter.includes('huefinch') === on && Date.now(),
    on,
  );

/** Box of an element, in the page's CSS px, for an event's area. */
async function boxOf(locator) {
  const b = await locator.boundingBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** Evaluates code in Huefinch's content-script world (DevTools can reach it; pages can't). */
async function inContentWorld(page, expression) {
  const cdp = await page.context().newCDPSession(page);
  const contexts = [];
  cdp.on('Runtime.executionContextCreated', (e) => contexts.push(e.context));
  await cdp.send('Runtime.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const ctx = contexts.find(
    (c) =>
      c.name === EXTENSION_NAME &&
      c.auxData?.type === 'isolated' &&
      c.auxData.frameId === frameTree.frame.id,
  );
  if (!ctx) throw new Error('Huefinch content script world not found');
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    contextId: ctx.id,
    awaitPromise: true,
  });
  await cdp.detach();
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
}

// ── 1. Setup (not recorded) ─────────────────────────────────────────────────

/** The shop page's true color under the identify scene's click, with Huefinch off. */
async function sampleTee(dir, server) {
  const { ctx, sw } = await launch(dir, false, server);
  await settings(sw, { enabled: false });
  const page = await ctx.newPage();
  await page.goto(`${server.site('shop')}/shop.html`);
  await filtered(page, false);
  await sleep(300);
  const png = await page.screenshot({
    clip: { x: TEE_POINT.x, y: TEE_POINT.y, width: 1, height: 1 },
  });
  const hex = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }, png.toString('base64'));
  await ctx.close();
  return hex;
}

// ── 2. Recording ────────────────────────────────────────────────────────────

async function record(dir, server, extId, teeHex) {
  const { ctx, sw } = await launch(dir, true, server);
  await ctx.addInitScript(installCursor);
  const ext = (p) => `chrome-extension://${extId}/${p}`;
  const scenes = {};
  // Moments on the wall clock: effects are placed on them, `end` marks a scene's last
  // visible change (audio.py knows how far its pause can shrink), and `show`/`hide`
  // say when the popup is on screen.
  const events = [];
  const note = (type, wall = Date.now(), area = null) => events.push({ type, wall, area });
  const pages = new Map(); // page → { syncs: wall times of its sync flashes }

  /**
   * Every recorded page gets its own window whose content area is exactly the
   * wanted size. Headed Chromium's screencast captures the real content area,
   * so this is what makes the footage pixel-exact.
   */
  let windows = 0;
  const newPage = async (viewport = REC, left = 0) => {
    const token = `${server.url}/blank?window=${++windows}`;
    const windowId = await sw.evaluate(
      async ({ token, left, width, height }) =>
        (await chrome.windows.create({ url: token, type: 'popup', left, top: 0, width, height }))
          .id,
      { token, left, ...viewport },
    );
    let page;
    for (let i = 0; !page; i++) {
      page = ctx.pages().find((p) => p.url() === token);
      if (i > 100) throw new Error(`Window ${token} never appeared`);
      if (!page) await sleep(50);
    }
    pages.set(page, { syncs: [], windowId });
    await fit(page, viewport);
    return page;
  };
  const fit = async (page, viewport) => {
    const { windowId } = pages.get(page);
    for (let i = 0; i < 6; i++) {
      const m = await page.evaluate(() => ({
        ow: outerWidth,
        oh: outerHeight,
        iw: innerWidth,
        ih: innerHeight,
      }));
      if (m.iw === viewport.width && m.ih === viewport.height) return;
      await sw.evaluate(
        ({ windowId, width, height }) => chrome.windows.update(windowId, { width, height }),
        { windowId, width: viewport.width + m.ow - m.iw, height: viewport.height + m.oh - m.ih },
      );
      await sleep(250);
    }
    const size = await page.evaluate(() => [innerWidth, innerHeight]);
    if (size[0] !== viewport.width || size[1] !== viewport.height)
      throw new Error(
        `Window content is ${size.join('×')}, wanted ${viewport.width}×${viewport.height}`,
      );
  };
  const tabOf = (page) =>
    sw.evaluate(
      async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)?.id,
      page.url(),
    );

  /** The toolbar popup for a tab, in its own window: 500 px wide (Chrome's minimum), cropped to 340. */
  const popupFor = async (page) => {
    const tab = await tabOf(page);
    const popup = await newPage({ width: 500, height: REC.height }, 1320);
    await popup.goto(ext(`popup/popup.html?tab=${tab}`));
    await popup.locator('#hints p').first().waitFor();
    await sleep(300);
    const height = Math.ceil(
      await popup.evaluate(() => document.body.getBoundingClientRect().height),
    );
    await fit(popup, { width: 500, height });
    return { popup, height };
  };

  /**
   * A black flash over the whole page, outside any scene: once after it loads and
   * once before it closes. Scene times are mapped onto each video through these
   * two flashes. Black, because Huefinch recolors magenta (the flash is in the top
   * layer, which Huefinch filters too) but leaves black exactly black.
   */
  const sync = async (page) => {
    if (pages.get(page).syncs.length === 0) await sleep(1200);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const d = document.createElement('div');
          d.id = '__demo_sync';
          d.setAttribute('popover', 'manual');
          d.style.cssText =
            'position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#000;pointer-events:none';
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
  const begin = (parts) => {
    const now = Date.now();
    return parts.map((p) => ({ ...p, wall: now }));
  };
  const mark = (id, parts, t0) => (scenes[id] = { parts, actions: (Date.now() - t0) / 1000 });
  /** Keep the page still after a scene until its slot (plus margin) is covered. */
  const tail = (id) =>
    sleep(
      Math.max(1500, (SCENES.find((s) => s.id === id).duration - scenes[id].actions + 1) * 1000),
    );
  const cursor = (page, visible) => page.evaluate((v) => window.__demo.cursor(v), visible);
  const panelOf = (page) => boxOf(page.locator('.panel'));

  // ── Scene: the chart, Huefinch off → popup: Green-weak, switch on ───────────
  await settings(sw, {
    enabled: false,
    mode: 'correct',
    type: 'protan',
    strength: 80,
    severity: 100,
    offSites: [],
  });
  const chart = await newPage();
  await chart.goto(`${server.site('dashboard')}/dashboard.html`);
  await chart.waitForFunction(() => !!document.querySelector('huefinch-root'));
  await filtered(chart, false);
  const p1 = await popupFor(chart);
  await sync(chart);
  await sync(p1.popup);
  const a = new Actor(chart, note);
  const pa = new Actor(p1.popup, note);
  await a.moveTo(760, 560, 5);
  await pa.moveTo(240, 30, 5);
  await sleep(400);
  let t0 = Date.now();
  const chartParts = begin([
    { page: chart },
    {
      page: p1.popup,
      crop: { w: POPUP.width, h: p1.height },
      x: POPUP.x,
      y: POPUP.y,
      overlay: true,
    },
  ]);
  await sleep(1100); // the inset: both lines look the same
  await a.moveTo(1262, 6, 26); // up to where Huefinch's toolbar icon would be
  await sleep(120);
  await cursor(chart, false);
  note('show', Date.now(), { page: p1.popup, x: 0, y: 0, w: POPUP.width, h: p1.height });
  await sleep(PAUSE);
  await pa.clickLocator(p1.popup.locator('label.option', { hasText: 'Green-weak' }), 'option');
  await sleep(PAUSE);
  const master = await boxOf(p1.popup.locator('label.switch').first());
  const t1 = Date.now();
  await pa.click(master.x + master.w / 2, master.y + master.h / 2, 'toggle', master);
  const onAt = await filtered(chart, true);
  if (onAt < t1) throw new Error('Filter was on before the switch');
  note('shimmer', onAt, { page: chart, ...(await panelOf(chart)) });
  await sleep(PAUSE * 1.6);
  await pa.moveTo(260, p1.height - 30, 18);
  await sleep(200);
  note('hide');
  await cursor(chart, true);
  await a.moveTo(560, 420, 26);
  note('end');
  await sleep(PAUSE);
  mark('chart', chartParts, t0);
  await tail('chart');
  await finish(p1.popup);

  // ── Scene: another site, already corrected ──────────────────────────────────
  await chart.goto(`${server.site('metro')}/transit.html`);
  await filtered(chart, true);
  await sleep(500);
  t0 = Date.now();
  const transitParts = begin([{ page: chart }]);
  await a.moveTo(300, 260, 24);
  await sleep(PAUSE);
  await a.moveTo(560, 330, 30);
  note('end');
  await sleep(PAUSE);
  mark('transit', transitParts, t0);
  await tail('transit');

  // ── Scene: hold Alt+Shift+X to compare ──────────────────────────────────────
  t0 = Date.now();
  const holdParts = begin([{ page: chart }]);
  await sleep(500);
  const map = await panelOf(chart);
  await chart.evaluate(() => window.__demo.keys(['Alt', 'Shift', 'X']));
  await chart.keyboard.down('Alt');
  await chart.keyboard.down('Shift');
  const pressed = Date.now();
  await chart.keyboard.down('KeyX');
  note('press', await filtered(chart, false), { page: chart, ...map });
  if (Date.now() - pressed > 2000) throw new Error('Alt+Shift+X did not show the original colors');
  await sleep(1700);
  await chart.keyboard.up('KeyX');
  await chart.keyboard.up('Shift');
  await chart.keyboard.up('Alt');
  note('release', await filtered(chart, true), { page: chart, ...map });
  await chart.evaluate(() => window.__demo.keys(null));
  note('end');
  await sleep(PAUSE * 1.5);
  mark('hold', holdParts, t0);
  await tail('hold');
  await finish(chart);

  // ── Scene: name a color on the shop page ────────────────────────────────────
  const shop = await newPage();
  await shop.goto(`${server.site('shop')}/shop.html`);
  await filtered(shop, true);
  // The stand-in for Chrome's eyedropper: resolves with the true color under the click.
  await inContentWorld(
    shop,
    `globalThis.EyeDropper = class {
       open() {
         return new Promise((resolve) => addEventListener('pointerdown', (e) => {
           e.preventDefault();
           e.stopPropagation();
           resolve({ sRGBHex: ${JSON.stringify(teeHex)} });
         }, { capture: true, once: true }));
       }
     };`,
  );
  await sync(shop);
  const s = new Actor(shop, note);
  await s.moveTo(560, 520, 5);
  await sleep(400);
  t0 = Date.now();
  const shopParts = begin([{ page: shop }]);
  await sleep(500);
  await shop.evaluate(() => window.__demo.keys(['Alt', 'Shift', 'C']));
  await sleep(250);
  // What changes on the key press: the page's real colors come back for picking.
  const photo = await boxOf(shop.locator('.photo').first());
  await shop.keyboard.press('Alt+Shift+KeyC');
  note('key', await filtered(shop, false), { page: shop, ...photo });
  await shop.evaluate(() => window.__demo.loupe(true));
  await sleep(450);
  await shop.evaluate(() => window.__demo.keys(null));
  await s.moveTo(TEE_POINT.x, TEE_POINT.y, 36);
  await sleep(500);
  await shop.mouse.down();
  await shop.mouse.up();
  await shop.evaluate(() => window.__demo.loupe(false));
  const cardAt = await appears(
    shop,
    () => document.querySelector('huefinch-identify')?.matches(':popover-open') && Date.now(),
  );
  note('pick', cardAt, { page: shop, x: REC.width - 16 - 330, y: 16, w: 330, h: 100 });
  await sleep(PAUSE);
  await s.moveTo(640, 560, 30);
  note('end');
  await sleep(PAUSE * 2);
  mark('identify', shopParts, t0);
  await tail('identify');
  await finish(shop);

  // ── Scene: Simulate on the sign-up form ─────────────────────────────────────
  await settings(sw, { enabled: true, mode: 'correct', type: 'deutan', severity: 100 });
  const form = await newPage();
  await form.goto(`${server.site('app')}/signup.html`);
  await filtered(form, true);
  const p2 = await popupFor(form);
  await sync(form);
  await sync(p2.popup);
  const f = new Actor(form, note);
  const pf = new Actor(p2.popup, note);
  await f.moveTo(820, 520, 5);
  await pf.moveTo(240, 30, 5);
  await sleep(400);
  t0 = Date.now();
  const formParts = begin([
    { page: form },
    {
      page: p2.popup,
      crop: { w: POPUP.width, h: p2.height },
      x: POPUP.x,
      y: POPUP.y,
      overlay: true,
    },
  ]);
  await sleep(500);
  await f.moveTo(1262, 6, 26);
  await sleep(120);
  await cursor(form, false);
  note('show', Date.now(), { page: p2.popup, x: 0, y: 0, w: POPUP.width, h: p2.height });
  await sleep(PAUSE);
  await pf.clickLocator(p2.popup.locator('.segmented label', { hasText: 'Simulate' }), 'option');
  await appears(form, () => document.querySelector('huefinch-pill') && Date.now());
  await sleep(PAUSE * 2);
  note('hide');
  await cursor(form, true);
  await f.moveTo(420, 600, 26);
  note('end');
  await sleep(PAUSE * 1.5);
  mark('simulate', formParts, t0);
  await tail('simulate');
  await finish(form, p2.popup);

  // ── Scene: settings, Websites and privacy ───────────────────────────────────
  const opts = await newPage();
  await opts.goto(ext('options/options.html#websites'));
  await opts.waitForSelector('html[data-ready]');
  await sync(opts);
  const o = new Actor(opts, note);
  await o.moveTo(1150, 700, 5);
  await sleep(400);
  t0 = Date.now();
  const optsParts = begin([{ page: opts }]);
  await sleep(300);
  const auto = await boxOf(opts.locator('#websites .row').first());
  await o.moveTo(auto.x + auto.w - 60, auto.y + auto.h / 2 + 14);
  await sleep(PAUSE);
  const privacy = await boxOf(opts.locator('#websites .row').nth(2));
  await o.moveTo(privacy.x + 320, privacy.y + privacy.h - 8);
  note('end');
  await sleep(PAUSE * 1.5);
  mark('privacy', optsParts, t0);
  await tail('privacy');
  await finish(opts);

  // Videos are finalised when their pages close; collect the paths and events.
  for (const sc of Object.values(scenes)) {
    const from = sc.parts[0].wall;
    const next = Math.min(
      ...Object.values(scenes)
        .map((x) => x.parts[0].wall)
        .filter((w) => w > from),
    );
    sc.events = events
      .filter((e) => e.wall >= from && e.wall < next)
      .map(({ type, wall, area }) => ({
        type,
        t: +((wall - from) / 1000).toFixed(3),
        ...(area && {
          area: {
            part: sc.parts.findIndex((x) => x.page === area.page),
            x: Math.round(area.x),
            y: Math.round(area.y),
            w: Math.round(area.w),
            h: Math.round(area.h),
          },
        }),
      }));
    for (const part of sc.parts) {
      part.video = await part.page.video().path();
      part.syncs = pages.get(part.page).syncs;
    }
  }
  await ctx.close();
  return scenes;
}

/** Times (s) at which each black sync flash starts in a recording. */
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
  // Two patches must both be black (no page is black there by itself); both lie inside
  // every recording, including the 500 px popup window drawn in a 1280×800 frame.
  const sample = (crop) =>
    execFileSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        video,
        '-fps_mode',
        'passthrough',
        '-vf',
        `${crop},scale=1:1`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        '-',
      ],
      { maxBuffer: 1 << 26 },
    );
  const a = sample('crop=16:16:8:8');
  const b = sample('crop=16:16:100:100');
  const starts = [];
  let on = false;
  for (let i = 0; i < a.length / 3; i++) {
    const dark = (buf) => buf[i * 3] < 24 && buf[i * 3 + 1] < 24 && buf[i * 3 + 2] < 24;
    const black = dark(a) && dark(b);
    if (black && !on) starts.push(pts[i]);
    on = black;
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
  const teeHex = await sampleTee(dir, server);
  console.log(`  identify: the T-shirt's true color under the click is ${teeHex.toUpperCase()}`);
  const scenes = await record(dir, server, id, teeHex);
  const manifest = {};
  for (const [sceneId, s] of Object.entries(scenes)) {
    const slot = SCENES.find((x) => x.id === sceneId).duration;
    manifest[sceneId] = {
      actions: s.actions,
      events: s.events, // t: seconds after the scene begins; shown at its start + LEAD + t
      parts: s.parts.map(({ video, wall, syncs, crop, x, y, overlay }) => {
        const [v1, v2] = flashTimes(video);
        const rate = (v2 - v1) / ((syncs[1] - syncs[0]) / 1000); // video seconds per wall second
        return {
          video,
          offset: +(v1 + ((wall - syncs[0]) / 1000) * rate).toFixed(3),
          rate: +rate.toFixed(4),
          crop: crop ?? null,
          x: x ?? 0,
          y: y ?? 0,
          overlay: !!overlay,
        };
      }),
    };
    const flag = s.actions > slot - 0.4 ? '  ⚠ longer than its slot' : '';
    console.log(
      `  ${sceneId.padEnd(10)} actions ${s.actions.toFixed(2)} s / slot ${slot} s${flag}`,
    );
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(
    join(OUT, 'identify.json'),
    JSON.stringify({ point: TEE_POINT, hex: teeHex }, null, 2),
  );
  console.log('Recorded scenes → tools/demo-video/out/manifest.json');
} finally {
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
