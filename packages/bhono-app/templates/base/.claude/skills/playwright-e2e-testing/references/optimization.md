# Playwright Performance Optimization

## Configuration Optimization

### Optimal playwright.config.js

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Run tests in parallel
  fullyParallel: true,
  
  // Optimal worker configuration
  workers: process.env.CI ? 4 : '50%',
  
  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,
  
  // Timeout configuration
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  // Reporter configuration
  reporter: process.env.CI ? [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'results.xml' }]
  ] : [['html', { open: 'on-failure' }]],
  
  use: {
    // Base URL for all tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace only on failure
    trace: 'on-first-retry',
    
    // Screenshot on failure only
    screenshot: 'only-on-failure',
    
    // Video on failure only
    video: 'retain-on-failure',
    
    // Headless in CI
    headless: process.env.CI ? true : false,
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Navigation timeout
    navigationTimeout: 30000,
    
    // Action timeout
    actionTimeout: 10000,
  },
  
  // Project configuration for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Only run other browsers for critical tests
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /critical\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /critical\.spec\.ts/,
    },
  ],
  
  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## Speed Optimization Techniques

### 1. Reuse Authentication State

**Setup authentication once:**
```javascript
// global-setup.js
import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Login once
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  
  // Save auth state
  await page.context().storageState({ path: 'auth.json' });
  await browser.close();
}

export default globalSetup;
```

**Use in tests:**
```javascript
// playwright.config.js
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
});

// test file
test.use({ storageState: 'auth.json' });

test('authenticated test', async ({ page }) => {
  // Already logged in!
  await page.goto('/dashboard');
});
```

### 2. Optimize Network Requests

**Block unnecessary resources:**
```javascript
test.beforeEach(async ({ page }) => {
  // Block images, fonts, and analytics
  await page.route('**/*.{png,jpg,jpeg,svg,gif,woff,woff2}', route => 
    route.abort()
  );
  
  await page.route('**/analytics/**', route => route.abort());
  await page.route('**/tracking/**', route => route.abort());
  
  // Mock slow API endpoints
  await page.route('**/api/slow-endpoint', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ data: 'mocked' })
    });
  });
});
```

### 3. Use API for Setup/Teardown

**Setup via API instead of UI:**
```javascript
test.beforeEach(async ({ request }) => {
  // Create test data via API (faster than UI)
  await request.post('/api/test-data', {
    data: {
      user: 'test@example.com',
      products: ['product1', 'product2']
    }
  });
});

test.afterEach(async ({ request }) => {
  // Cleanup via API
  await request.delete('/api/test-data');
});
```

### 4. Parallel Test Execution

**Run tests in parallel:**
```javascript
// playwright.config.js
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,
});

// For test files that can't run in parallel
test.describe.configure({ mode: 'serial' });
```

**Group related tests:**
```javascript
test.describe.parallel('Product tests', () => {
  test('test 1', async ({ page }) => {});
  test('test 2', async ({ page }) => {});
  test('test 3', async ({ page }) => {});
});
```

### 5. Optimize Selectors

**Fast selectors (in order):**
```javascript
// 1. Data attributes (fastest)
page.locator('[data-testid="submit-btn"]')

// 2. Role-based (fast + accessible)
page.getByRole('button', { name: 'Submit' })

// 3. Label (fast for forms)
page.getByLabel('Email')

// 4. Text (can be slow with many elements)
page.getByText('Welcome')

// Avoid: Complex CSS selectors
page.locator('.container > .row:nth-child(2) .btn-primary') // Slow!
```

### 6. Smart Waiting Strategies

**Use auto-waiting effectively:**
```javascript
// ✅ Auto-waits for element
await page.getByRole('button', { name: 'Submit' }).click();

// ✅ Wait for specific state
await page.getByRole('alert').waitFor({ state: 'visible' });

// ✅ Wait for network
await page.waitForResponse(response => 
  response.url().includes('/api/users')
);

// ❌ Arbitrary waits (slow and flaky)
await page.waitForTimeout(5000);
```

### 7. Reduce Test Scope

**Focus on critical paths:**
```javascript
// Tag tests by priority
test('critical user flow @critical', async ({ page }) => {
  // Critical path test
});

test('edge case @edge', async ({ page }) => {
  // Less critical test
});

// Run only critical tests
// npx playwright test --grep @critical
```

### 8. Use Test Fixtures for Reusable Setup

```javascript
// fixtures.js
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Login once per test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
    
    await use(page);
  },
  
  productPage: async ({ page }, use) => {
    // Setup product with test data
    await page.goto('/product/test-product');
    await use(page);
    
    // Cleanup happens automatically
  }
});

// Use in tests
test('test with authenticated page', async ({ authenticatedPage }) => {
  // Already logged in!
});
```

## Database Optimization

### Reset Database Efficiently

```javascript
// global-setup.js
async function globalSetup() {
  // Seed database once
  await resetDatabase();
  await seedTestData();
}

// Use transactions for isolation
test.beforeEach(async ({ page }) => {
  // Start transaction
  await page.evaluate(() => {
    window.__testTransaction = true;
  });
});

test.afterEach(async ({ page }) => {
  // Rollback transaction
  await page.evaluate(() => {
    if (window.__testTransaction) {
      // Rollback via API
      fetch('/api/test/rollback', { method: 'POST' });
    }
  });
});
```

## CI/CD Optimization

### GitHub Actions Example

```yaml
name: Playwright Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run tests
        run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report-${{ matrix.shardIndex }}
          path: playwright-report/
          retention-days: 7
```

## Monitoring and Profiling

### Track Test Performance

```javascript
// test-performance.js
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const startTime = Date.now();
    
    await use(page);
    
    const duration = Date.now() - startTime;
    console.log(`Test duration: ${duration}ms`);
    
    // Log slow tests
    if (duration > 10000) {
      console.warn(`⚠️ Slow test detected: ${duration}ms`);
    }
  }
});
```

### Profile Network Activity

```javascript
test('profile network', async ({ page }) => {
  const requests = [];
  
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      time: Date.now()
    });
  });
  
  page.on('response', response => {
    const request = requests.find(r => r.url === response.url());
    if (request) {
      request.duration = Date.now() - request.time;
    }
  });
  
  await page.goto('/');
  
  // Find slow requests
  const slowRequests = requests.filter(r => r.duration > 1000);
  console.log('Slow requests:', slowRequests);
});
```

## Memory Optimization

### Clean Up Properly

```javascript
test.afterEach(async ({ page, context }) => {
  // Clear storage
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Remove event listeners
  await page.removeAllListeners();
});
```

### Limit Browser Contexts

```javascript
// Reuse context when possible
const context = await browser.newContext();

test('test 1', async () => {
  const page = await context.newPage();
  // ...
  await page.close();
});

test('test 2', async () => {
  const page = await context.newPage();
  // ...
  await page.close();
});

test.afterAll(async () => {
  await context.close();
});
```

## Best Practices Summary

1. **Use storageState** for authentication (skip login)
2. **Block unnecessary resources** (images, fonts, analytics)
3. **Mock slow APIs** when testing UI
4. **Setup/teardown via API** not UI
5. **Run tests in parallel** when possible
6. **Use focused selectors** (data-testid, role)
7. **Avoid arbitrary waits** (use auto-waiting)
8. **Collect traces/videos** only on failure
9. **Run critical tests** on all browsers, others on one
10. **Profile slow tests** and optimize them

## Performance Metrics

**Target metrics:**
- Individual test: < 10 seconds
- Full suite (100 tests): < 5 minutes (with parallelization)
- CI pipeline: < 10 minutes total

**If tests are slower, investigate:**
- Network requests (block/mock)
- Database operations (use API)
- Wait times (remove arbitrary waits)
- Setup/teardown (optimize or cache)
- Browser contexts (reuse when possible)
