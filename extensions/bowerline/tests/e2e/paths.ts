import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const DIST = join(ROOT, 'dist');
export const FIXTURES = join(ROOT, 'tests/fixtures');
export const OUTPUT = join(ROOT, 'tests/output');
export const PROFILE_TEMPLATE = join(OUTPUT, 'profile-template');
export const TEMPLATE_INFO = join(OUTPUT, 'profile-template.json');

/**
 * The browser the suite drives: Playwright's Chromium by default, or real
 * Microsoft Edge with BOWERLINE_BROWSER=edge (`npm run test:e2e:edge`).
 */
export const CHANNEL = process.env.BOWERLINE_BROWSER === 'edge' ? 'msedge' : 'chromium';

export function chromeArgs(): string[] {
  return [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--window-size=1280,800',
  ];
}
