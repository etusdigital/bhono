# Playwright E2E Testing Best Practices

## Core Principles

### 1. Test User-Visible Behavior
- Test what users see and do, not implementation details
- Avoid testing internal state or methods
- Focus on user outcomes

### 2. Maintainable Selectors
**Priority order:**
1. `getByRole()` - Best for accessibility and semantics
2. `getByLabel()` - For form fields
3. `getByPlaceholder()` - For inputs
4. `getByText()` - For unique text
5. `getByTestId()` - Last resort, but reliable

**Avoid:**
- CSS selectors with classes (`.btn-primary`)
- XPath when possible
- Selectors coupled to styling

**Example:**
```javascript
// ❌ Bad - fragile, coupled to styling
await page.click('.btn.btn-primary.submit-btn');

// ✅ Good - semantic and resilient
await page.getByRole('button', { name: 'Submit' }).click();
```

### 3. Wait Strategies

**Auto-waiting (built-in):**
Playwright auto-waits for elements to be actionable before performing actions.

**Explicit waits when needed:**
```javascript
// Wait for element to be visible
await page.getByRole('alert').waitFor({ state: 'visible' });

// Wait for network
await page.waitForResponse(response => 
  response.url().includes('/api/users') && response.status() === 200
);

// Wait for function
await page.waitForFunction(() => window.dataLoaded === true);
```

**Avoid:**
- `page.waitForTimeout()` - Makes tests slower and flaky
- Arbitrary waits

### 4. Page Object Model (POM)

Encapsulate page logic for reusability:

```javascript
// pages/LoginPage.js
export class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }
}
```

### 5. Test Isolation

Each test should be independent:

```javascript
test.beforeEach(async ({ page }) => {
  // Fresh state for each test
  await page.goto('/');
  await loginAsUser(page, 'test@example.com');
});

test.afterEach(async ({ page }) => {
  // Cleanup if needed
  await cleanupTestData();
});
```

### 6. Assertions

**Use web-first assertions:**
```javascript
// ✅ Good - auto-waits and retries
await expect(page.getByText('Success')).toBeVisible();
await expect(page).toHaveURL(/dashboard/);

// ❌ Bad - no auto-waiting
const text = await page.textContent('.message');
expect(text).toBe('Success');
```

### 7. Parallel Execution

Enable parallel tests for speed:

```javascript
// playwright.config.js
export default {
  workers: process.env.CI ? 4 : 2,
  fullyParallel: true,
};
```

### 8. Test Data Management

**Use fixtures for data:**
```javascript
// fixtures/users.js
export const testUsers = {
  admin: { email: 'admin@test.com', password: 'admin123' },
  regular: { email: 'user@test.com', password: 'user123' }
};

// test
import { testUsers } from './fixtures/users';
await loginPage.login(testUsers.admin.email, testUsers.admin.password);
```

### 9. Network Control

**Mock API responses when needed:**
```javascript
await page.route('**/api/users', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Test User' }])
  });
});
```

### 10. Visual Testing

**Use screenshots strategically:**
```javascript
// Full page
await expect(page).toHaveScreenshot('dashboard.png');

// Specific element
await expect(page.getByRole('navigation')).toHaveScreenshot('nav.png');
```

## Test Organization

### File Structure
```
tests/
├── auth/
│   ├── login.spec.js
│   ├── signup.spec.js
│   └── oauth.spec.js
├── features/
│   ├── checkout.spec.js
│   ├── profile.spec.js
│   └── search.spec.js
├── api/
│   └── users.spec.js
├── fixtures/
│   ├── users.js
│   └── products.js
├── pages/
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   └── CheckoutPage.js
└── utils/
    ├── auth.js
    └── helpers.js
```

### Naming Conventions
```javascript
// ✅ Descriptive test names
test('should display error when email is invalid', async ({ page }) => {});

// ❌ Vague names
test('test1', async ({ page }) => {});
```

## Performance Tips

1. **Reuse browser contexts:**
```javascript
// Use storageState to skip login
test.use({ storageState: 'auth.json' });
```

2. **Run in headless mode in CI:**
```javascript
headless: process.env.CI ? true : false
```

3. **Use test.describe.configure for slow tests:**
```javascript
test.describe.configure({ mode: 'serial' });
```

4. **Optimize network:**
```javascript
// Block unnecessary resources
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
```

## Debugging

1. **Use debug mode:**
```bash
npx playwright test --debug
```

2. **Use trace viewer:**
```javascript
test.use({ trace: 'on-first-retry' });
```

3. **Console logs:**
```javascript
page.on('console', msg => console.log(msg.text()));
```

## Coverage Strategy

1. **Critical user paths** - High priority
2. **Edge cases** - Medium priority
3. **Error scenarios** - Medium priority
4. **Happy paths** - Baseline
5. **Cross-browser** - Use @slow tag for selected tests

## Anti-Patterns to Avoid

1. ❌ Testing implementation details
2. ❌ Over-relying on CSS selectors
3. ❌ Not using Page Objects for complex flows
4. ❌ Skipping cleanup between tests
5. ❌ Hard-coded waits with `setTimeout`
6. ❌ Not testing error states
7. ❌ Duplicate test logic
8. ❌ Not using CI/CD integration
