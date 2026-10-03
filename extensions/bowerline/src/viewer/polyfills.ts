/**
 * pdf.js 6 relies on a few built-ins newer than some supported Chrome
 * versions. These small, side-effect-only shims fill the gaps; each one is a
 * no-op where the browser already provides the feature.
 */

type GetOrInsert<K, V> = {
  getOrInsert(key: K, value: V): V;
  getOrInsertComputed(key: K, make: (key: K) => V): V;
};

function addGetOrInsert(proto: Map<unknown, unknown> | WeakMap<object, unknown>): void {
  const p = proto as unknown as GetOrInsert<unknown, unknown> & {
    has(k: unknown): boolean;
    get(k: unknown): unknown;
    set(k: unknown, v: unknown): unknown;
  };
  if (typeof p.getOrInsert !== 'function') {
    Object.defineProperty(proto, 'getOrInsert', {
      configurable: true,
      writable: true,
      value(this: typeof p, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      },
    });
  }
  if (typeof p.getOrInsertComputed !== 'function') {
    Object.defineProperty(proto, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value(this: typeof p, key: unknown, make: (key: unknown) => unknown) {
        if (!this.has(key)) this.set(key, make(key));
        return this.get(key);
      },
    });
  }
}

addGetOrInsert(Map.prototype);
addGetOrInsert(WeakMap.prototype);

const MathExt = Math as Math & { sumPrecise?: (items: Iterable<number>) => number };
if (typeof MathExt.sumPrecise !== 'function') {
  // Kahan–Babuška summation: precise enough for pdf.js's layout arithmetic.
  MathExt.sumPrecise = (items: Iterable<number>): number => {
    let sum = 0;
    let c = 0;
    for (const x of items) {
      const t = sum + x;
      c += Math.abs(sum) >= Math.abs(x) ? sum - t + x : x - t + sum;
      sum = t;
    }
    return sum + c;
  };
}

const RegExpExt = RegExp as RegExpConstructor & { escape?: (s: string) => string };
if (typeof RegExpExt.escape !== 'function') {
  RegExpExt.escape = (s: string) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');
}

export {};
