/** Shared e2e fixtures: a fresh profile per test, the fixture server, and helpers. */
import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makePdf } from '../../scripts/lib/pdf-writer.mjs';
import { CHANNEL, FIXTURES, PROFILE_TEMPLATE, TEMPLATE_INFO, chromeArgs } from './paths';
import { startServer, type FixtureServer } from './server';

export const ALWAYS_ON = ['http://*/*', 'https://*/*'];

/** A small multi-page PDF used by the viewer tests. */
export const STUDY_PDF = makePdf({
  title: 'Spaced retrieval study',
  seed: 'e2e-study',
  pages: [
    [
      { text: 'Spaced retrieval study', size: 22, bold: true },
      {
        text: 'Students who practised retrieval recalled more material after one week than students who restudied.',
      },
    ],
    [
      { text: '3. Results', size: 15, bold: true },
      {
        text: 'The retrieval group retained 61% of key ideas at seven days, compared with 38% for the restudy group.',
      },
      { text: 'Spacing the retrieval sessions produced a further gain.' },
    ],
  ],
});

export interface Ext {
  ctx: BrowserContext;
  sw: Worker;
  id: string;
  url(path: string): string;
  server: FixtureServer;
  errors: string[];
}

/**
 * Chrome stores what the user granted in the profile. Writing it there is the
 * test equivalent of the user accepting Chrome's permission prompt (or of the
 * activeTab grant a click gives), and leaves the shipped build untouched.
 */
function grantOrigins(profile: string, id: string, origins: string[]): void {
  const file = join(profile, 'Default/Preferences');
  const prefs = JSON.parse(readFileSync(file, 'utf8'));
  const s = prefs.extensions.settings[id];
  for (const key of ['granted_permissions', 'active_permissions']) {
    s[key] = { ...(s[key] ?? {}), explicit_host: origins, scriptable_host: [] };
  }
  writeFileSync(file, JSON.stringify(prefs));
}

export async function launchExtension(
  opts: { origins?: string[] } = {},
): Promise<Omit<Ext, 'server'> & { profile: string }> {
  const { id } = JSON.parse(readFileSync(TEMPLATE_INFO, 'utf8')) as { id: string };
  const profile = mkdtempSync(join(tmpdir(), 'bowerline-e2e-'));
  cpSync(PROFILE_TEMPLATE, profile, { recursive: true });
  grantOrigins(profile, id, opts.origins ?? ['http://127.0.0.1/*']);
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: CHANNEL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: chromeArgs(),
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${p.url()}: ${m.text()}`);
    });
    p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
  };
  ctx.pages().forEach(watch);
  ctx.on('page', watch);
  return {
    ctx,
    sw,
    id,
    url: (path: string) => `chrome-extension://${id}/${path}`,
    errors,
    profile,
  };
}

export const test = base.extend<{ ext: Ext; origins: string[] }>({
  origins: [['http://127.0.0.1/*'], { option: true }],
  ext: async ({ origins }, use) => {
    const server = await startServer(FIXTURES, {
      '/study.pdf': STUDY_PDF,
      '/renamed.pdf': STUDY_PDF,
    });
    const launched = await launchExtension({ origins });
    await use({ ...launched, server });
    await launched.ctx.close();
    await server.close();
    rmSync(launched.profile, { recursive: true, force: true });
  },
});

export { expect };

/** Runs Bowerline on a page the way a toolbar click or the shortcut does. */
export async function activate(
  ext: Ext,
  page: Page,
  highlightSelection = false,
): Promise<{ highlighted: boolean }> {
  await page.bringToFront();
  return ext.sw.evaluate(
    async ({ url, highlightSelection }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((t) => t.url === url);
      if (!tab) throw new Error(`No tab for ${url}`);
      const g = globalThis as unknown as {
        bowerline: {
          activateTab(t: chrome.tabs.Tab, o: object): Promise<{ highlighted: boolean }>;
        };
      };
      return g.bowerline.activateTab(tab, { highlightSelection, announce: false });
    },
    { url: page.url(), highlightSelection },
  );
}

/** Selects an occurrence of `text` inside `selector`, ignoring differences in whitespace. */
export async function selectText(
  page: Page,
  selector: string,
  text: string,
  occurrence = 0,
): Promise<void> {
  await page.evaluate(
    ({ selector, text, occurrence }) => {
      const root = document.querySelector(selector);
      if (!root) throw new Error(`No ${selector}`);
      const pattern = new RegExp(
        text
          .split(/\s+/)
          .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s+'),
        'g',
      );
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let seen = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const data = (n as Text).data;
        for (const m of data.matchAll(pattern)) {
          if (seen++ !== occurrence) continue;
          const r = document.createRange();
          r.setStart(n, m.index!);
          r.setEnd(n, m.index! + m[0].length);
          const sel = window.getSelection()!;
          sel.removeAllRanges();
          sel.addRange(r);
          return;
        }
      }
      throw new Error(`Text not found: ${text}`);
    },
    { selector, text, occurrence },
  );
}

/** Selects `text` inside `selector` even when it spans several text nodes (pdf.js lines). */
export async function selectAcross(page: Page, selector: string, text: string): Promise<void> {
  await page.evaluate(
    ({ selector, text }) => {
      const root = document.querySelector(selector)!;
      const nodes: Array<{ node: Text; start: number }> = [];
      let all = '';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        nodes.push({ node: n as Text, start: all.length });
        all += (n as Text).data;
      }
      const words = text.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const m = new RegExp(words.join('\\s*')).exec(all);
      if (!m) throw new Error(`Not found: ${text}`);
      const at = (offset: number, end: boolean) => {
        const hit = [...nodes].reverse().find((x) => (end ? x.start < offset : x.start <= offset))!;
        return { node: hit.node, offset: offset - hit.start };
      };
      const s = at(m.index, false);
      const e = at(m.index + m[0].length, true);
      const r = document.createRange();
      r.setStart(s.node, s.offset);
      r.setEnd(e.node, e.offset);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
    },
    { selector, text },
  );
}

/** Highlighted text currently registered in CSS.highlights, per colour. */
export async function renderedHighlights(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const out: Record<string, string[]> = {};
    for (const c of ['yellow', 'mint', 'pink', 'sky']) {
      const hl = CSS.highlights.get(`bowerline-${c}`);
      out[c] = hl ? [...hl].map((r) => (r as Range).toString().replace(/\s+/g, ' ').trim()) : [];
    }
    return out;
  });
}

/**
 * Clicks an element inside Bowerline's closed shadow root, found by its
 * aria-label or text. Uses DevTools' DOM view, which can see closed roots.
 */
export async function clickInShadow(
  page: Page,
  match: { label?: string; text?: string },
  timeout = 5000,
): Promise<void> {
  const until = Date.now() + timeout;
  for (;;) {
    try {
      await clickInShadowOnce(page, match);
      return;
    } catch (err) {
      if (Date.now() > until) throw err;
      await page.waitForTimeout(100);
    }
  }
}

async function clickInShadowOnce(
  page: Page,
  match: { label?: string; text?: string },
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  type N = {
    nodeId: number;
    backendNodeId: number;
    nodeName: string;
    attributes?: string[];
    children?: N[];
    shadowRoots?: N[];
    nodeValue?: string;
  };
  const textOf = (n: N): string => (n.nodeValue ?? '') + (n.children ?? []).map(textOf).join('');
  let found: N | null = null;
  const visit = (n: N, inShadow: boolean) => {
    if (found) return;
    const attrs = n.attributes ?? [];
    const label = attrs[attrs.indexOf('aria-label') + 1];
    if (inShadow && n.nodeName === 'BUTTON') {
      if (
        (match.label && attrs.includes('aria-label') && label === match.label) ||
        (match.text && textOf(n).trim() === match.text)
      ) {
        found = n;
        return;
      }
    }
    for (const s of n.shadowRoots ?? []) visit(s, true);
    for (const c of n.children ?? []) visit(c, inShadow);
  };
  visit(root as N, false);
  if (!found) await cdp.detach();
  if (!found) throw new Error(`Shadow button not found: ${JSON.stringify(match)}`);
  const { model } = await cdp.send('DOM.getBoxModel', {
    backendNodeId: (found as N).backendNodeId,
  });
  const q = model.content as number[];
  const x = ((q[0] ?? 0) + (q[2] ?? 0) + (q[4] ?? 0) + (q[6] ?? 0)) / 4;
  const y = ((q[1] ?? 0) + (q[3] ?? 0) + (q[5] ?? 0) + (q[7] ?? 0)) / 4;
  await cdp.detach();
  await page.mouse.click(x, y);
}

/** Whether Bowerline's shadow UI currently contains a button with this label/text. */
export async function shadowHas(
  page: Page,
  match: { label?: string; text?: string },
): Promise<boolean> {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    await cdp.detach();
    const json = JSON.stringify(root);
    return (
      (match.label ? json.includes(`"aria-label","${match.label}"`) : true) &&
      (match.text ? json.includes(`"nodeValue":"${match.text}"`) : true)
    );
  } catch {
    return false;
  }
}

export async function libraryCount(ext: Ext): Promise<number> {
  return ext.sw.evaluate(async () => {
    const g = globalThis as unknown as {
      bowerline: { getDb(): Promise<{ count(s: string): Promise<number> }> };
    };
    return (await g.bowerline.getDb()).count('highlights');
  });
}

/** Imports a backup through the service worker, as Settings → Restore does. */
export async function importBackup(ext: Ext, data: unknown): Promise<unknown> {
  const page = await ext.ctx.newPage();
  await page.goto(ext.url('options/options.html'));
  const report = await page.evaluate(
    (data) => chrome.runtime.sendMessage({ type: 'backup:import', data }),
    data,
  );
  await page.close();
  return report;
}

export function backupFile(sources: unknown[], highlights: unknown[]): unknown {
  return {
    format: 'bowerline-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    app: { name: 'Bowerline', version: 'test' },
    settings: {},
    sources,
    highlights,
  };
}

export async function storedHighlights(ext: Ext): Promise<Array<Record<string, unknown>>> {
  return ext.sw.evaluate(async () => {
    const g = globalThis as unknown as {
      bowerline: { getDb(): Promise<{ getAll(s: string): Promise<unknown[]> }> };
    };
    return (await (await g.bowerline.getDb()).getAll('highlights')) as Array<
      Record<string, unknown>
    >;
  });
}
