import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  projects: [
    { name: 'e2e', testIgnore: '**/performance.spec.ts' },
    // Frame timings run after everything else, one at a time, so other tests can't skew them.
    {
      name: 'performance',
      testMatch: '**/performance.spec.ts',
      dependencies: ['e2e'],
      fullyParallel: false,
    },
  ],
});
