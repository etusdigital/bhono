# Playwright Test Architecture

## Project Structure

### Recommended Structure

```
project/
├── tests/
│   ├── e2e/                      # End-to-end tests
│   │   ├── auth/
│   │   │   ├── login.spec.js
│   │   │   ├── signup.spec.js
│   │   │   └── oauth.spec.js
│   │   ├── user-flows/
│   │   │   ├── checkout.spec.js
│   │   │   ├── onboarding.spec.js
│   │   │   └── search.spec.js
│   │   └── critical/
│   │       └── smoke.spec.js
│   ├── api/                      # API tests
│   │   ├── users.spec.js
│   │   ├── products.spec.js
│   │   └── orders.spec.js
│   ├── visual/                   # Visual regression tests
│   │   └── components.spec.js
│   └── integration/              # Integration tests
│       └── payment.spec.js
├── tests-config/
│   ├── fixtures/                 # Test data
│   │   ├── users.js
│   │   ├── products.js
│   │   └── mock-data/
│   ├── pages/                    # Page Object Models
│   │   ├── BasePage.js
│   │   ├── LoginPage.js
│   │   ├── DashboardPage.js
│   │   └── CheckoutPage.js
│   ├── utils/                    # Helper utilities
│   │   ├── auth.js
│   │   ├── api-helpers.js
│   │   └── test-helpers.js
│   ├── fixtures.js               # Custom fixtures
│   └── global-setup.js           # Global setup
├── playwright.config.js          # Main config
└── package.json
```

## Page Object Model (POM)

### Base Page Class

```javascript
// tests-config/pages/BasePage.js
export class BasePage {
  constructor(page) {
    this.page = page;
  }

  async goto(path = '') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForElement(locator, options = {}) {
    await locator.waitFor({ state: 'visible', ...options });
  }

  async fillForm(data) {
    for (const [label, value] of Object.entries(data)) {
      await this.page.getByLabel(label).fill(value);
    }
  }

  async takeScreenshot(name) {
    await this.page.screenshot({ 
      path: `screenshots/${name}.png`,
      fullPage: true 
    });
  }
}
```

### Specific Page Classes

```javascript
// tests-config/pages/LoginPage.js
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    
    // Locators
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
  }

  async goto() {
    await super.goto('/login');
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL('**/dashboard');
  }

  async loginWithError(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.waitForElement(this.errorMessage);
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async isLoginButtonDisabled() {
    return await this.submitButton.isDisabled();
  }
}
```

### Component Classes

For reusable components:

```javascript
// tests-config/pages/components/Header.js
export class Header {
  constructor(page) {
    this.page = page;
    this.container = page.getByRole('banner');
    this.logo = this.container.getByRole('link', { name: 'Home' });
    this.userMenu = this.container.getByRole('button', { name: 'User menu' });
    this.cartIcon = this.container.getByRole('link', { name: 'Cart' });
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async getCartCount() {
    const badge = this.cartIcon.locator('.badge');
    return await badge.textContent();
  }

  async logout() {
    await this.openUserMenu();
    await this.page.getByRole('menuitem', { name: 'Logout' }).click();
  }
}

// Use in page classes
import { Header } from './components/Header';

export class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
    this.header = new Header(page);
  }

  async logout() {
    await this.header.logout();
  }
}
```

## Custom Fixtures

### Create Reusable Fixtures

```javascript
// tests-config/fixtures.js
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

export const test = base.extend({
  // Page fixtures
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  // Authenticated user fixture
  authenticatedUser: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');
    await use(page);
  },

  // API fixture
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: 'http://localhost:3000/api',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`
      }
    });
    await use(context);
    await context.dispose();
  },

  // Test data fixture
  testUser: async ({ page }, use) => {
    // Create test user
    const userId = `test-${Date.now()}`;
    const user = {
      id: userId,
      email: `${userId}@test.com`,
      password: 'Test123!'
    };
    
    await use(user);
    
    // Cleanup
    await page.request.delete(`/api/users/${user.id}`);
  }
});

export { expect } from '@playwright/test';
```

### Use Custom Fixtures

```javascript
import { test, expect } from '../tests-config/fixtures';

test('login with page object', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');
  await expect(loginPage.page).toHaveURL(/dashboard/);
});

test('authenticated test', async ({ authenticatedUser }) => {
  // Already logged in!
  await authenticatedUser.goto('/profile');
  await expect(authenticatedUser.getByText('Profile')).toBeVisible();
});

test('with test user', async ({ testUser, loginPage }) => {
  await loginPage.goto();
  await loginPage.login(testUser.email, testUser.password);
});
```

## Test Organization Patterns

### 1. Feature-Based Organization

```
tests/
├── authentication/
│   ├── login.spec.js
│   ├── signup.spec.js
│   ├── password-reset.spec.js
│   └── oauth.spec.js
├── shopping-cart/
│   ├── add-items.spec.js
│   ├── update-cart.spec.js
│   └── checkout.spec.js
└── user-profile/
    ├── edit-profile.spec.js
    └── settings.spec.js
```

### 2. User Journey Organization

```
tests/
├── new-user-journey/
│   ├── 01-signup.spec.js
│   ├── 02-onboarding.spec.js
│   └── 03-first-purchase.spec.js
├── returning-user-journey/
│   ├── 01-login.spec.js
│   ├── 02-browse.spec.js
│   └── 03-checkout.spec.js
```

### 3. Priority-Based Organization

```
tests/
├── critical/           # P0 - Must pass
│   └── smoke.spec.js
├── high-priority/      # P1 - Core features
│   ├── checkout.spec.js
│   └── payment.spec.js
├── medium-priority/    # P2 - Important features
│   └── search.spec.js
└── low-priority/       # P3 - Nice to have
    └── animations.spec.js
```

## Test Suites Configuration

### Multiple Test Suites

```javascript
// playwright.config.js
export default defineConfig({
  projects: [
    // Smoke tests - run first
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.js/,
      retries: 0,
    },
    
    // Critical tests - run on all browsers
    {
      name: 'critical-chrome',
      testMatch: /critical.*\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'critical-firefox',
      testMatch: /critical.*\.spec\.js/,
      use: { ...devices['Desktop Firefox'] },
    },
    
    // Regular tests - chromium only
    {
      name: 'chromium',
      testMatch: /.*\.spec\.js/,
      testIgnore: [/smoke\.spec\.js/, /critical.*\.spec\.js/],
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Mobile tests
    {
      name: 'mobile',
      testMatch: /mobile.*\.spec\.js/,
      use: { ...devices['iPhone 13'] },
    },
    
    // API tests
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.js/,
    },
  ],
});
```

### Run Specific Suites

```bash
# Run only smoke tests
npx playwright test --project=smoke

# Run critical tests
npx playwright test --grep critical

# Run by tag
npx playwright test --grep @smoke
```

## Test Naming Conventions

### Descriptive Test Names

```javascript
// ✅ Good - clear and specific
test('should display error message when email is invalid', async ({ page }) => {});
test('should redirect to dashboard after successful login', async ({ page }) => {});
test('should disable submit button when form is incomplete', async ({ page }) => {});

// ❌ Bad - vague
test('test login', async ({ page }) => {});
test('error handling', async ({ page }) => {});
test('test1', async ({ page }) => {});
```

### Test Tags

```javascript
// Use tags for categorization
test('should complete checkout @critical @checkout', async ({ page }) => {});
test('should search products @search @slow', async ({ page }) => {});
test('should update profile @profile @authenticated', async ({ page }) => {});
```

## Test Data Management

### Fixtures Approach

```javascript
// tests-config/fixtures/users.js
export const users = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'admin'
  },
  regular: {
    email: 'user@test.com',
    password: 'User123!',
    role: 'user'
  },
  premium: {
    email: 'premium@test.com',
    password: 'Premium123!',
    role: 'premium'
  }
};

// Use in tests
import { users } from '../fixtures/users';

test('admin can access dashboard', async ({ loginPage }) => {
  await loginPage.login(users.admin.email, users.admin.password);
});
```

### Factory Pattern

```javascript
// tests-config/fixtures/factories.js
export class UserFactory {
  static create(overrides = {}) {
    const timestamp = Date.now();
    return {
      id: `user-${timestamp}`,
      email: `user-${timestamp}@test.com`,
      password: 'Test123!',
      name: 'Test User',
      role: 'user',
      ...overrides
    };
  }

  static createAdmin(overrides = {}) {
    return this.create({ role: 'admin', ...overrides });
  }
}

// Use in tests
test('with generated user', async ({ page }) => {
  const user = UserFactory.create();
  // Use user...
});
```

## Environment Configuration

### Multiple Environments

```javascript
// playwright.config.js
const environments = {
  local: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:3001'
  },
  staging: {
    baseURL: 'https://staging.example.com',
    apiURL: 'https://api-staging.example.com'
  },
  production: {
    baseURL: 'https://example.com',
    apiURL: 'https://api.example.com'
  }
};

const env = process.env.TEST_ENV || 'local';

export default defineConfig({
  use: {
    baseURL: environments[env].baseURL,
  },
});
```

### Environment-Specific Tests

```javascript
test('production-only test', async ({ page }) => {
  test.skip(process.env.TEST_ENV !== 'production', 'Production only');
  
  // Test code...
});
```

## Shared Setup and Teardown

### Global Setup

```javascript
// tests-config/global-setup.js
import { chromium } from '@playwright/test';

async function globalSetup() {
  console.log('Running global setup...');
  
  // Start services, seed database, etc.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Setup authentication
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  
  // Save auth state
  await page.context().storageState({ path: 'auth.json' });
  
  await browser.close();
  console.log('Global setup complete');
}

export default globalSetup;
```

### Global Teardown

```javascript
// tests-config/global-teardown.js
async function globalTeardown() {
  console.log('Running global teardown...');
  
  // Cleanup: stop services, clean database, etc.
  
  console.log('Global teardown complete');
}

export default globalTeardown;
```

### Configure in playwright.config.js

```javascript
export default defineConfig({
  globalSetup: require.resolve('./tests-config/global-setup'),
  globalTeardown: require.resolve('./tests-config/global-teardown'),
});
```

## Best Practices Summary

1. **Use Page Object Model** for maintainability
2. **Create custom fixtures** for reusability
3. **Organize by features or journeys** for clarity
4. **Use descriptive test names** for readability
5. **Implement base classes** to reduce duplication
6. **Separate test data** from test logic
7. **Use tags** for test categorization
8. **Configure multiple environments** properly
9. **Implement global setup** for efficiency
10. **Keep tests isolated** and independent

## Anti-Patterns to Avoid

1. ❌ **Putting all tests in one file**
2. ❌ **Hardcoding selectors in tests**
3. ❌ **Duplicating page logic**
4. ❌ **Not using fixtures**
5. ❌ **Mixing test types (unit, e2e, api)**
6. ❌ **Having tests depend on each other**
7. ❌ **Not cleaning up test data**
8. ❌ **Inconsistent naming conventions**
9. ❌ **Not using environment configuration**
10. ❌ **Having too many abstraction layers**
