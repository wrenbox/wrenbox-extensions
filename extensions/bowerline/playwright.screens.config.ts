import { defineConfig } from '@playwright/test';

/** Captures every screen at 1280×800 into tests/output/screens for review against store-assets/. */
export default defineConfig({
  testDir: 'tests/screens',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results-screens',
  globalSetup: './tests/e2e/global-setup.ts',
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
});
