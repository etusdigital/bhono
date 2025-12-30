import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 *
 * Goals:
 * - Low flake defaults (web-first assertions, artifacts on failure, retries only in CI)
 * - Fast feedback (projects, tags/grep, parallel workers)
 * - CI-ready (blob reports for sharding + merge-reports)
 */

export default defineConfig({
  testDir: './e2e',

  /* Global timeouts */
  timeout: 30_000,
  expect: { timeout: 10_000 },

  /* Execution */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined, // Single worker in CI to avoid resource issues

  /* Reporters */
  reporter: process.env.CI
    ? [['github'], ['blob'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }], ['list']],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',

    /* Artifacts */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Browser defaults */
    headless: !!process.env.CI,
    ignoreHTTPSErrors: true,
  },

  /* Projects */
  projects: [
    // Auth setup project - creates authenticated state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop Chrome - main test target
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Firefox - critical tests only in CI
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      grep: /@critical/,
    },

    // Mobile Chrome - responsive testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      grep: /@mobile/,
    },

    // Unauthenticated tests (no setup dependency)
    {
      name: 'chromium-unauth',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*\.unauth\.spec\.ts/,
    },
  ],

  /* Start dev server before tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
