/**
 * Huefinch's color maths. Every matrix works on linear RGB, which is what an
 * SVG <feColorMatrix> sees under the default color-interpolation-filters
 * ("linearRGB"): the browser converts sRGB → linear, applies the matrix,
 * clamps to [0, 1] and converts back.
 *
 * Simulation: Machado, Oliveira & Fernandes (2009), "A Physiologically-based
 * Model for Simulation of Color Vision Deficiency", severity 1.0.
 * Correction: error redistribution ("daltonization") after Fidaner, Lin &
 * Ozguven (2005), "Analysis of Color Blindness".
 */

export type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];
export type Vec3 = [number, number, number];
export type CvdType = 'protan' | 'deutan' | 'tritan';
export type Mode = 'correct' | 'simulate';

export const CVD_TYPES: readonly CvdType[] = ['protan', 'deutan', 'tritan'];

export const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Machado et al. (2009), severity 1.0, linear RGB. */
export const SIMULATION: Record<CvdType, Mat3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/**
 * Error redistribution (Fidaner et al.): where the information a person can't
 * see is moved to. Red/green deficiencies move it into green and blue; blue
 * deficiency moves it into red and green.
 */
export const REDISTRIBUTION: Record<CvdType, Mat3> = {
  protan: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.7, 0, 1],
  ],
  deutan: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.7, 0, 1],
  ],
  tritan: [
    [1, 0, 0.7],
    [0, 1, 0.7],
    [0, 0, 0],
  ],
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const row = (r: Vec3): Vec3 =>
    [0, 1, 2].map((j) => r[0] * b[0][j]! + r[1] * b[1][j]! + r[2] * b[2][j]!) as Vec3;
  return [row(a[0]), row(a[1]), row(a[2])];
}

function combine(a: Mat3, ka: number, b: Mat3, kb: number): Mat3 {
  return a.map((row, i) => row.map((v, j) => ka * v + kb * b[i]![j]!)) as Mat3;
}

/** S(s) = (1 − s)·I + s·S, for severity s in [0, 1]. */
export function simulationMatrix(type: CvdType, severity: number): Mat3 {
  const s = clamp01(severity);
  return combine(IDENTITY, 1 - s, SIMULATION[type], s);
}

/** C(k) = I + k·E·(I − S), for strength k in [0, 1]. */
export function correctionMatrix(type: CvdType, strength: number): Mat3 {
  const k = clamp01(strength);
  const lost = combine(IDENTITY, 1, SIMULATION[type], -1);
  return combine(IDENTITY, 1, multiply(REDISTRIBUTION[type], lost), k);
}

/** The matrix for a mode, with strength/severity given as 0–100 (as stored in settings). */
export function matrixFor(mode: Mode, type: CvdType, percent: number): Mat3 {
  const amount = clamp01(percent / 100);
  return mode === 'simulate' ? simulationMatrix(type, amount) : correctionMatrix(type, amount);
}

/**
 * The 20 numbers of an SVG feColorMatrix (4 rows × 5 columns: R G B A offset).
 * Alpha passes through unchanged and there are no offsets.
 */
export function feColorMatrixValues(m: Mat3): string {
  const n = (v: number): string => {
    const r = Math.round(v * 1e6) / 1e6;
    return Object.is(r, -0) ? '0' : String(r);
  };
  return [
    [...m[0], 0, 0],
    [...m[1], 0, 0],
    [...m[2], 0, 0],
    [0, 0, 0, 1, 0],
  ]
    .map((row) => row.map(n).join(' '))
    .join(' ');
}

/** sRGB channel (0–1) → linear light, per IEC 61966-2-1. */
export function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear light (0–1) → sRGB channel (0–1). */
export function toSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/**
 * What the browser does to one sRGB color (0–255 per channel): linearize,
 * apply the matrix, clamp, return to sRGB. Rounded to whole 0–255 values.
 */
export function applyToSrgb255(m: Mat3, rgb: Vec3): Vec3 {
  const lin = rgb.map((c) => toLinear(c / 255)) as Vec3;
  return m.map((row) => {
    const v = clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
    return Math.round(toSrgb(v) * 255);
  }) as Vec3;
}
