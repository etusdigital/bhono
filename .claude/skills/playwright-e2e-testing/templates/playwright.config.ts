import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test configuration (TypeScript)
 *
 * Goals:
 * - Low flake defaults (web-first assertions, artifacts on failure, retries only in CI)
 * - Fast feedback (projects, tags/grep, parallel workers)
 * - CI-ready (blob reports for sharding + merge-reports)
 *
 * Customize:
 * - testDir
 * - baseURL
 * - auth storageState path
 * - webServer command (if applicable)
 */

export default defineConfig({
  testDir: './tests',

  /* Global timeouts */
  timeout: 30_000,
  expect: { timeout: 10_000 },

  /* Execution */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? undefined : undefined, // Let Playwright choose by default.

  /* Reporters:
   * - CI: blob for sharding + github annotations
   * - local: html + list
   */
  reporter: process.env.CI
    ? [['github'], ['blob']]
    : [['html', { open: 'on-failure' }], ['list']],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',

    /* Artifacts */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Browser defaults */
    headless: !!process.env.CI,
    ignoreHTTPSErrors: true,
  },

  /* Projects:
   * - setup: optional auth bootstrap
   * - desktop browsers: broad coverage
   * - mobile: realistic viewport + UA via device descriptors
   */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      // Optional: restrict to a smaller set
      // testMatch: /.*\.critical\.spec\.ts/,
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      // Optional: restrict to a smaller set
      // testMatch: /.*\.critical\.spec\.ts/,
    },

    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Optional: start your dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  */

  /* Optional: global setup (instead of setup project)
  globalSetup: require.resolve('./tests/global.setup'),
  */
});
