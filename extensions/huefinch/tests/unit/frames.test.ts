import { describe, expect, it } from 'vitest';
import { chromiumMajor, frameRole, OWN_FILTER_FROM, topSiteOf } from '../../src/content/frames';

const ua = (v: number, edge = false) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36${edge ? ` Edg/${v}.0.0.0` : ''}`;

/** A frame whose parent is (or isn't) reachable, as the browser decides. */
function frame(sameOriginParent: boolean) {
  const parent = sameOriginParent
    ? { document: {} }
    : {
        get document(): unknown {
          throw new DOMException(
            'Blocked a frame from accessing a cross-origin frame.',
            'SecurityError',
          );
        },
      };
  return { top: {}, parent };
}

describe('chromiumMajor', () => {
  it('reads the Chromium version of Chrome, Edge and headless builds', () => {
    expect(chromiumMajor(ua(155))).toBe(155);
    expect(chromiumMajor(ua(151, true))).toBe(151);
    expect(chromiumMajor(ua(150).replace('Chrome/', 'HeadlessChrome/'))).toBe(150);
    expect(
      chromiumMajor('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'),
    ).toBeNull();
  });
});

describe('frameRole', () => {
  it('the top page always filters itself', () => {
    const win = { top: null as unknown, parent: { document: {} } };
    win.top = win;
    expect(frameRole(win, ua(140))).toBe('top');
    expect(frameRole(win, ua(155))).toBe('top');
  });

  it('a frame of its parent’s origin is covered by the filter above it', () => {
    expect(frameRole(frame(true), ua(155))).toBe('covered');
    expect(frameRole(frame(true), ua(140))).toBe('covered');
  });

  it(`a cross-origin frame filters itself from Chromium ${OWN_FILTER_FROM} on, never before`, () => {
    expect(frameRole(frame(false), ua(OWN_FILTER_FROM - 1))).toBe('covered');
    expect(frameRole(frame(false), ua(OWN_FILTER_FROM))).toBe('own');
    expect(frameRole(frame(false), ua(155, true))).toBe('own');
    expect(frameRole(frame(false), 'unknown browser')).toBe('covered');
  });
});

describe('topSiteOf', () => {
  it('is the hostname of the outermost ancestor', () => {
    expect(topSiteOf(['http://127.0.0.1:4000', 'https://www.News.example'])).toBe('news.example');
    expect(topSiteOf(['https://shop.example:8443'])).toBe('shop.example');
  });
  it('is null when the browser does not say', () => {
    expect(topSiteOf(undefined)).toBeNull();
    expect(topSiteOf([])).toBeNull();
    expect(topSiteOf(['null'])).toBeNull();
  });
});
