/** Text helpers shared by search, anchoring and exports. */

const COMBINING = /\p{M}/gu;

/** Case- and accent-insensitive form used for search: "Café" → "cafe". */
export function fold(value: string): string {
  return value.normalize('NFD').replace(COMBINING, '').toLowerCase();
}

/**
 * Folds a string and keeps a map from each folded index back to the original
 * index, so a match found in the folded text can be marked in the original.
 */
export function foldWithMap(value: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of value) {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(value.length);
  return { folded, map };
}

/** Returns [start, end) ranges in the original string matching `query`, accent- and case-insensitively. */
export function findMatches(value: string, query: string): Array<[number, number]> {
  const q = fold(query.trim());
  if (!q) return [];
  const { folded, map } = foldWithMap(value);
  const out: Array<[number, number]> = [];
  let from = 0;
  while (from <= folded.length) {
    const at = folded.indexOf(q, from);
    if (at < 0) break;
    out.push([map[at] ?? 0, map[at + q.length] ?? value.length]);
    from = at + q.length;
  }
  return out;
}

/** Collapses runs of whitespace (including NBSP) into single spaces and trims. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
