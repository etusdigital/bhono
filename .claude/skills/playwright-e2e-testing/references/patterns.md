# Playwright Testing Patterns

## Authentication Patterns

### Pattern 1: OAuth Flow Testing

**Full OAuth flow:**
```javascript
test('should complete OAuth login flow', async ({ page, context }) => {
  // Start OAuth flow
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  
  // Wait for OAuth popup
  const popupPromise = context.waitForEvent('page');
  const popup = await popupPromise;
  
  // Fill OAuth provider credentials
  await popup.getByLabel('Email').fill('test@gmail.com');
  await popup.getByLabel('Password').fill('password123');
  await popup.getByRole('button', { name: 'Sign in' }).click();
  
  // Wait for redirect back to app
  await page.waitForURL('**/dashboard');
  
  // Verify logged in state
  await expect(page.getByText('Welcome back')).toBeVisible();
});
```

**OAuth with storage state (skip login):**
```javascript
// global-setup.js
async function globalSetup(config) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Perform OAuth login
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  // ... complete OAuth flow
  
  // Save authenticated state
  await page.context().storageState({ path: 'auth.json' });
  await browser.close();
}

// Use in tests
test.use({ storageState: 'auth.json' });
```

**OAuth token injection:**
```javascript
test.beforeEach(async ({ page }) => {
  // Inject OAuth token directly
  await page.addInitScript(token => {
    localStorage.setItem('oauth_token', token);
    localStorage.setItem('oauth_expires', Date.now() + 3600000);
  }, process.env.TEST_OAUTH_TOKEN);
  
  await page.goto('/dashboard');
});
```

### Pattern 2: Session-Based Authentication

```javascript
// utils/auth.js
export async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

// Reuse in tests
test.beforeEach(async ({ page }) => {
  await login(page, 'test@example.com', 'password123');
});
```

### Pattern 3: API Authentication

```javascript
test('should authenticate via API', async ({ page, request }) => {
  // Get token via API
  const response = await request.post('/api/auth/login', {
    data: {
      email: 'test@example.com',
      password: 'password123'
    }
  });
  
  const { token } = await response.json();
  
  // Set token in browser
  await page.goto('/');
  await page.evaluate(token => {
    localStorage.setItem('auth_token', token);
  }, token);
  
  await page.goto('/dashboard');
});
```

## Event Testing Patterns

### Pattern 1: Testing Custom Events

```javascript
test('should fire custom event on user action', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Listen for custom event
  const eventPromise = page.evaluate(() => {
    return new Promise(resolve => {
      document.addEventListener('userAction', (e) => {
        resolve(e.detail);
      }, { once: true });
    });
  });
  
  // Trigger action
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Verify event fired with correct data
  const eventData = await eventPromise;
  expect(eventData).toEqual({
    action: 'submit',
    timestamp: expect.any(Number)
  });
});
```

### Pattern 2: Testing Analytics Events

```javascript
test('should track analytics on page interaction', async ({ page }) => {
  const analyticsEvents = [];
  
  // Intercept analytics calls
  await page.route('**/analytics/track', (route, request) => {
    analyticsEvents.push(request.postDataJSON());
    route.fulfill({ status: 200, body: '{}' });
  });
  
  await page.goto('/product/123');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  
  // Verify analytics event
  expect(analyticsEvents).toContainEqual(
    expect.objectContaining({
      event: 'add_to_cart',
      product_id: '123'
    })
  );
});
```

### Pattern 3: Testing Event Bubbling

```javascript
test('should handle event bubbling correctly', async ({ page }) => {
  await page.goto('/list');
  
  const clickedItems = [];
  
  // Monitor events at different levels
  await page.evaluate(() => {
    document.querySelector('.list').addEventListener('click', (e) => {
      window.listClicked = true;
    });
    document.querySelectorAll('.item').forEach(item => {
      item.addEventListener('click', (e) => {
        window.itemClicked = item.dataset.id;
      });
    });
  });
  
  // Click item
  await page.locator('.item[data-id="1"]').click();
  
  // Verify both events fired
  const listClicked = await page.evaluate(() => window.listClicked);
  const itemClicked = await page.evaluate(() => window.itemClicked);
  
  expect(listClicked).toBe(true);
  expect(itemClicked).toBe('1');
});
```

### Pattern 4: Testing DOM Mutation Events

```javascript
test('should react to DOM changes', async ({ page }) => {
  await page.goto('/dynamic-content');
  
  // Set up mutation observer
  await page.evaluate(() => {
    window.mutations = [];
    const observer = new MutationObserver((mutations) => {
      window.mutations.push(...mutations.map(m => ({
        type: m.type,
        target: m.target.tagName
      })));
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
  
  // Trigger action that causes DOM changes
  await page.getByRole('button', { name: 'Load More' }).click();
  await page.waitForTimeout(100); // Let mutations settle
  
  // Verify mutations
  const mutations = await page.evaluate(() => window.mutations);
  expect(mutations.length).toBeGreaterThan(0);
  expect(mutations[0]).toMatchObject({
    type: 'childList',
    target: expect.any(String)
  });
});
```

## API Testing Patterns

### Pattern 1: REST API Testing

```javascript
test('should handle API endpoints correctly', async ({ request }) => {
  // GET request
  const getResponse = await request.get('/api/users/1');
  expect(getResponse.ok()).toBeTruthy();
  const user = await getResponse.json();
  expect(user).toMatchObject({
    id: 1,
    email: expect.stringMatching(/@/)
  });
  
  // POST request
  const postResponse = await request.post('/api/users', {
    data: {
      name: 'Test User',
      email: 'test@example.com'
    }
  });
  expect(postResponse.status()).toBe(201);
  
  // PUT request
  const putResponse = await request.put('/api/users/1', {
    data: { name: 'Updated Name' }
  });
  expect(putResponse.ok()).toBeTruthy();
  
  // DELETE request
  const deleteResponse = await request.delete('/api/users/1');
  expect(deleteResponse.status()).toBe(204);
});
```

### Pattern 2: API Mocking

```javascript
test('should work with mocked API', async ({ page }) => {
  // Mock successful response
  await page.route('**/api/products', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Product 1', price: 100 },
        { id: 2, name: 'Product 2', price: 200 }
      ])
    });
  });
  
  await page.goto('/products');
  await expect(page.getByText('Product 1')).toBeVisible();
  await expect(page.getByText('$100')).toBeVisible();
});

test('should handle API errors gracefully', async ({ page }) => {
  // Mock error response
  await page.route('**/api/products', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' })
    });
  });
  
  await page.goto('/products');
  await expect(page.getByText('Error loading products')).toBeVisible();
});
```

## Form Testing Patterns

### Pattern 1: Complex Form Validation

```javascript
test('should validate form fields correctly', async ({ page }) => {
  await page.goto('/signup');
  
  // Test required fields
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Email is required')).toBeVisible();
  
  // Test invalid email
  await page.getByLabel('Email').fill('invalid-email');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Invalid email format')).toBeVisible();
  
  // Test password strength
  await page.getByLabel('Password').fill('weak');
  await expect(page.getByText('Password too weak')).toBeVisible();
  
  // Test valid submission
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('StrongPass123!');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page).toHaveURL('/welcome');
});
```

### Pattern 2: File Upload

```javascript
test('should upload files correctly', async ({ page }) => {
  await page.goto('/upload');
  
  const fileInput = page.getByLabel('Upload file');
  await fileInput.setInputFiles('./fixtures/test-file.pdf');
  
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('File uploaded successfully')).toBeVisible();
});

test('should handle multiple file uploads', async ({ page }) => {
  await page.goto('/upload');
  
  await page.getByLabel('Upload files').setInputFiles([
    './fixtures/file1.pdf',
    './fixtures/file2.pdf'
  ]);
  
  await expect(page.getByText('2 files selected')).toBeVisible();
});
```

## Navigation Patterns

### Pattern 1: Multi-Step Flow

```javascript
test('should complete checkout flow', async ({ page }) => {
  // Step 1: Add to cart
  await page.goto('/product/123');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByText('Added to cart')).toBeVisible();
  
  // Step 2: Go to cart
  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByText('1 item')).toBeVisible();
  
  // Step 3: Checkout
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout/);
  
  // Step 4: Fill shipping info
  await page.getByLabel('Address').fill('123 Main St');
  await page.getByLabel('City').fill('San Francisco');
  await page.getByRole('button', { name: 'Continue' }).click();
  
  // Step 5: Payment
  await page.getByLabel('Card number').fill('4242424242424242');
  await page.getByRole('button', { name: 'Place Order' }).click();
  
  // Verify success
  await expect(page).toHaveURL(/\/order-confirmation/);
  await expect(page.getByText('Order placed successfully')).toBeVisible();
});
```

### Pattern 2: Back Button Handling

```javascript
test('should handle browser back button', async ({ page }) => {
  await page.goto('/page1');
  await page.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/page2/);
  
  // Go back
  await page.goBack();
  await expect(page).toHaveURL(/\/page1/);
  
  // Go forward
  await page.goForward();
  await expect(page).toHaveURL(/\/page2/);
});
```

## WebSocket Testing Patterns

```javascript
test('should handle WebSocket messages', async ({ page }) => {
  const messages = [];
  
  // Intercept WebSocket
  await page.route('wss://**', (route) => {
    // Can't fully mock WebSocket, but can monitor
    route.continue();
  });
  
  // Listen for WebSocket messages in page context
  await page.evaluate(() => {
    window.wsMessages = [];
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      const ws = new originalWebSocket(...args);
      ws.addEventListener('message', (event) => {
        window.wsMessages.push(event.data);
      });
      return ws;
    };
  });
  
  await page.goto('/chat');
  await page.getByLabel('Message').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  
  // Wait for response
  await page.waitForTimeout(1000);
  
  const wsMessages = await page.evaluate(() => window.wsMessages);
  expect(wsMessages.length).toBeGreaterThan(0);
});
```

## Visual Regression Patterns

```javascript
test('should match visual snapshot', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Wait for dynamic content to load
  await page.waitForLoadState('networkidle');
  
  // Take full page screenshot
  await expect(page).toHaveScreenshot('dashboard.png', {
    maxDiffPixels: 100 // Allow small differences
  });
});

test('should match component snapshot', async ({ page }) => {
  await page.goto('/components');
  
  // Screenshot specific component
  const button = page.getByRole('button', { name: 'Primary' });
  await expect(button).toHaveScreenshot('primary-button.png');
});
```

## Mobile Testing Patterns

```javascript
test('should work on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  
  // Test mobile menu
  await page.getByLabel('Open menu').click();
  await expect(page.getByRole('navigation')).toBeVisible();
});

test.use({ 
  ...devices['iPhone 13']
});

test('should work on iPhone', async ({ page }) => {
  await page.goto('/');
  // Tests will use iPhone 13 configuration
});
```

## Accessibility Testing Patterns

```javascript
test('should be accessible', async ({ page }) => {
  await page.goto('/');
  
  // Check for ARIA labels
  const button = page.getByRole('button', { name: 'Submit' });
  await expect(button).toHaveAttribute('aria-label', 'Submit form');
  
  // Check for keyboard navigation
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  
  // Check color contrast (manual verification needed)
  const bgColor = await button.evaluate(el => 
    window.getComputedStyle(el).backgroundColor
  );
  const textColor = await button.evaluate(el => 
    window.getComputedStyle(el).color
  );
  // Compare contrast ratio
});
```
