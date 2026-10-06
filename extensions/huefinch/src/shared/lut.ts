/**
 * A 3D LUT (Adobe/Resolve .cube) for a Huefinch matrix, so tools such as
 * ffmpeg's lut3d can apply exactly the same color transform as the extension:
 * sRGB → linear → matrix → clamp → sRGB at every grid point.
 *
 * Used by the promo video to show "As a green-weak eye sees it".
 */
import { toLinear, toSrgb, type Mat3, type Vec3 } from './matrix';

/** The transform at one sRGB point (channels 0–1), without rounding. */
export function applyExact(m: Mat3, rgb: Vec3): Vec3 {
  const lin = rgb.map(toLinear) as Vec3;
  return m.map((row) => {
    const v = row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2];
    return toSrgb(Math.min(1, Math.max(0, v)));
  }) as Vec3;
}

/** The .cube text: a header, then size³ lines "r g b" with red varying fastest. */
export function cubeLut(m: Mat3, size = 33, title = 'Huefinch'): string {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const out = applyExact(m, [r / (size - 1), g / (size - 1), b / (size - 1)]);
        lines.push(out.map((v) => v.toFixed(6)).join(' '));
      }
  return `${lines.join('\n')}\n`;
}

/** Parses a .cube file into its size and RGB triples (red fastest). */
export function parseCube(text: string): { size: number; data: Vec3[] } {
  let size = 0;
  const data: Vec3[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('TITLE') || t.startsWith('DOMAIN')) continue;
    if (t.startsWith('LUT_3D_SIZE')) size = Number(t.split(/\s+/)[1]);
    else data.push(t.split(/\s+/).map(Number) as Vec3);
  }
  if (!size || data.length !== size ** 3) throw new Error('Not a complete 3D .cube LUT');
  return { size, data };
}

/** Looks up a color (channels 0–1) with trilinear interpolation, as LUT players do. */
export function sampleCube({ size, data }: { size: number; data: Vec3[] }, rgb: Vec3): Vec3 {
  const pos = rgb.map((c) => Math.min(1, Math.max(0, c)) * (size - 1));
  const i0 = pos.map((p) => Math.min(size - 2, Math.floor(p)));
  const f = pos.map((p, k) => p - i0[k]!);
  const at = (r: number, g: number, b: number) => data[r + g * size + b * size * size]!;
  const out: Vec3 = [0, 0, 0];
  for (let dr = 0; dr <= 1; dr++)
    for (let dg = 0; dg <= 1; dg++)
      for (let db = 0; db <= 1; db++) {
        const w = (dr ? f[0]! : 1 - f[0]!) * (dg ? f[1]! : 1 - f[1]!) * (db ? f[2]! : 1 - f[2]!);
        const v = at(i0[0]! + dr, i0[1]! + dg, i0[2]! + db);
        for (let k = 0; k < 3; k++) out[k] = out[k]! + w * v[k]!;
      }
  return out;
}
