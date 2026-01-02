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

  /* Global timeouts - keep short for fast feedback */
  timeout: 15_000,  // 15s is plenty for most tests
  expect: {
    timeout: 5_000,  // 5s for assertions
    // Visual comparison settings
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  /* Execution */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // No retries locally - fix the tests instead
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
    headless: !process.env.HEADED,  // headless by default, use HEADED=true to see browser
    ignoreHTTPSErrors: true,

    /* Explicit timeouts (best practice) */
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  /* Projects */
  projects: [
    // Auth setup project - creates authenticated state
    // IMPORTANT: Use same device as chromium to match user-agent fingerprint
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Desktop Chrome - main test target (authenticated tests)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      // Exclude unauth tests and setup files - they run in chromium-unauth
      testIgnore: [/.*\.unauth\.spec\.ts/, /.*\.setup\.ts/],
      // Exclude tests that run in specialized projects
      grepInvert: /@visual|@a11y|@mobile/,
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
      testIgnore: [/.*\.unauth\.spec\.ts/, /.*\.setup\.ts/],
    },

    // Mobile Chrome - responsive testing (public pages only)
    // Note: Authenticated mobile tests are skipped due to fingerprint mismatch
    // (Pixel 5 has different user-agent than Desktop Chrome used in auth setup)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // No storageState - fingerprint validation fails with different device
      },
      // No dependency on setup - public pages don't need auth
      grep: /@mobile/,
      testIgnore: [/.*\.unauth\.spec\.ts/, /.*\.setup\.ts/],
    },

    // Unauthenticated tests (no setup dependency)
    {
      name: 'chromium-unauth',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*\.unauth\.spec\.ts/,
    },

    // Visual regression tests (separate for baseline management)
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      grep: /@visual/,
      testIgnore: [/.*\.unauth\.spec\.ts/, /.*\.setup\.ts/],
    },

    // Accessibility tests
    {
      name: 'a11y',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      grep: /@a11y/,
      testIgnore: [/.*\.unauth\.spec\.ts/, /.*\.setup\.ts/],
    },
  ],

  /* Start dev server before tests */
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
