import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserName, extensionsPage, storeFor } from '../../src/shared/browser';
import { messages, restrictionFor, explainScriptingError } from '../../src/background/pages';
import { finishRating, rateState, shouldAsk, RATE_KEY } from '../../src/popup/rate';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const EDGE_UA = `${CHROME_UA} Edg/155.0.0.0`;
const ID = 'abcdefghijklmnopabcdefghijklmnop';

function useAgent(ua: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

afterEach(() => vi.restoreAllMocks());

describe('browser', () => {
  it('names Edge from its user agent and Chrome otherwise', () => {
    expect(browserName(EDGE_UA)).toBe('Edge');
    expect(browserName(CHROME_UA)).toBe('Chrome');
    expect(browserName('Mozilla/5.0 Edge/18.0')).toBe('Chrome'); // legacy EdgeHTML is not "Edg/"
    expect(extensionsPage('Edge')).toBe('edge://extensions');
    expect(extensionsPage('Chrome')).toBe('chrome://extensions');
  });

  it('finds the store a copy came from, by its update URL', () => {
    expect(storeFor('https://clients2.google.com/service/update2/crx', ID)).toEqual({
      name: 'Chrome Web Store',
      reviewUrl: `https://chromewebstore.google.com/detail/${ID}/reviews`,
    });
    expect(storeFor('https://edge.microsoft.com/extensionwebstorebase/v1/crx', ID)).toEqual({
      name: 'Edge Add-ons',
      reviewUrl: `https://microsoftedge.microsoft.com/addons/detail/${ID}`,
    });
    expect(storeFor(undefined, ID)).toBeNull(); // unpacked / development
    expect(storeFor('https://example.org/updates.xml', ID)).toBeNull(); // self-hosted
    expect(storeFor('not a url', ID)).toBeNull();
    expect(storeFor('https://google.com.evil.example/crx', ID)).toBeNull();
  });
});

describe('restricted-page messages', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: { getURL: (p: string) => `chrome-extension://${ID}/${p}` },
      extension: { isAllowedFileSchemeAccess: async () => false },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('speaks Chrome in Chrome and Edge in Edge', () => {
    const chrome = messages('Chrome');
    const edge = messages('Edge');
    expect(chrome.chromePage).toMatch(/^Chrome doesn't let extensions run on its own pages/);
    expect(edge.chromePage).toMatch(/^Edge doesn't let extensions run on its own pages/);
    expect(chrome.webStore).toContain('the Chrome Web Store');
    expect(edge.webStore).toContain('Edge Add-ons');
    expect(edge.fileAccess).toContain('edge://extensions');
    expect(chrome.fileAccess).toContain('chrome://extensions');
    expect(edge.pdfViewer).toContain("Edge's built-in viewer");
    for (const m of [...Object.values(edge)]) expect(m).not.toMatch(/Chrome(?! Web Store)/);
  });

  it('recognises the Edge Add-ons store and edge:// pages', async () => {
    useAgent(EDGE_UA);
    const edge = messages('Edge');
    expect(
      await restrictionFor('https://microsoftedge.microsoft.com/addons/detail/ublock-origin/x'),
    ).toEqual({ reason: edge.webStore });
    expect(await restrictionFor('edge://settings')).toEqual({ reason: edge.chromePage });
    expect(await restrictionFor('https://chromewebstore.google.com/detail/x')).toEqual({
      reason: edge.webStore,
    });
    expect(await restrictionFor('https://microsoftedge.microsoft.com/other')).toBeNull();
    // What Edge actually throws on its store (measured on Edge 155).
    expect(explainScriptingError(new Error('The extensions gallery cannot be scripted.'))).toEqual({
      reason: edge.webStore,
      restricted: true,
    });
    expect(explainScriptingError(new Error('Cannot access a edge:// URL'))).toEqual({
      reason: edge.chromePage,
      restricted: true,
    });
  });

  it('keeps the Chrome wording in Chrome', async () => {
    useAgent(CHROME_UA);
    expect(await restrictionFor('chrome://settings')).toEqual({
      reason: messages('Chrome').chromePage,
    });
  });
});

describe('rating prompt', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const t0 = Date.UTC(2026, 9, 1);

  it('asks only after three days and ten highlights, and never once answered', () => {
    expect(shouldAsk({ firstSeen: t0 }, t0 + 3 * DAY, 10)).toBe(true);
    expect(shouldAsk({ firstSeen: t0 }, t0 + 3 * DAY - 1, 50)).toBe(false);
    expect(shouldAsk({ firstSeen: t0 }, t0 + 30 * DAY, 9)).toBe(false);
    expect(shouldAsk({ firstSeen: t0, done: true }, t0 + 30 * DAY, 500)).toBe(false);
  });

  it('remembers when it was first seen and that it was answered, in local storage only', async () => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (k: string) => ({ [k]: store[k] }),
          set: async (o: Record<string, unknown>) => Object.assign(store, o),
        },
      },
    });
    const first = await rateState(t0);
    expect(first).toEqual({ firstSeen: t0 });
    expect(await rateState(t0 + 5 * DAY)).toEqual({ firstSeen: t0 }); // not reset later
    await finishRating(first);
    expect(store[RATE_KEY]).toEqual({ firstSeen: t0, done: true });
    vi.unstubAllGlobals();
  });
});
