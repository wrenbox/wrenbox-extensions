import { describe, expect, it } from 'vitest';
import {
  canRunOn,
  cleanSiteList,
  isOffOn,
  siteKey,
  siteOf,
  withSite,
} from '../../src/shared/hostname';

describe('site keys', () => {
  it.each([
    ['example.com', 'example.com'],
    ['WWW.Example.COM', 'example.com'],
    ['www.example.com.', 'example.com'],
    ['docs.google.com', 'docs.google.com'],
    ['www2.example.com', 'www2.example.com'],
    ['www.com', 'www.com'],
    ['127.0.0.1', '127.0.0.1'],
    ['[::1]', '[::1]'],
    ['xn--bcher-kva.example', 'xn--bcher-kva.example'],
    ['localhost', 'localhost'],
    ['', ''],
    ['exa mple.com', ''],
    ['example.com/path', ''],
    ['a..b', ''],
  ])('%s → %s', (input, key) => {
    expect(siteKey(input)).toBe(key);
  });
});

describe('site of a page address', () => {
  it('keeps only the hostname: no path, query, fragment, port or credentials', () => {
    expect(siteOf('https://user:pw@www.Example.com:8443/a/b?q=secret#frag')).toBe('example.com');
  });

  it('is null for anything that is not a web page', () => {
    for (const url of [
      'chrome://settings',
      'chrome-extension://abc/popup.html',
      'file:///home/me/doc.html',
      'about:blank',
      'data:text/html,hi',
      'javascript:alert(1)',
      'not a url',
      undefined,
      null,
    ])
      expect(siteOf(url)).toBeNull();
  });
});

describe('where Huefinch can run', () => {
  it.each([
    ['https://example.com/', true],
    ['http://127.0.0.1:8080/x', true],
    ['https://chromewebstore.google.com/detail/x', false],
    ['https://chrome.google.com/webstore/detail/x', false],
    ['https://chrome.google.com/other', true],
    ['https://microsoftedge.microsoft.com/addons/detail/x', false],
    ['chrome://extensions', false],
    ['edge://extensions', false],
    ['file:///tmp/a.html', false],
    [undefined, false],
  ])('%s → %s', (url, ok) => {
    expect(canRunOn(url)).toBe(ok);
  });
});

describe('the off-list', () => {
  it('adds and removes a site, normalizing it', () => {
    const off = withSite([], 'www.Photos.example.com', false);
    expect(off).toEqual(['photos.example.com']);
    expect(isOffOn(off, 'photos.example.com')).toBe(true);
    expect(isOffOn(off, 'example.com')).toBe(false);
    expect(isOffOn(off, null)).toBe(false);
    expect(withSite(off, 'photos.example.com', true)).toEqual([]);
  });

  it('does not duplicate a site, and moves it to the end when added again', () => {
    expect(withSite(['a.com', 'b.com'], 'a.com', false)).toEqual(['b.com', 'a.com']);
  });

  it('ignores invalid sites', () => {
    expect(withSite(['a.com'], 'not a host', false)).toEqual(['a.com']);
  });

  it('cleans stored lists and caps their length', () => {
    expect(cleanSiteList('a.com')).toEqual([]);
    expect(cleanSiteList(['A.com', 'a.com', null, 'b.com'])).toEqual(['a.com', 'b.com']);
    const many = Array.from({ length: 2500 }, (_, i) => `s${i}.com`);
    expect(cleanSiteList(many)).toHaveLength(2000);
  });
});
