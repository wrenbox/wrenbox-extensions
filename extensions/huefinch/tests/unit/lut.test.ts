/**
 * The promo video's "As a green-weak eye sees it" inset is made with a 3D LUT
 * applied by ffmpeg. It must agree with Huefinch's own maths.
 */
import { describe, expect, it } from 'vitest';
import { applyExact, cubeLut, parseCube, sampleCube } from '../../src/shared/lut';
import { applyToSrgb255, simulationMatrix, type Vec3 } from '../../src/shared/matrix';

const deutan = simulationMatrix('deutan', 1);
const lut = parseCube(cubeLut(deutan, 33));

/** Deterministic pseudo-random colors (no Math.random, so failures reproduce). */
function* colors(n: number, seed = 20261006): Generator<Vec3> {
  let s = seed;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 255;
  for (let i = 0; i < n; i++) yield [Math.round(next()), Math.round(next()), Math.round(next())];
}

describe('the deuteranopia LUT for the promo video', () => {
  it('is a complete 33×33×33 .cube with red varying fastest', () => {
    expect(lut.size).toBe(33);
    expect(lut.data).toHaveLength(33 ** 3);
    // Second entry: red = 1/32, green = blue = 0.
    expect(lut.data[1]).toEqual(applyExact(deutan, [1 / 32, 0, 0]).map((v) => +v.toFixed(6)));
    // White and black stay put.
    expect(lut.data[0]).toEqual([0, 0, 0]);
    expect(lut.data[33 ** 3 - 1]!.map((v) => Math.round(v * 255))).toEqual([255, 255, 255]);
  });

  // A 33-point grid interpolates the sRGB curve between grid points; the worst
  // case is under 3/255, the same tolerance as the extension's pixel tests.
  it('matches the TypeScript maths at 50 random colors (±3 of 255)', () => {
    let worst = 0;
    for (const c of colors(50)) {
      const want = applyToSrgb255(deutan, c);
      const got = sampleCube(lut, c.map((v) => v / 255) as Vec3).map((v) => v * 255);
      for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(got[k]! - want[k]!));
    }
    expect(worst).toBeLessThanOrEqual(3);
  });

  it('is exact at its grid points', () => {
    for (const [r, g, b] of [
      [0, 16, 32],
      [32, 0, 8],
      [11, 22, 5],
    ] as const) {
      const idx = r + g * 33 + b * 33 * 33;
      const exact = applyExact(deutan, [r / 32, g / 32, b / 32]);
      lut.data[idx]!.forEach((v, k) => expect(v).toBeCloseTo(exact[k]!, 6));
    }
  });
});
