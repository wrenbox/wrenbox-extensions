import { describe, expect, it } from 'vitest';
import {
  CVD_TYPES,
  IDENTITY,
  SIMULATION,
  applyToSrgb255,
  correctionMatrix,
  feColorMatrixValues,
  matrixFor,
  multiply,
  simulationMatrix,
  toLinear,
  toSrgb,
  type Mat3,
} from '../../src/shared/matrix';

const round4 = (m: Mat3) => m.map((r) => r.map((v) => Math.round(v * 1e4) / 1e4 + 0));

describe('correction matrices at k = 1 (the values the store screenshots rely on)', () => {
  it.each([
    [
      'deutan',
      [
        [1, 0, 0],
        [0.1628, 0.725, 0.1122],
        [0.4547, -0.6454, 1.1907],
      ],
    ],
    [
      'protan',
      [
        [1, 0, 0],
        [0.4789, 0.4769, 0.0442],
        [0.5973, -0.6887, 1.0914],
      ],
    ],
    [
      'tritan',
      [
        [0.7412, -0.4072, 0.666],
        [0.0751, 0.5852, 0.3397],
        [0, 0, 1],
      ],
    ],
  ] as const)('%s', (type, expected) => {
    expect(round4(correctionMatrix(type, 1))).toEqual(expected);
  });

  it('C(0) is the identity, and strength is clamped to 0–1', () => {
    for (const t of CVD_TYPES) {
      expect(correctionMatrix(t, 0)).toEqual(IDENTITY);
      expect(correctionMatrix(t, 1.7)).toEqual(correctionMatrix(t, 1));
      expect(correctionMatrix(t, -1)).toEqual(IDENTITY);
    }
  });

  it('C(k) is linear in k: C(0.5) is halfway between I and C(1)', () => {
    for (const t of CVD_TYPES) {
      const half = correctionMatrix(t, 0.5);
      const full = correctionMatrix(t, 1);
      half.forEach((row, i) =>
        row.forEach((v, j) => expect(v).toBeCloseTo((IDENTITY[i]![j]! + full[i]![j]!) / 2, 12)),
      );
    }
  });

  it('keeps grays gray (every row sums to 1)', () => {
    for (const t of CVD_TYPES)
      for (const k of [0.3, 0.8, 1])
        for (const row of correctionMatrix(t, k)) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 5);
  });
});

describe('simulation matrices', () => {
  it('S(1) is the Machado et al. matrix and S(0) the identity', () => {
    for (const t of CVD_TYPES) {
      expect(simulationMatrix(t, 1)).toEqual(SIMULATION[t]);
      expect(simulationMatrix(t, 0)).toEqual(IDENTITY);
    }
  });

  it('S(s) = (1 − s)·I + s·S', () => {
    const s = simulationMatrix('protan', 0.6);
    expect(s[0][0]).toBeCloseTo(0.4 + 0.6 * 0.152286, 12);
    expect(s[0][1]).toBeCloseTo(0.6 * 1.052583, 12);
    expect(s[2][2]).toBeCloseTo(0.4 + 0.6 * 1.051998, 12);
  });

  it('matrixFor maps a 0–100 setting to the right mode', () => {
    expect(matrixFor('correct', 'deutan', 80)).toEqual(correctionMatrix('deutan', 0.8));
    expect(matrixFor('simulate', 'tritan', 100)).toEqual(SIMULATION.tritan);
    expect(matrixFor('simulate', 'tritan', 250)).toEqual(SIMULATION.tritan);
  });

  it('multiplies matrices', () => {
    expect(multiply(IDENTITY, SIMULATION.deutan)).toEqual(SIMULATION.deutan);
    const twice = multiply(SIMULATION.protan, SIMULATION.protan);
    expect(twice[0][0]).toBeCloseTo(
      0.152286 * 0.152286 + 1.052583 * 0.114503 + -0.204868 * -0.003882,
      12,
    );
  });
});

describe('feColorMatrix values', () => {
  it('is 4 rows of 5 numbers with alpha passed through', () => {
    const v = feColorMatrixValues(correctionMatrix('deutan', 1)).split(' ').map(Number);
    expect(v).toHaveLength(20);
    expect(v.slice(15)).toEqual([0, 0, 0, 1, 0]);
    // No offsets, no alpha contribution from color.
    for (const i of [3, 4, 8, 9, 13, 14]) expect(v[i]).toBe(0);
  });

  it('writes the identity exactly', () => {
    expect(feColorMatrixValues(IDENTITY)).toBe('1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0');
  });

  it('rounds to 6 decimals without exponent notation or negative zero', () => {
    const s = feColorMatrixValues(correctionMatrix('deutan', 1));
    expect(s).toBe(
      '1 0 0 0 0 0.16279 0.725047 0.112165 0 0 0.454695 -0.645392 1.190697 0 0 0 0 0 1 0',
    );
    expect(feColorMatrixValues([[1e-9, -1e-9, 0], [0, 1, 0], [0, 0, 1]])).not.toMatch(/e|-0\b/);
  });
});

describe('sRGB ↔ linear and applying a matrix the way the browser does', () => {
  it('round-trips every 8-bit value', () => {
    for (let i = 0; i <= 255; i++) expect(Math.round(toSrgb(toLinear(i / 255)) * 255)).toBe(i);
  });

  it('leaves colors alone with the identity', () => {
    expect(applyToSrgb255(IDENTITY, [12, 200, 99])).toEqual([12, 200, 99]);
  });

  it('clamps out-of-range results', () => {
    // Pure green under full deutan correction: blue would be negative.
    expect(applyToSrgb255(correctionMatrix('deutan', 1), [0, 255, 0])).toEqual([0, 221, 0]);
    expect(applyToSrgb255(correctionMatrix('deutan', 1), [255, 0, 0])).toEqual([255, 112, 180]);
  });
});
