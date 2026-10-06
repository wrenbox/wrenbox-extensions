/**
 * Performance on a heavy page (tests/fixtures/video.html: a playing video,
 * 200 colored tiles, a sticky header): frame times while scrolling, with
 * Huefinch off, correcting and simulating, plus a typical article page for
 * comparison. Results go to tests/output/perf-<page>.json
 * and are summarized in REVIEW.md. Headless Chromium renders in software, so
 * the ratio between runs matters more than the absolute numbers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { fixture, matrixOf, setSettings, test, expect, waitForFilter } from './helpers';
import { OUTPUT } from './paths';

interface Run {
  frames: number;
  meanMs: number;
  p95Ms: number;
  slowFrames: number;
}

/** Scrolls 40 px per frame for 3 seconds and records every frame interval. */
async function scrollRun(page: Page): Promise<Run> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const intervals = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = 0;
        const start = performance.now();
        const step = (t: number) => {
          if (last) out.push(t - last);
          last = t;
          window.scrollBy(0, 40);
          if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2)
            window.scrollTo(0, 0);
          if (t - start < 3000) requestAnimationFrame(step);
          else resolve(out);
        };
        requestAnimationFrame(step);
      }),
  );
  const sorted = [...intervals].sort((a, b) => a - b);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    frames: intervals.length,
    meanMs: round(intervals.reduce((a, b) => a + b, 0) / intervals.length),
    p95Ms: round(sorted[Math.floor(sorted.length * 0.95)]!),
    slowFrames: intervals.filter((i) => i > 25).length,
  };
}

for (const path of ['video.html', 'article.html'])
  test(`scrolling ${path}`, async ({ ext }) => {
    test.setTimeout(120_000);
    const page = await ext.ctx.newPage();
    await page.goto(fixture(ext, path));
    if (path === 'video.html')
      await expect
        .poll(() =>
          page.evaluate(() => (document.getElementById('video') as HTMLVideoElement).currentTime),
        )
        .toBeGreaterThan(0.2);

    const results: Record<string, Run> = {};
    // Interleave the runs (off, on, off, on…) so background noise affects each equally.
    const modes = [
      ['off', { enabled: false }, null],
      [
        'correct',
        { enabled: true, mode: 'correct' as const },
        matrixOf({ mode: 'correct', type: 'deutan', amount: 80 }),
      ],
      [
        'simulate',
        { enabled: true, mode: 'simulate' as const },
        matrixOf({ mode: 'simulate', type: 'deutan', amount: 100 }),
      ],
    ] as const;
    const all: Record<string, Run[]> = { off: [], correct: [], simulate: [] };
    for (let round = 0; round < 3; round++) {
      for (const [name, patch, m] of modes) {
        await setSettings(ext, patch);
        await waitForFilter(page, m);
        all[name]!.push(await scrollRun(page));
      }
    }
    for (const [name, runs] of Object.entries(all)) {
      const best = [...runs].sort((a, b) => a.meanMs - b.meanMs)[1]!; // the median run
      results[name] = best;
    }

    // How long a settings change takes to reach the page (slider → storage → filter).
    const t0 = Date.now();
    await setSettings(ext, { enabled: true, mode: 'correct', strength: 55 });
    await waitForFilter(page, matrixOf({ mode: 'correct', type: 'deutan', amount: 55 }));
    const settingChangeMs = Date.now() - t0;

    const report = {
      page: `tests/fixtures/${path}`,
      note: 'headless Chromium, software rendering',
      ...results,
      settingChangeMs,
    };
    mkdirSync(OUTPUT, { recursive: true });
    writeFileSync(
      join(OUTPUT, `perf-${path.replace('.html', '')}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.log(JSON.stringify(report, null, 2));

    // A floor, not a target: even in software rendering, scrolling stays above 25 fps.
    // (With GPU compositing, as on most desktops, the filter runs on the GPU.)
    expect(results.off!.meanMs).toBeLessThan(25);
    expect(results.correct!.meanMs).toBeLessThan(40);
    expect(results.simulate!.meanMs).toBeLessThan(40);
    expect(ext.errors).toEqual([]);
  });
