/**
 * Builds the extension into dist/ with esbuild. Output is NOT minified so
 * Chrome Web Store reviewers (and anyone) can read it. Source maps are only
 * written in watch mode and never go into the release zip.
 *
 *   node scripts/build.mjs            production build into dist/
 *   node scripts/build.mjs --watch    rebuild on change (npm run dev)
 */
import * as esbuild from 'esbuild';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { samplePdf } from './lib/sample-pdf.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWatch = process.argv.includes('--watch');
const outdir = join(root, process.env.OUTDIR || 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const pdfjs = join(root, 'node_modules/pdfjs-dist');

const PAGES = ['popup', 'sidepanel', 'library', 'options', 'onboarding'];

const common = {
  bundle: true,
  minify: false,
  keepNames: false,
  sourcemap: isWatch ? 'linked' : false,
  target: 'chrome140',
  charset: 'utf8',
  legalComments: 'inline',
  logLevel: 'warning',
  absWorkingDir: root,
};

const builds = [
  {
    entryPoints: ['src/background/index.ts'],
    outfile: join(outdir, 'background.js'),
    format: 'esm',
  },
  // Classic script: injected with chrome.scripting.executeScript / registerContentScripts.
  {
    entryPoints: ['src/content/index.ts'],
    outfile: join(outdir, 'content/content.js'),
    format: 'iife',
  },
  ...PAGES.map((p) => ({
    entryPoints: [`src/${p}/${p}.ts`],
    outfile: join(outdir, `${p}/${p}.js`),
    format: 'esm',
  })),
  {
    entryPoints: ['src/viewer/viewer.ts'],
    outfile: join(outdir, 'viewer/viewer.js'),
    format: 'esm',
  },
  {
    entryPoints: ['src/viewer/worker.ts'],
    outfile: join(outdir, 'viewer/pdf.worker.mjs'),
    format: 'esm',
  },
];

function copyStatic() {
  const copy = (from, to) => {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  };
  // HTML and page CSS, mirroring src/<page>/ into dist/<page>/.
  for (const dir of [...PAGES, 'viewer', 'content']) {
    for (const f of readdirSync(join(root, 'src', dir))) {
      if (/\.(html|css)$/.test(f)) copy(join(root, 'src', dir, f), join(outdir, dir, f));
    }
  }
  for (const f of readdirSync(join(root, 'src/shared/ui'))) {
    if (f.endsWith('.css')) copy(join(root, 'src/shared/ui', f), join(outdir, 'shared', f));
  }
  copy(join(root, 'public/icons'), join(outdir, 'icons'));
  // pdf.js assets, all served from the extension itself (no CDN).
  copy(join(pdfjs, 'web/pdf_viewer.css'), join(outdir, 'viewer/pdf_viewer.css'));
  copy(join(pdfjs, 'web/images'), join(outdir, 'viewer/images'));
  copy(join(pdfjs, 'cmaps'), join(outdir, 'viewer/pdfjs/cmaps'));
  copy(join(pdfjs, 'standard_fonts'), join(outdir, 'viewer/pdfjs/standard_fonts'));
  copy(join(pdfjs, 'iccs'), join(outdir, 'viewer/pdfjs/iccs'));
  mkdirSync(join(outdir, 'viewer/pdfjs/wasm'), { recursive: true });
  for (const f of readdirSync(join(pdfjs, 'wasm'))) {
    // PDF JavaScript (quickjs) is never run by Bowerline, so it isn't shipped.
    if (f.startsWith('quickjs')) continue;
    copy(join(pdfjs, 'wasm', f), join(outdir, 'viewer/pdfjs/wasm', f));
  }
  // Licences: individual files plus one combined notice linked from About.
  copy(join(root, 'licenses'), join(outdir, 'licenses'));
  const notices = readdirSync(join(root, 'licenses'))
    .filter((f) => f.endsWith('.txt') && f !== 'THIRD_PARTY_LICENSES.txt')
    .sort()
    .map(
      (f) =>
        `${'='.repeat(78)}\n${f.replace(/\.txt$/, '')}\n${'='.repeat(78)}\n\n${readFileSync(join(root, 'licenses', f), 'utf8').trim()}\n`,
    )
    .join('\n');
  writeFileSync(
    join(outdir, 'licenses/THIRD_PARTY_LICENSES.txt'),
    `Bowerline includes the following open-source software.\n\n${notices}`,
  );
  mkdirSync(join(outdir, 'sample'), { recursive: true });
  writeFileSync(join(outdir, 'sample/bowerline-sample.pdf'), samplePdf());
  const manifest = JSON.parse(readFileSync(join(root, 'src/manifest.json'), 'utf8'));
  manifest.version = pkg.version;
  writeFileSync(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function sizeReport() {
  const files = [
    'content/content.js',
    'background.js',
    'viewer/viewer.js',
    'viewer/pdf.worker.mjs',
  ];
  for (const f of files) {
    const p = join(outdir, f);
    if (existsSync(p))
      console.log(`  ${f.padEnd(26)} ${(statSync(p).size / 1024).toFixed(1).padStart(8)} KB`);
  }
}

if (!isWatch) rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
copyStatic();

if (isWatch) {
  const contexts = await Promise.all(builds.map((b) => esbuild.context({ ...common, ...b })));
  await Promise.all(contexts.map((c) => c.watch()));
  let timer;
  watch(join(root, 'src'), { recursive: true }, (_e, file) => {
    if (!file || !/\.(html|css|json)$/.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      copyStatic();
      console.log(`copied static files (${relative(root, join('src', file))})`);
    }, 100);
  });
  console.log(`Watching… output in ${relative(root, outdir)}/`);
} else {
  await Promise.all(builds.map((b) => esbuild.build({ ...common, ...b })));
  console.log(`Built Bowerline ${pkg.version} into ${relative(root, outdir)}/`);
  sizeReport();
}
