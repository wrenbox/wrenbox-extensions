import { describe, expect, it } from 'vitest';
import {
  CSS_COLOR_COUNT,
  deltaE2000,
  describeColor,
  identifyColor,
  nearestCssColor,
  parseColor,
  parseHex,
  rgbToHsl,
  toHex,
} from '../../src/shared/color';

/** 54 reference colors: primaries, browns, greys, pastels, near-blacks and UI colors. */
const NAMES: Array<[string, string]> = [
  // Reds, pinks, corals
  ['#FF0000', 'Bright red'],
  ['#DC143C', 'Bright red'],
  ['#8B0000', 'Dark red'],
  ['#5C2626', 'Dark red'],
  ['#7A3B3B', 'Dark muted red'],
  ['#FF7F50', 'Coral'],
  ['#FF69B4', 'Pink'],
  ['#FFC0CB', 'Pink'],
  ['#FF00FF', 'Bright magenta'],
  // Oranges and browns
  ['#FFA500', 'Bright orange'],
  ['#8B4513', 'Brown'],
  ['#A0522D', 'Brown'],
  ['#795548', 'Muted brown'],
  ['#3E2723', 'Dark muted brown'],
  ['#D2B48C', 'Tan'],
  ['#F5F5DC', 'Beige'],
  // Yellows and olives
  ['#FFFF00', 'Bright yellow'],
  ['#808000', 'Olive'],
  ['#6B7A2E', 'Olive green'],
  ['#556B2F', 'Olive green'],
  ['#9ACD32', 'Lime green'],
  // Greens and teals
  ['#00FF00', 'Bright green'],
  ['#008000', 'Dark green'],
  ['#228B22', 'Green'],
  ['#90EE90', 'Light green'],
  ['#008080', 'Teal'],
  ['#2F4F4F', 'Dark muted teal'],
  ['#40E0D0', 'Turquoise'],
  ['#00FFFF', 'Bright cyan'],
  // Blues and purples
  ['#0000FF', 'Bright blue'],
  ['#4C8DFF', 'Blue'],
  ['#ADD8E6', 'Light blue'],
  ['#000080', 'Navy blue'],
  ['#18214D', 'Navy blue'],
  ['#708090', 'Grayish blue'],
  ['#6A5ACD', 'Violet'],
  ['#800080', 'Dark purple'],
  ['#DDA0DD', 'Lilac'],
  ['#C8A2C8', 'Muted lilac'],
  // Pastels
  ['#FFB3BA', 'Pink'],
  ['#FFDFBA', 'Light orange'],
  ['#FFFFBA', 'Light yellow'],
  ['#BAFFC9', 'Light green'],
  ['#BAE1FF', 'Light blue'],
  // Grays, black and white
  ['#000000', 'Black'],
  ['#111111', 'Black'],
  ['#333333', 'Dark gray'],
  ['#808080', 'Gray'],
  ['#C0C0C0', 'Light gray'],
  ['#EEEEEE', 'Very light gray'],
  ['#FFFFFF', 'White'],
  ['#FFFAFA', 'White'],
  // Near-blacks with a tint
  ['#0A0A2A', 'Very dark blue'],
  ['#140A00', 'Black'],
];

describe('descriptive names', () => {
  it('covers at least 40 reference colors', () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(40);
  });

  it.each(NAMES)('%s is "%s"', (hex, name) => {
    expect(describeColor(parseHex(hex)!)).toBe(name);
  });

  it('always starts with a capital and uses US spelling', () => {
    for (let r = 0; r < 256; r += 51)
      for (let g = 0; g < 256; g += 51)
        for (let b = 0; b < 256; b += 51) {
          const n = describeColor([r, g, b]);
          expect(n).toMatch(/^[A-Z][a-z]*( [a-z]+)*$/);
          expect(n).not.toMatch(/grey|colour/);
        }
  });
});

describe('nearest CSS named color', () => {
  it('lists the CSS colors once each (synonyms merged)', () => {
    expect(CSS_COLOR_COUNT).toBe(139);
  });

  it.each([
    ['#6B7A2E', 'dark olive green'],
    ['#FF0000', 'red'],
    ['#D2B48C', 'tan'],
    ['#6495ED', 'cornflower blue'],
    ['#7F7F7F', 'gray'],
    ['#FF7F51', 'coral'],
  ])('%s is close to %s', (hex, name) => {
    expect(nearestCssColor(parseHex(hex)!).name).toBe(name);
  });

  it('gives the CSS keyword too', () => {
    expect(nearestCssColor([85, 107, 47]).keyword).toBe('darkolivegreen');
  });
});

describe('the identify card', () => {
  it('describes a picked color', () => {
    expect(identifyColor('#6b7a2e')).toEqual({
      hex: '#6B7A2E',
      name: 'Olive green',
      closeTo: 'dark olive green',
      cssKeyword: 'darkolivegreen',
    });
  });

  it('accepts the rgb() form and rejects junk', () => {
    expect(identifyColor('rgb(107, 122, 46)')?.hex).toBe('#6B7A2E');
    expect(identifyColor('not a color')).toBeNull();
  });
});

describe('parsing and conversions', () => {
  it('parses hex in every common form', () => {
    expect(parseHex('#6b7a2e')).toEqual([107, 122, 46]);
    expect(parseHex('6B7A2E')).toEqual([107, 122, 46]);
    expect(parseHex('#fa0')).toEqual([255, 170, 0]);
    expect(parseHex('#12345')).toBeNull();
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3]);
    expect(toHex([107, 122, 46])).toBe('#6B7A2E');
  });

  it('converts to HSL', () => {
    expect(rgbToHsl([255, 0, 0])).toEqual({ h: 0, s: 1, l: 0.5 });
    const olive = rgbToHsl([107, 122, 46]);
    expect(olive.h).toBeCloseTo(71.8, 1);
  });

  // Reference pairs from Sharma, Wu & Dalal (2005), Table 1.
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ] as const)('CIEDE2000 matches the published value', (a, b, expected) => {
    expect(deltaE2000([...a], [...b])).toBeCloseTo(expected, 4);
  });
});
