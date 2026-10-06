/** Shared e2e fixtures: a fresh profile per test, the fixture server, and helpers. */
import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng } from '../../scripts/lib/png.mjs';
import { applyToSrgb255, feColorMatrixValues, matrixFor, type Mat3, type Vec3 } from '../../src/shared/matrix';
import type { Settings } from '../../src/shared/settings';
import { EXTENSION_NAME, FIXTURES, PROFILE_TEMPLATE, TEMPLATE_INFO, chromeArgs } from './paths';
import { startServer, type FixtureServer } from './server';

export const ALL_SITES = ['https://*/*', 'http://*/*'];
/** Stands in for the activeTab grant a toolbar click gives (the fixture server's origin). */
export const LOCAL_ONLY = ['http://127.0.0.1/*'];

export interface Ext {
  ctx: BrowserContext;
  sw: Worker;
  id: string;
  url(path: string): string;
  server: FixtureServer;
  /** Console errors and uncaught exceptions from every page. */
  errors: string[];
}

/**
 * Chrome stores what the user granted in the profile. Writing it there is the
 * test equivalent of the user accepting Chrome's permission prompt, and leaves
 * the shipped build untouched.
 */
function grantOrigins(profile: string, id: string, origins: string[]): void {
  const file = join(profile, 'Default/Preferences');
  const prefs = JSON.parse(readFileSync(file, 'utf8'));
  const s = prefs.extensions.settings[id];
  for (const key of ['granted_permissions', 'active_permissions'])
    s[key] = { ...(s[key] ?? {}), explicit_host: origins, scriptable_host: [] };
  writeFileSync(file, JSON.stringify(prefs));
}

export async function launchExtension(origins: string[]): Promise<Omit<Ext, 'server'> & { profile: string }> {
  const { id } = JSON.parse(readFileSync(TEMPLATE_INFO, 'utf8')) as { id: string };
  const profile = mkdtempSync(join(tmpdir(), 'huefinch-e2e-'));
  cpSync(PROFILE_TEMPLATE, profile, { recursive: true });
  grantOrigins(profile, id, origins);
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: chromeArgs(),
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  await sw.evaluate(() => (globalThis as unknown as { huefinch: { ready: Promise<void> } }).huefinch.ready);
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${p.url()}: ${m.text()}`);
    });
    p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
  };
  ctx.pages().forEach(watch);
  ctx.on('page', watch);
  return { ctx, sw, id, url: (path) => `chrome-extension://${id}/${path}`, errors, profile };
}

export const test = base.extend<{ ext: Ext; origins: string[] }>({
  origins: [ALL_SITES, { option: true }],
  ext: async ({ origins }, use) => {
    const server = await startServer(FIXTURES);
    const launched = await launchExtension(origins);
    await use({ ...launched, server });
    await launched.ctx.close();
    await server.close();
    rmSync(launched.profile, { recursive: true, force: true });
  },
});

export { expect };

// --- Driving the extension -------------------------------------------------------------

type Api = {
  activateTab(id: number): Promise<{ ok: boolean; reason?: string }>;
  identify(id: number): Promise<{ ok: boolean }>;
  toggle(): Promise<boolean>;
  syncRegistration(): Promise<boolean>;
};

export async function tabId(ext: Ext, page: Page): Promise<number> {
  return ext.sw.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === url);
    if (tab?.id === undefined) throw new Error(`No tab for ${url}`);
    return tab.id;
  }, page.url());
}

/** Runs Huefinch on a tab the way a toolbar click does (activeTab). */
export async function activate(ext: Ext, page: Page): Promise<{ ok: boolean; reason?: string }> {
  const id = await tabId(ext, page);
  return ext.sw.evaluate((id) => (globalThis as unknown as { huefinch: Api }).huefinch.activateTab(id), id);
}

export async function api<T>(ext: Ext, fn: string, arg?: number): Promise<T> {
  return ext.sw.evaluate(
    ([fn, arg]) => (globalThis as unknown as Record<string, Record<string, (a?: number) => Promise<T>>>).huefinch[fn]!(arg),
    [fn, arg] as const,
  ) as Promise<T>;
}

export async function setSettings(ext: Ext, patch: Partial<Settings>): Promise<void> {
  await ext.sw.evaluate((patch) => chrome.storage.local.set(patch), patch);
}

export async function getSettings(ext: Ext): Promise<Record<string, unknown>> {
  return ext.sw.evaluate(() => chrome.storage.local.get(null));
}

// --- Reading the page (from the outside, the way a test would) ---------------------------

export interface FilterState {
  roots: number;
  values: string | null;
  css: string;
  htmlFilter: string;
}

export async function filterState(page: Page): Promise<FilterState> {
  return page.evaluate(() => {
    const root = document.querySelector('huefinch-root');
    return {
      roots: document.querySelectorAll('huefinch-root').length,
      values: root?.querySelector('feColorMatrix')?.getAttribute('values') ?? null,
      css: root?.querySelector('style')?.textContent ?? '',
      htmlFilter: getComputedStyle(document.documentElement).filter,
    };
  });
}

/** Waits until the page shows this matrix (or no filter, with null), then for two frames. */
export async function waitForFilter(page: Page, m: Mat3 | null): Promise<void> {
  const want = m ? feColorMatrixValues(m) : null;
  await expect
    .poll(async () => {
      const s = await filterState(page);
      if (!want) return s.htmlFilter === 'none';
      return s.htmlFilter.includes('huefinch-filter') && s.values === want;
    })
    .toBe(true);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

export function matrixOf(s: Pick<Settings, 'mode' | 'type'> & { amount: number }): Mat3 {
  return matrixFor(s.mode, s.type, s.amount);
}

/** Pixels at viewport points, from one screenshot. */
export async function pixels(page: Page, points: Array<[number, number]>): Promise<Vec3[]> {
  const png = decodePng(await page.screenshot({ animations: 'disabled', caret: 'hide' }));
  return points.map(([x, y]) => {
    const i = (Math.round(y) * png.width + Math.round(x)) * 4;
    return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
  });
}

/** The color the browser should paint: sRGB → linear → matrix (applied `times` times) → sRGB. */
export function expected(m: Mat3 | null, rgb: Vec3, times = 1): Vec3 {
  let c = rgb;
  for (let i = 0; m && i < times; i++) c = applyToSrgb255(m, c);
  return c;
}

export function expectClose(actual: Vec3, want: Vec3, label: string, tolerance = 3): void {
  const diff = Math.max(...actual.map((v, i) => Math.abs(v - want[i]!)));
  expect(diff, `${label}: got rgb(${actual}), expected rgb(${want})`).toBeLessThanOrEqual(tolerance);
}

// --- Inside the content script's isolated world -------------------------------------------

/**
 * Evaluates code in Huefinch's content-script world (the extension's isolated
 * world), e.g. to stand in for the browser's EyeDropper. Page scripts can't
 * reach this world; DevTools can.
 */
export async function evalInContentWorld(page: Page, expression: string): Promise<unknown> {
  const cdp = await page.context().newCDPSession(page);
  const contexts: Array<{ id: number; name: string; auxData?: { type?: string; isDefault?: boolean; frameId?: string } }> = [];
  cdp.on('Runtime.executionContextCreated', (e) => contexts.push(e.context));
  await cdp.send('Runtime.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const ctx = contexts.find(
    (c) => c.name === EXTENSION_NAME && c.auxData?.type === 'isolated' && c.auxData.frameId === frameTree.frame.id,
  );
  if (!ctx) {
    await cdp.detach();
    throw new Error('Huefinch content script world not found');
  }
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    contextId: ctx.id,
    awaitPromise: true,
    returnByValue: true,
  });
  await cdp.detach();
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

/** Text inside Huefinch's closed shadow roots (DevTools can see them; pages can't). */
export async function shadowText(page: Page, host: string): Promise<string> {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  await cdp.detach();
  type N = { nodeName: string; nodeType: number; nodeValue?: string; children?: N[]; shadowRoots?: N[] };
  const texts: string[] = [];
  const collect = (n: N) => {
    if (n.nodeType === 3 && n.nodeValue?.trim()) texts.push(n.nodeValue.trim());
    for (const c of [...(n.shadowRoots ?? []), ...(n.children ?? [])]) collect(c);
  };
  const find = (n: N): N | null => {
    if (n.nodeName.toLowerCase() === host) return n;
    for (const c of [...(n.shadowRoots ?? []), ...(n.children ?? [])]) {
      const f = find(c);
      if (f) return f;
    }
    return null;
  };
  const h = find(root as N);
  if (h) collect(h);
  return texts.join(' | ');
}

export function fixture(ext: Ext, path: string): string {
  return `${ext.server.url}/${path}`;
}
