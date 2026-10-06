import { defineConfig } from '@playwright/test';

/** Captures every screen at 1280×800 (tests/output/screens) and builds the store screenshots (store-assets/captured). */
export default defineConfig({
  testDir: 'tests/screens',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results-screens',
  globalSetup: './tests/e2e/global-setup.ts',
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
});
