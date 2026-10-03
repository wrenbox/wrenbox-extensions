import { describe, expect, it } from 'vitest';
import { colorLabel } from '../../src/shared/colors';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../src/shared/settings';
import { findMatches, fold } from '../../src/shared/text';
import { bounds, looksLikePdf, mergeRects, stackCards } from '../../src/viewer/geometry';
import { matchesQuery } from '../../src/shared/ui/highlight-list';
import { HIGHLIGHTS } from './library-fixture';

describe('search', () => {
  it('is case- and accent-insensitive', () => {
    expect(fold('Café Ü')).toBe('cafe u');
    expect(findMatches('Le café crème', 'CAFE')).toEqual([[3, 7]]);
    expect(findMatches('naïve, NAIVE', 'naive')).toEqual([
      [0, 5],
      [7, 12],
    ]);
    expect(findMatches('anything', '  ')).toEqual([]);
  });

  it('matches highlight text and notes', () => {
    expect(matchesQuery(HIGHLIGHTS[1]!, 'ESSAY')).toBe(true); // note
    expect(matchesQuery(HIGHLIGHTS[1]!, 'comprehension')).toBe(true); // text
    expect(matchesQuery(HIGHLIGHTS[1]!, 'zebra')).toBe(false);
  });
});

describe('colours and settings', () => {
  it('always names the colour, with the label when set', () => {
    expect(colorLabel('yellow')).toBe('Yellow');
    expect(colorLabel('yellow', { yellow: ' key idea ' })).toBe('Yellow: key idea');
  });

  it('sanitises stored settings', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(
      sanitizeSettings({
        defaultColor: 'purple',
        theme: 'neon',
        showToolbar: 'yes',
        labels: { mint: 'x'.repeat(99), pink: 3 },
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      labels: { ...DEFAULT_SETTINGS.labels, mint: 'x'.repeat(40) },
    });
  });
});

describe('PDF geometry', () => {
  it('merges span rects into one rect per line', () => {
    const merged = mergeRects([
      { x: 10, y: 100, w: 50, h: 12 },
      { x: 61, y: 100.5, w: 40, h: 12 },
      { x: 10, y: 118, w: 80, h: 12 },
      { x: 0, y: 0, w: 0.2, h: 12 },
    ]);
    expect(merged).toEqual([
      { x: 10, y: 100, w: 91, h: 12.5 },
      { x: 10, y: 118, w: 80, h: 12 },
    ]);
    expect(bounds(merged)).toEqual({ x: 10, y: 100, w: 91, h: 30 });
  });

  it('stacks note cards so none overlap, keeping their order', () => {
    expect(stackCards([100, 105, 400], [60, 60, 60])).toEqual([100, 170, 400]);
  });

  it('recognises PDF bytes', () => {
    expect(looksLikePdf(new TextEncoder().encode('%PDF-1.7\n...'))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode('<!doctype html>'))).toBe(false);
  });
});
