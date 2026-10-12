import { afterEach, describe, expect, it, vi } from 'vitest';
import { countOpen, finishRating, shouldAsk, type RateState } from '../../src/popup/rate';
import { DEFAULTS, migrate, RATE_KEY } from '../../src/shared/settings';
import { storeFor, storeInSentence } from '../../src/shared/store';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const DAY = 24 * 60 * 60 * 1000;

describe('storeFor', () => {
  it('finds the store a copy came from, by its update URL', () => {
    const chrome = storeFor('https://clients2.google.com/service/update2/crx', ID);
    expect(chrome).toEqual({
      name: 'Chrome Web Store',
      reviewUrl: `https://chromewebstore.google.com/detail/${ID}/reviews`,
    });
    const edge = storeFor('https://edge.microsoft.com/extensionwebstorebase/v1/crx', ID);
    expect(edge).toEqual({
      name: 'Edge Add-ons',
      reviewUrl: `https://microsoftedge.microsoft.com/addons/detail/${ID}`,
    });
    expect(storeInSentence(chrome!)).toBe('the Chrome Web Store');
    expect(storeInSentence(edge!)).toBe('Edge Add-ons');
  });

  it('has no store for unpacked, self-hosted or look-alike update URLs', () => {
    expect(storeFor(undefined, ID)).toBeNull();
    expect(storeFor('', ID)).toBeNull();
    expect(storeFor('https://example.org/updates.xml', ID)).toBeNull();
    expect(storeFor('not a url', ID)).toBeNull();
    expect(storeFor('https://google.com.evil.example/crx', ID)).toBeNull();
    expect(storeFor('https://notgoogle.com/crx', ID)).toBeNull();
    expect(storeFor('https://microsoft.com.evil.example/crx', ID)).toBeNull();
  });
});

describe('shouldAsk', () => {
  const now = 100 * DAY;
  const state = (days: number, opens: number, done = false): RateState => ({
    firstSeen: now - days * DAY,
    opens,
    ...(done ? { done } : {}),
  });

  it('asks after three days and five popup opens', () => {
    expect(shouldAsk(state(3, 5), now)).toBe(true);
    expect(shouldAsk(state(40, 50), now)).toBe(true);
  });

  it('waits for both, and never asks again once answered', () => {
    expect(shouldAsk(state(2.9, 50), now)).toBe(false);
    expect(shouldAsk(state(40, 4), now)).toBe(false);
    expect(shouldAsk(state(40, 50, true), now)).toBe(false);
  });
});

describe('countOpen / finishRating', () => {
  let store: Record<string, unknown> = {};
  const fakeChrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(store, items)),
      },
    },
  };
  vi.stubGlobal('chrome', fakeChrome);
  afterEach(() => {
    store = {};
    vi.clearAllMocks();
  });

  it('starts the clock on the first open and counts every open', async () => {
    expect(await countOpen(1000)).toEqual({ firstSeen: 1000, opens: 1 });
    expect(await countOpen(5000)).toEqual({ firstSeen: 1000, opens: 2 });
    expect(store[RATE_KEY]).toEqual({ firstSeen: 1000, opens: 2 });
  });

  it('stops writing once answered, and repairs a damaged reminder', async () => {
    const state = await countOpen(1000);
    await finishRating(state);
    expect(store[RATE_KEY]).toEqual({ firstSeen: 1000, opens: 1, done: true });
    fakeChrome.storage.local.set.mockClear();
    expect((await countOpen(9000)).done).toBe(true);
    expect(fakeChrome.storage.local.set).not.toHaveBeenCalled();

    store[RATE_KEY] = { firstSeen: 'yesterday', opens: null };
    expect(await countOpen(7000)).toEqual({ firstSeen: 7000, opens: 1 });
  });
});

describe('migration keeps the rating reminder', () => {
  it('is not removed as an unknown key', () => {
    const { remove } = migrate({
      ...DEFAULTS,
      schemaVersion: 1,
      [RATE_KEY]: { firstSeen: 1, opens: 3 },
      leftover: true,
    });
    expect(remove).toEqual(['leftover']);
  });
});
