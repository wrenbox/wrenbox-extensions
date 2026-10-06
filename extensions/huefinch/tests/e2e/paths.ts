import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const DIST = join(ROOT, 'dist');
export const FIXTURES = join(ROOT, 'tests/fixtures');
export const OUTPUT = join(ROOT, 'tests/output');
export const PROFILE_TEMPLATE = join(OUTPUT, 'profile-template');
export const TEMPLATE_INFO = join(OUTPUT, 'profile-template.json');
export const EXTENSION_NAME = 'Huefinch – Color Blind Filter & Color Identifier';

export function chromeArgs(): string[] {
  return [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--window-size=1280,800',
    // Screenshots in plain sRGB, so pixels can be compared with the maths.
    '--force-color-profile=srgb',
  ];
}
