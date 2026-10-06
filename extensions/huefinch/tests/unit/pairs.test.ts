import { describe, expect, it } from 'vitest';
import { deltaE2000, parseHex, rgbToLab } from '../../src/shared/color';
import {
  CVD_TYPES,
  applyToSrgb255,
  correctionMatrix,
  simulationMatrix,
  type Vec3,
} from '../../src/shared/matrix';
import { PAIRS, suggestType } from '../../src/shared/pairs';

const dE = (a: Vec3, b: Vec3) => deltaE2000(rgbToLab(a), rgbToLab(b));
const seen = (type: (typeof CVD_TYPES)[number], c: Vec3) =>
  applyToSrgb255(simulationMatrix(type, 1), c);

describe('Find my setting pairs', () => {
  it('has three pairs per type', () => {
    for (const t of CVD_TYPES) expect(PAIRS.filter((p) => p.type === t)).toHaveLength(3);
    expect(new Set(PAIRS.map((p) => p.id)).size).toBe(PAIRS.length);
  });

  it.each(PAIRS.map((p) => [p.id, p] as const))('%s: confusable for its type only', (_id, p) => {
    const a = parseHex(p.a)!;
    const b = parseHex(p.b)!;
    // Clearly different with typical color vision…
    expect(dE(a, b)).toBeGreaterThan(20);
    // …nearly the same for its type…
    expect(dE(seen(p.type, a), seen(p.type, b))).toBeLessThan(5);
    // …and still different for the other two types.
    for (const other of CVD_TYPES.filter((t) => t !== p.type))
      expect(dE(seen(other, a), seen(other, b))).toBeGreaterThan(14);
  });

  it.each(PAIRS.map((p) => [p.id, p] as const))(
    '%s: Huefinch’s correction pulls the pair apart',
    (_id, p) => {
      const a = parseHex(p.a)!;
      const b = parseHex(p.b)!;
      const C = correctionMatrix(p.type, 0.8);
      const before = dE(seen(p.type, a), seen(p.type, b));
      const after = dE(seen(p.type, applyToSrgb255(C, a)), seen(p.type, applyToSrgb255(C, b)));
      // At least twice as far apart, and a clearly visible difference (ΔE00 > 10).
      // Tritan correction is gentler than red/green correction under this model.
      expect(after).toBeGreaterThan(Math.max(2 * before, 10));
    },
  );
});

describe('suggestions', () => {
  it('suggests the type with the most pairs marked', () => {
    expect(suggestType(['p1', 'p2', 'd1']).type).toBe('protan');
    expect(suggestType(['t1', 't2', 't3', 'd1']).type).toBe('tritan');
  });

  it('suggests nothing when no pair looked alike', () => {
    expect(suggestType([])).toEqual({
      type: null,
      counts: { protan: 0, deutan: 0, tritan: 0 },
      alsoTry: null,
    });
  });

  it('breaks ties by how common each type is, and offers the runner-up', () => {
    expect(suggestType(['p1', 'd1'])).toMatchObject({ type: 'deutan', alsoTry: 'protan' });
    expect(suggestType(['t1', 'p1'])).toMatchObject({ type: 'protan', alsoTry: 'tritan' });
  });

  it('ignores unknown ids', () => {
    expect(suggestType(['x', 'd2']).counts).toEqual({ protan: 0, deutan: 1, tritan: 0 });
  });
});
