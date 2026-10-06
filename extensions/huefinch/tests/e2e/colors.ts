import type { Vec3 } from '../../src/shared/matrix';

/** The blocks in tests/fixtures/blocks.html, in order (100×100 px, 6 per row). */
export const BLOCKS: Vec3[] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
  [255, 0, 255],
  [255, 128, 0],
  [128, 0, 255],
  [128, 128, 128],
  [214, 96, 145],
  [61, 153, 0],
  [107, 122, 46],
];

/** A point inside block i, below where the Simulate pill (and its shadow) can reach. */
export const blockCenter = (i: number): [number, number] => [(i % 6) * 100 + 50, Math.floor(i / 6) * 100 + 80];
