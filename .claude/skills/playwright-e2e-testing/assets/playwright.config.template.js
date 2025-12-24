import { defineConfig, devices } from '@playwright/test';

/**
 * Optimized Playwright Configuration Template
 * 
 * This configuration follows best practices for:
 * - Fast execution
 * - Reliable tests
 * - Comprehensive reporting
 * - CI/CD compatibility
 */

export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Run tests in parallel for speed
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in source code
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,
  
  // Optimal worker configuration
  // Use 50% of cores locally, 4 workers in CI
  workers: process.env.CI ? 4 : '50%',
  
  // Reporter configuration
  // HTML report locally, JUnit + HTML in CI
  reporter: process.env.CI 
    ? [
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['json', { outputFile: 'test-results/results.json' }]
      ]
    : [
        ['html', { open: 'on-failure' }],
        ['list']
      ],

  // Shared settings for all projects
  use: {
    // Base URL for all navigation
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace only on first retry to save space
    trace: 'on-first-retry',
    
    // Screenshots only on failure
    screenshot: 'only-on-failure',
    
    // Video only on failure
    video: 'retain-on-failure',
    
    // Run in headless mode in CI
    headless: process.env.CI ? true : false,
    
    // Default viewport
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Timeouts
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },

  // Global timeout for each test
  timeout: 30000,
  
  // Timeout for each assertion
  expect: {
    timeout: 5000,
  },

  // Configure projects for different browsers and scenarios
  projects: [
    // Setup project - runs first, creates auth state
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },

    // Chromium - main browser for most tests
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use saved authentication state
        storageState: 'auth.json',
      },
      dependencies: ['setup'],
    },

    // Firefox - run critical tests only
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'auth.json',
      },
      testMatch: /.*\.critical\.spec\.js/,
      dependencies: ['setup'],
    },

    // WebKit - run critical tests only
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'auth.json',
      },
      testMatch: /.*\.critical\.spec\.js/,
      dependencies: ['setup'],
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'auth.json',
      },
      testMatch: /.*\.mobile\.spec\.js/,
      dependencies: ['setup'],
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 13'],
        storageState: 'auth.json',
      },
      testMatch: /.*\.mobile\.spec\.js/,
      dependencies: ['setup'],
    },

    // API testing project
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.js/,
      use: {
        baseURL: process.env.API_URL || 'http://localhost:3001/api',
      },
    },
  ],

  // Web Server configuration (optional)
  // Uncomment if you want Playwright to start your dev server
  /*
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  */

  // Global Setup and Teardown (optional)
  // Uncomment to use global setup/teardown scripts
  /*
  globalSetup: require.resolve('./tests-config/global-setup'),
  globalTeardown: require.resolve('./tests-config/global-teardown'),
  */
});
