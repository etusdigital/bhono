# Playwright Debugging Strategies

## Interactive Debugging

### Debug Mode

**Run tests in debug mode:**
```bash
# Debug specific test
npx playwright test auth.spec.js --debug

# Debug with specific browser
npx playwright test --debug --project=chromium

# Debug from specific line
npx playwright test --debug --grep "should login"
```

**Features in debug mode:**
- Step through test execution
- Inspect page state
- Execute Playwright commands
- View selector picker

### UI Mode

**Run tests in UI mode for better visibility:**
```bash
npx playwright test --ui
```

**UI Mode features:**
- Watch mode with auto-reload
- Time travel debugging
- View all actions
- Pick selectors visually
- See network activity
- Watch locators

### Playwright Inspector

```javascript
// Add breakpoint in code
await page.pause();

// Inspector will open automatically
await page.getByRole('button').click();
await page.pause(); // Pause again after action
```

## Trace Viewer

### Collect Traces

```javascript
// playwright.config.js
export default defineConfig({
  use: {
    trace: 'on-first-retry', // Collect trace on first retry
    // or 'on' to always collect
    // or 'retain-on-failure' to keep only failed traces
  },
});
```

**View traces:**
```bash
# View trace file
npx playwright show-trace trace.zip

# Or open from test results
npx playwright show-report
```

**Trace viewer features:**
- Timeline of all actions
- Screenshots at each step
- Network requests
- Console logs
- Source code
- DOM snapshots

### Manual Trace Collection

```javascript
test('with manual trace', async ({ page, context }) => {
  // Start tracing
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true
  });
  
  // Your test code
  await page.goto('/');
  await page.getByRole('button').click();
  
  // Stop and save trace
  await context.tracing.stop({
    path: 'trace.zip'
  });
});
```

## Console Debugging

### Capture Console Messages

```javascript
test('capture console', async ({ page }) => {
  const messages = [];
  
  page.on('console', msg => {
    messages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`${msg.type()}: ${msg.text()}`);
  });
  
  await page.goto('/');
  
  // Check for errors
  const errors = messages.filter(m => m.type === 'error');
  expect(errors).toHaveLength(0);
});
```

### Add Debug Logs

```javascript
test('with debug logs', async ({ page }) => {
  console.log('Starting test...');
  
  await page.goto('/');
  console.log('Navigated to page');
  
  const title = await page.title();
  console.log(`Page title: ${title}`);
  
  await page.getByRole('button').click();
  console.log('Clicked button');
});
```

## Network Debugging

### Monitor Network Requests

```javascript
test('monitor network', async ({ page }) => {
  const requests = [];
  const responses = [];
  
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
    console.log(`→ ${request.method()} ${request.url()}`);
  });
  
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    });
    console.log(`← ${response.status()} ${response.url()}`);
  });
  
  page.on('requestfailed', request => {
    console.error(`✖ ${request.url()} ${request.failure().errorText}`);
  });
  
  await page.goto('/');
  
  // Verify requests
  const apiCalls = requests.filter(r => r.url.includes('/api/'));
  console.log(`API calls: ${apiCalls.length}`);
});
```

### Debug Failed Requests

```javascript
test('debug failed requests', async ({ page }) => {
  const failedRequests = [];
  
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      error: request.failure().errorText,
      method: request.method()
    });
  });
  
  await page.goto('/');
  
  if (failedRequests.length > 0) {
    console.error('Failed requests:', failedRequests);
  }
});
```

## Screenshot Debugging

### Take Screenshots at Key Points

```javascript
test('debug with screenshots', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'screenshots/01-homepage.png' });
  
  await page.getByRole('button', { name: 'Login' }).click();
  await page.screenshot({ path: 'screenshots/02-clicked-login.png' });
  
  await page.getByLabel('Email').fill('test@example.com');
  await page.screenshot({ path: 'screenshots/03-filled-email.png' });
});
```

### Screenshot on Failure

```javascript
// playwright.config.js
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
  },
});

// Or programmatically
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({
      path: `screenshots/failure-${testInfo.title}.png`,
      fullPage: true
    });
  }
});
```

## Selector Debugging

### Test Selectors

```javascript
test('test selector', async ({ page }) => {
  await page.goto('/');
  
  // Check if selector exists
  const button = page.getByRole('button', { name: 'Submit' });
  const count = await button.count();
  console.log(`Found ${count} matching elements`);
  
  // Get all matching elements
  const all = await button.all();
  console.log(`Elements:`, await Promise.all(
    all.map(el => el.textContent())
  ));
  
  // Check visibility
  const isVisible = await button.isVisible();
  console.log(`Is visible: ${isVisible}`);
});
```

### Generate Selectors

```bash
# Use codegen to generate selectors
npx playwright codegen http://localhost:3000
```

### Find Elements Interactively

```javascript
test('find elements', async ({ page }) => {
  await page.goto('/');
  
  // Pause and use selector picker
  await page.pause();
  
  // Or evaluate in browser
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map(btn => ({
        text: btn.textContent,
        id: btn.id,
        classes: btn.className
      }));
  });
  console.log('Buttons:', elements);
});
```

## State Debugging

### Inspect Page State

```javascript
test('inspect state', async ({ page }) => {
  await page.goto('/');
  
  // Get localStorage
  const localStorage = await page.evaluate(() => {
    return JSON.stringify(window.localStorage);
  });
  console.log('localStorage:', localStorage);
  
  // Get cookies
  const cookies = await page.context().cookies();
  console.log('Cookies:', cookies);
  
  // Get session storage
  const sessionStorage = await page.evaluate(() => {
    return JSON.stringify(window.sessionStorage);
  });
  console.log('sessionStorage:', sessionStorage);
  
  // Check page properties
  const title = await page.title();
  const url = page.url();
  console.log(`Title: ${title}, URL: ${url}`);
});
```

### Debug JavaScript State

```javascript
test('debug js state', async ({ page }) => {
  await page.goto('/');
  
  // Execute code in browser context
  const appState = await page.evaluate(() => {
    return {
      // Access global variables
      userLoggedIn: window.userLoggedIn,
      currentUser: window.currentUser,
      
      // Check DOM state
      elementCount: document.querySelectorAll('button').length,
      
      // Check computed styles
      bodyBg: window.getComputedStyle(document.body).backgroundColor
    };
  });
  
  console.log('App state:', appState);
});
```

## Flaky Test Debugging

### Identify Flakiness

```javascript
test('potentially flaky test', async ({ page }) => {
  // Add longer timeout for investigation
  test.setTimeout(60000);
  
  await page.goto('/');
  
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  
  // Add explicit waits to find race conditions
  await page.waitForSelector('[data-loaded="true"]');
  
  // Log timing
  const startTime = Date.now();
  await page.getByRole('button').click();
  console.log(`Click took ${Date.now() - startTime}ms`);
});
```

### Repeat Flaky Tests

```bash
# Run test multiple times to reproduce flakiness
npx playwright test flaky.spec.js --repeat-each=10

# Run with different timeouts
npx playwright test --timeout=60000
```

### Add Retry Logic for Investigation

```javascript
// playwright.config.js
export default defineConfig({
  retries: 2, // Retry failed tests
  
  use: {
    trace: 'on-first-retry', // Collect trace on retry
    video: 'retain-on-failure',
  },
});
```

## Error Analysis

### Capture Detailed Errors

```javascript
test('capture errors', async ({ page }) => {
  const errors = [];
  
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('Page error:', error);
  });
  
  page.on('crash', () => {
    console.error('Page crashed!');
  });
  
  await page.goto('/');
  
  // Check for errors at end
  expect(errors).toHaveLength(0);
});
```

### Custom Error Messages

```javascript
test('with custom errors', async ({ page }) => {
  await page.goto('/');
  
  const button = page.getByRole('button', { name: 'Submit' });
  
  // Add context to assertions
  await expect(button, 'Submit button should be visible on homepage')
    .toBeVisible();
  
  // Add custom error for better debugging
  const isDisabled = await button.isDisabled();
  if (isDisabled) {
    throw new Error(
      'Submit button is disabled. ' +
      'Check if form validation is complete.'
    );
  }
});
```

## Video Recording

### Record Tests

```javascript
// playwright.config.js
export default defineConfig({
  use: {
    video: 'on-first-retry', // Record video on first retry
    // or 'on' to always record
    // or 'retain-on-failure' to keep only failed test videos
  },
});
```

**View videos:**
Videos are saved in `test-results/` directory.

### Manual Video Recording

```javascript
test('with manual video', async ({ page, context }) => {
  // Start recording
  await context.tracing.start({ screenshots: true, snapshots: true });
  
  // Test code
  await page.goto('/');
  
  // Stop and save
  await context.tracing.stop({ path: 'trace.zip' });
});
```

## Browser Context Debugging

### Inspect Multiple Contexts

```javascript
test('debug contexts', async ({ browser }) => {
  // Create contexts with different states
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // Different cookies for each
  await context1.addCookies([
    { name: 'user', value: 'user1', url: 'http://localhost:3000' }
  ]);
  
  await context2.addCookies([
    { name: 'user', value: 'user2', url: 'http://localhost:3000' }
  ]);
  
  await page1.goto('/');
  await page2.goto('/');
  
  // Compare states
  const user1 = await page1.textContent('.username');
  const user2 = await page2.textContent('.username');
  
  console.log(`Context 1 user: ${user1}`);
  console.log(`Context 2 user: ${user2}`);
  
  await context1.close();
  await context2.close();
});
```

## Common Issues and Solutions

### Issue: Element Not Found

```javascript
// Debug missing element
test('element not found', async ({ page }) => {
  await page.goto('/');
  
  // Check if element exists
  const element = page.getByRole('button', { name: 'Submit' });
  const count = await element.count();
  
  if (count === 0) {
    // Element doesn't exist
    console.error('Element not found!');
    
    // List all buttons
    const allButtons = await page.getByRole('button').all();
    const buttonTexts = await Promise.all(
      allButtons.map(btn => btn.textContent())
    );
    console.log('Available buttons:', buttonTexts);
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'debug-missing-element.png' });
  }
});
```

### Issue: Timing Problems

```javascript
// Debug timing issues
test('timing debug', async ({ page }) => {
  await page.goto('/');
  
  // Log when element appears
  const button = page.getByRole('button', { name: 'Submit' });
  
  const startTime = Date.now();
  await button.waitFor({ state: 'visible' });
  const waitTime = Date.now() - startTime;
  
  console.log(`Button appeared after ${waitTime}ms`);
  
  if (waitTime > 5000) {
    console.warn('⚠️ Slow element appearance detected');
  }
});
```

### Issue: Unexpected Behavior

```javascript
// Debug unexpected behavior
test('unexpected behavior', async ({ page }) => {
  await page.goto('/');
  
  // Log all events
  page.on('load', () => console.log('Page loaded'));
  page.on('domcontentloaded', () => console.log('DOM ready'));
  page.on('request', req => console.log('Request:', req.url()));
  page.on('response', res => console.log('Response:', res.url(), res.status()));
  
  // Perform action
  await page.getByRole('button').click();
  
  // Wait and inspect
  await page.waitForTimeout(1000);
  
  // Check current state
  const currentUrl = page.url();
  const title = await page.title();
  console.log(`Current URL: ${currentUrl}, Title: ${title}`);
});
```

## Debugging Best Practices

1. **Use UI mode** for interactive debugging
2. **Enable trace collection** on failures
3. **Add console.log** at key points
4. **Take screenshots** when unsure
5. **Monitor network** for API issues
6. **Use page.pause()** to inspect interactively
7. **Check selector count** before clicking
8. **Verify element state** before actions
9. **Capture errors** proactively
10. **Test in isolation** to avoid interference

## Debugging Checklist

When a test fails, check:

- [ ] Is the selector correct? (use codegen)
- [ ] Is the element visible? (check with isVisible())
- [ ] Is the element enabled? (check with isEnabled())
- [ ] Did the page load? (check with waitForLoadState())
- [ ] Are there console errors? (check with page.on('console'))
- [ ] Did requests fail? (check with page.on('requestfailed'))
- [ ] Is timing an issue? (add explicit waits)
- [ ] Is it a flaky test? (run multiple times)
- [ ] Are there race conditions? (check network idle)
- [ ] Is the test isolated? (check beforeEach/afterEach)
