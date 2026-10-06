import { describe, expect, it } from 'vitest';
import { initialFiles } from '../../scripts/lib/initial.mjs';
import {
  excludePatterns,
  initialFilesFor,
  settingsFromInitial,
  type Initial,
} from '../../src/shared/initial';
import { CVD_TYPES } from '../../src/shared/matrix';
import { DEFAULTS, type Settings } from '../../src/shared/settings';

const built = new Set(initialFiles().map((f) => f.path));

/** Runs the generated one-liners the way Chrome does: in order, in one world. */
function run(paths: string[]): Initial {
  const scope: { __huefinchInitial?: Initial } = {};
  for (const p of paths) {
    const src = initialFiles().find((f) => f.path === p)!.source;
    const [, key, value] = /\)\.(\w+) = (.*);\n$/.exec(src)! as unknown as [
      string,
      keyof Initial,
      string,
    ];
    (scope.__huefinchInitial ??= {})[key] = JSON.parse(value) as never;
  }
  return scope.__huefinchInitial!;
}

describe('initial-state files', () => {
  it('the build generates every file any settings can ask for', () => {
    for (const enabled of [true, false])
      for (const mode of ['correct', 'simulate'] as const)
        for (const type of CVD_TYPES)
          for (let amount = 0; amount <= 100; amount++) {
            const s: Settings = {
              ...DEFAULTS,
              enabled,
              mode,
              type,
              strength: amount,
              severity: amount,
            };
            for (const f of initialFilesFor(s)) expect(built.has(f), f).toBe(true);
          }
  });

  it('round-trips settings to within the 5% step', () => {
    const s: Settings = { ...DEFAULTS, mode: 'simulate', type: 'tritan', severity: 62 };
    expect(settingsFromInitial(run(initialFilesFor(s)))).toEqual({
      ...DEFAULTS,
      mode: 'simulate',
      type: 'tritan',
      severity: 60,
    });
    expect(
      settingsFromInitial(run(initialFilesFor({ ...DEFAULTS, enabled: false }))),
    ).toMatchObject({ enabled: false });
  });

  it('is ignored when missing or incomplete', () => {
    expect(settingsFromInitial(undefined)).toBeNull();
    expect(settingsFromInitial({ mode: 'correct', type: 'deutan' })).toBeNull();
    expect(settingsFromInitial({ mode: 'correct', type: 'nope' as never, amount: 50 })).toBeNull();
  });

  it('each file is one readable statement', () => {
    for (const f of initialFiles()) {
      expect(f.source.split('\n').filter(Boolean)).toHaveLength(2);
      expect(f.source).toMatch(/^\/\/ Huefinch: /);
    }
  });
});

describe('sites switched off are excluded from the automatic script', () => {
  it('covers the site and its www. form', () => {
    expect(excludePatterns(['example.com', '127.0.0.1'])).toEqual([
      '*://example.com/*',
      '*://www.example.com/*',
      '*://127.0.0.1/*',
      '*://www.127.0.0.1/*',
    ]);
  });

  it('skips hosts a match pattern cannot express', () => {
    expect(excludePatterns(['[::1]'])).toEqual([]);
  });
});
