import { activate, backupFile, expect, importBackup, test } from './helpers';

const COUNT = 200;
const sentence = (i: number) =>
  `Paragraph ${i} explains idea number ${i} about retrieval, spacing and the habit of returning to notes.`;

function longArticle(): string {
  const paras = Array.from(
    { length: 240 },
    (_, i) => `<p>Lead-in ${i}. ${sentence(i)} Closing thought ${i}.</p>`,
  ).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Long read</title></head><body><main>${paras}</main></body></html>`;
}

test(`restoring ${COUNT} highlights never blocks the page for more than 50 ms`, async ({ ext }) => {
  // Serve the long article from the fixture server via a data route.
  const html = longArticle();
  const url = `${ext.server.url}/article.html?long=1`;
  const key = url;
  const source = {
    id: 'long',
    kind: 'web',
    key,
    url,
    title: 'Long read',
    createdAt: 1,
    updatedAt: 1,
  };
  const colors = ['yellow', 'mint', 'pink', 'sky'];
  const highlights = Array.from({ length: COUNT }, (_, i) => ({
    id: `h${i}`,
    sourceId: 'long',
    color: colors[i % 4],
    text: sentence(i),
    note: i % 10 === 0 ? `Note ${i}` : '',
    selectors: [
      {
        type: 'TextQuoteSelector',
        exact: sentence(i),
        prefix: `Lead-in ${i}. `,
        suffix: ` Closing thought ${i}.`,
      },
    ],
    orphaned: false,
    createdAt: i,
    updatedAt: i,
  }));
  await importBackup(ext, backupFile([source], highlights));

  const page = await ext.ctx.newPage();
  await page.goto(url);
  await page.evaluate((html) => {
    document.open();
    document.write(html);
    document.close();
  }, html);
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask' });
  });
  // Prove the observer works here: a deliberate 80 ms task must be caught.
  await page.evaluate(() =>
    setTimeout(() => {
      const end = performance.now() + 80;
      while (performance.now() < end) {
        /* busy */
      }
    }),
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __long: number[] }).__long.length))
    .toBe(1);
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
  await page.waitForTimeout(300);

  const started = Date.now();
  await activate(ext, page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        ['yellow', 'mint', 'pink', 'sky'].reduce(
          (n, c) => n + (CSS.highlights.get(`bowerline-${c}`)?.size ?? 0),
          0,
        ),
      ),
    )
    .toBe(COUNT);
  const elapsed = Date.now() - started;
  await page.waitForTimeout(300);
  const longTasks = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  console.log(
    `restored ${COUNT} highlights in ${elapsed} ms; long tasks: ${JSON.stringify(longTasks)}`,
  );
  expect(longTasks).toEqual([]);
});
