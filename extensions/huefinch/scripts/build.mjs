/**
 * Builds Huefinch into dist/ with esbuild. Output is NOT minified so Chrome
 * Web Store reviewers (and anyone) can read it. Source maps are only written
 * in watch mode and never go into the release zip.
 *
 *   node scripts/build.mjs            production build into dist/
 *   node scripts/build.mjs --watch    rebuild on change (npm run dev)
 *
 * The grey "off" toolbar icons are made here from the provided icons, so the
 * extension never draws icons at runtime.
 */
import * as esbuild from 'esbuild';
import {
  cpSync,
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
import { decodePng, encodePng, grayIcon } from './lib/png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWatch = process.argv.includes('--watch');
const outdir = join(root, process.env.OUTDIR || 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const PAGES = ['popup', 'options', 'onboarding'];
const ICON_SIZES = [16, 32, 48, 128];

const common = {
  bundle: true,
  minify: false,
  keepNames: false,
  sourcemap: isWatch ? 'linked' : false,
  target: 'chrome120',
  charset: 'utf8',
  legalComments: 'inline',
  logLevel: 'warning',
  absWorkingDir: root,
};

const builds = [
  { entryPoints: ['src/background/index.ts'], outfile: join(outdir, 'background.js'), format: 'esm' },
  // Classic script: injected by registerContentScripts and executeScript.
  { entryPoints: ['src/content/index.ts'], outfile: join(outdir, 'content/content.js'), format: 'iife' },
  ...PAGES.map((p) => ({
    entryPoints: [`src/${p}/${p}.ts`],
    outfile: join(outdir, `${p}/${p}.js`),
    format: 'esm',
  })),
];

function copyStatic() {
  const copy = (from, to) => {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  };
  for (const dir of PAGES) {
    for (const f of readdirSync(join(root, 'src', dir))) {
      if (/\.(html|css)$/.test(f)) copy(join(root, 'src', dir, f), join(outdir, dir, f));
    }
  }
  for (const f of readdirSync(join(root, 'src/shared/ui'))) {
    if (f.endsWith('.css')) copy(join(root, 'src/shared/ui', f), join(outdir, 'shared', f));
  }
  copy(join(root, 'public/icons'), join(outdir, 'icons'));
  for (const size of ICON_SIZES) {
    const icon = decodePng(readFileSync(join(root, `public/icons/icon-${size}.png`)));
    writeFileSync(join(outdir, `icons/icon-off-${size}.png`), encodePng(grayIcon(icon)));
  }
  const manifest = JSON.parse(readFileSync(join(root, 'src/manifest.json'), 'utf8'));
  manifest.version = pkg.version;
  writeFileSync(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function sizeReport() {
  for (const f of ['content/content.js', 'background.js', 'popup/popup.js', 'options/options.js']) {
    console.log(`  ${f.padEnd(22)} ${(statSync(join(outdir, f)).size / 1024).toFixed(1).padStart(7)} KB`);
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
  console.log(`Built Huefinch ${pkg.version} into ${relative(root, outdir)}/`);
  sizeReport();
}
