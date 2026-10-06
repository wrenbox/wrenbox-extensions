/**
 * Huefinch's in-page UI (pill, card, picker prompt) sits under its own filter,
 * so it must stay readable under every matrix Huefinch can apply. The
 * extension pages must meet WCAG AA too, in light and dark mode.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex } from '../../src/shared/color';
import { CVD_TYPES, applyToSrgb255, matrixFor, type Vec3 } from '../../src/shared/matrix';

const rgb = (hex: string): Vec3 => parseHex(hex)!;

/** Text / background pairs used by content/ui.ts. */
const IN_PAGE: Array<[string, string, string]> = [
  ['card title and body text', '#18214d', '#ffffff'],
  ['card secondary text', '#4a5380', '#ffffff'],
  ['pill text', '#ffffff', '#18214d'],
  ['picker prompt', '#ffffff', '#18214d'],
  ['picker hint', '#dfe4f5', '#18214d'],
];

describe('in-page UI under every filter', () => {
  for (const mode of ['correct', 'simulate'] as const)
    for (const type of CVD_TYPES)
      for (const amount of [0, 50, 80, 100])
        it(`${mode} ${type} ${amount}%`, () => {
          const m = matrixFor(mode, type, amount);
          for (const [, fg, bg] of IN_PAGE) {
            const ratio = contrastRatio(applyToSrgb255(m, rgb(fg)), applyToSrgb255(m, rgb(bg)));
            expect(ratio).toBeGreaterThanOrEqual(4.5);
          }
        });
});

describe('extension pages meet WCAG AA', () => {
  const light = { text: '#18214d', muted: '#5d6690', surface: '#ffffff', paper: '#f4f6fb', track: '#e9ecf4' };
  const dark = { text: '#eef1fb', muted: '#a9b1d6', surface: '#171e42', paper: '#0f1430', track: '#262f5c' };
  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s theme', (_name, t) => {
    for (const bg of [t.surface, t.paper, t.track]) {
      expect(contrastRatio(rgb(t.text), rgb(bg))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(rgb(t.muted), rgb(bg))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('primary buttons', () => {
    expect(contrastRatio(rgb('#ffffff'), rgb('#18214d'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rgb('#0f1430'), rgb('#a9c2ff'))).toBeGreaterThanOrEqual(4.5);
  });
});
