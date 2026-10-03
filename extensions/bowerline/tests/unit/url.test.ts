import { describe, expect, it } from 'vitest';
import { displayUrl, fileNameFromUrl, looksLikePdfUrl, normalizeUrl } from '../../src/shared/url';

describe('normalizeUrl', () => {
  it('strips the hash', () => {
    expect(normalizeUrl('https://example.com/article#section-2')).toBe(
      'https://example.com/article',
    );
  });

  it('strips utm_* and click-id tracking parameters', () => {
    expect(
      normalizeUrl(
        'https://example.com/a?utm_source=x&utm_medium=email&UTM_Campaign=y&fbclid=1&gclid=2&mc_eid=3',
      ),
    ).toBe('https://example.com/a');
  });

  it('keeps other query parameters, in order and byte-for-byte', () => {
    expect(
      normalizeUrl('https://example.com/search?q=caf%C3%A9+au+lait&utm_source=x&page=2&sort=new'),
    ).toBe('https://example.com/search?q=caf%C3%A9+au+lait&page=2&sort=new');
  });

  it('treats URLs that differ only by tracking as the same page', () => {
    const a = normalizeUrl('https://news.example/story?id=7&utm_source=newsletter#comments');
    const b = normalizeUrl('https://news.example/story?id=7&fbclid=abc');
    expect(a).toBe(b);
  });

  it('keeps distinct pages distinct', () => {
    expect(normalizeUrl('https://example.com/a?page=1')).not.toBe(
      normalizeUrl('https://example.com/a?page=2'),
    );
  });

  it('keeps hash routes of single-page apps', () => {
    expect(normalizeUrl('https://app.example/#/notes/42')).toBe('https://app.example/#/notes/42');
    expect(normalizeUrl('https://app.example/#!/notes/42?utm_source=x')).toBe(
      'https://app.example/#!/notes/42?utm_source=x',
    );
  });

  it('lowercases the host and drops default ports', () => {
    expect(normalizeUrl('HTTPS://Example.COM:443/Path')).toBe('https://example.com/Path');
  });

  it('removes a dangling question mark and empty pairs', () => {
    expect(normalizeUrl('https://example.com/a?')).toBe('https://example.com/a');
    expect(normalizeUrl('https://example.com/a?&x=1&&')).toBe('https://example.com/a?x=1');
  });

  it('returns unparsable input unchanged', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('url helpers', () => {
  it('detects PDF links', () => {
    expect(looksLikePdfUrl('https://arxiv.org/pdf/paper.PDF?download=1')).toBe(true);
    expect(looksLikePdfUrl('https://example.com/pdf-guide')).toBe(false);
    expect(looksLikePdfUrl(undefined)).toBe(false);
  });

  it('derives display strings and file names', () => {
    expect(displayUrl('https://www.longread.example/why-we-forget')).toBe(
      'longread.example/why-we-forget',
    );
    expect(fileNameFromUrl('https://example.com/papers/spaced%20retrieval.pdf')).toBe(
      'spaced retrieval.pdf',
    );
  });
});
