/**
 * "Find my setting": pairs of colors that a person with one type of color
 * vision deficiency tends to confuse, but people with the other types don't.
 *
 * The pairs were found by searching sRGB with the same Machado et al. (2009)
 * matrices Huefinch uses: under full simulation of their type the two colors
 * are nearly identical (CIEDE2000 under 5), while in normal vision and under
 * the other two types they are clearly different, and Huefinch's correction
 * for their type pulls them apart. tests/unit/pairs.test.ts checks all of this.
 */
import type { CvdType } from './matrix';

export interface ConfusionPair {
  id: string;
  type: CvdType;
  a: string;
  b: string;
}

/** Interleaved, so the types aren't grouped on screen. */
export const PAIRS: readonly ConfusionPair[] = [
  { id: 'p1', type: 'protan', a: '#006633', b: '#FF0033' },
  { id: 'd1', type: 'deutan', a: '#00AA77', b: '#FF1188' },
  { id: 't1', type: 'tritan', a: '#449966', b: '#5599AA' },
  { id: 'd2', type: 'deutan', a: '#00BB66', b: '#FF3366' },
  { id: 'p2', type: 'protan', a: '#118866', b: '#FF6666' },
  { id: 't2', type: 'tritan', a: '#66CCEE', b: '#66DDAA' },
  { id: 't3', type: 'tritan', a: '#CC5500', b: '#DD0088' },
  { id: 'd3', type: 'deutan', a: '#117744', b: '#BB0055' },
  { id: 'p3', type: 'protan', a: '#006699', b: '#FF0099' },
];

/** Most common first: used to break ties (deutan ≈ 5% of men, protan ≈ 1%, tritan rare). */
const PREVALENCE: readonly CvdType[] = ['deutan', 'protan', 'tritan'];

export interface Suggestion {
  /** null when no pair looked alike. */
  type: CvdType | null;
  counts: Record<CvdType, number>;
  /** Another type that scored as high (worth trying too). */
  alsoTry: CvdType | null;
}

/** Suggests a type from the ids of the pairs the user marked as looking alike. */
export function suggestType(alike: Iterable<string>): Suggestion {
  const counts: Record<CvdType, number> = { protan: 0, deutan: 0, tritan: 0 };
  const marked = new Set(alike);
  for (const p of PAIRS) if (marked.has(p.id)) counts[p.type]++;
  const best = Math.max(...Object.values(counts));
  if (best === 0) return { type: null, counts, alsoTry: null };
  const top = PREVALENCE.filter((t) => counts[t] === best);
  return { type: top[0]!, counts, alsoTry: top[1] ?? null };
}
