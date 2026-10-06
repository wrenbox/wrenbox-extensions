/**
 * Installs the built extension once into a template profile. Each test copies
 * this profile, so the extension ID is stable and nothing leaks between tests.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { DIST, PROFILE_TEMPLATE, TEMPLATE_INFO, chromeArgs } from './paths';

export default async function globalSetup(): Promise<void> {
  if (!existsSync(`${DIST}/manifest.json`)) throw new Error('Run `npm run build` first: dist/ is missing.');
  rmSync(PROFILE_TEMPLATE, { recursive: true, force: true });
  mkdirSync(PROFILE_TEMPLATE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_TEMPLATE, {
    channel: 'chromium',
    headless: true,
    args: chromeArgs(),
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  // Let the install finish (onboarding tab, settings written) before snapshotting the profile.
  await new Promise((r) => setTimeout(r, 1500));
  await ctx.close();
  writeFileSync(TEMPLATE_INFO, JSON.stringify({ id }));
}
