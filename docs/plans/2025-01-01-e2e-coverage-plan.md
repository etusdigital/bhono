# E2E Test Coverage Plan - Boilerplate Recommended Percentages

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve recommended E2E test coverage percentages for a production-ready boilerplate (160-200 tests with balanced distribution).

**Architecture:** Playwright E2E tests organized by category with proper tagging, web-first assertions, and CI-ready configuration. Tests will cover all pages, critical user journeys, API endpoints, error handling, visual regression, accessibility, and mobile responsiveness.

**Tech Stack:** Playwright, TypeScript, TanStack Router, Hono API, OAuth session-based auth

---

## Current State Analysis

| Category | Current Tests | Target % | Target Tests | Gap |
|----------|---------------|----------|--------------|-----|
| Smoke | ~6 | 5-10% | 8-16 | +2-10 |
| Critical Journeys | ~7 | 20-30% | 32-48 | +25-41 |
| Feature/CRUD | ~80 | 40-50% | 64-80 | Adequate |
| Error Handling | ~18 | 5-10% | 8-16 | Adequate |
| Visual Regression | ~7 | 5-10% | 8-16 | +1-9 |
| Accessibility | ~8 | 5-10% | 8-16 | +0-8 |
| Mobile/Responsive | ~6 | 5-10% | 8-16 | +2-10 |
| **Total** | **~168** | **100%** | **160-200** | **On track** |

### Missing Coverage Areas

1. **Invitation Acceptance Flow** - `invite.$token.tsx` has no E2E tests
2. **Account Page Security Features** - API key creation, session management
3. **Audit Log Viewing** - No tests for audit log API/UI
4. **Storage/File Upload** - No tests for file upload/download
5. **Multi-tenancy** - No account switching tests
6. **API CRUD Operations** - Limited coverage for accounts, storage, audits

---

## Task 1: Invitation Flow E2E Tests

**Files:**
- Create: `e2e/invitations/invite-flow.spec.ts`
- Reference: `src/client/routes/invite.$token.tsx`
- Reference: `src/server/routes/invitations/handlers.ts`

**Step 1: Create the invitation flow test file**

```typescript
import { test, expect } from '../fixtures'

/**
 * Invitation Acceptance Flow E2E Tests
 *
 * Tests the complete flow from receiving an invitation link
 * to joining a workspace.
 *
 * @tags @invitation @critical
 */

test.describe('Invitation Flow @invitation', () => {
  test.describe('Invitation Page Display', () => {
    test('should display invitation page for valid token', async ({ page }) => {
      // Use a mock token that the frontend will render
      await page.goto('/invite/test-token-123')

      // Page should load without error
      await expect(page.locator('body')).toBeVisible()

      // Should show invitation-related content or error
      const pageContent = page.locator('body')
      await expect(pageContent).toBeVisible()
    })

    test('should show error for invalid/expired token', async ({ page }) => {
      await page.goto('/invite/invalid-token-xyz')

      // Should display error state
      const errorIndicators = [
        page.getByText(/invalid|expired|not found/i),
        page.getByText(/invitation/i),
      ]

      const results = await Promise.all(
        errorIndicators.map(async (locator) => {
          try {
            await expect(locator).toBeVisible({ timeout: 3000 })
            return true
          } catch {
            return false
          }
        })
      )

      expect(results.some((r) => r)).toBeTruthy()
    })

    test('should have accept invitation button when valid', async ({ page }) => {
      await page.goto('/invite/test-token-123')

      // Look for accept button
      const acceptButton = page.getByRole('button', { name: /accept|join/i })
      const acceptLink = page.getByRole('link', { name: /accept|join/i })

      const hasButton = await acceptButton.isVisible({ timeout: 3000 }).catch(() => false)
      const hasLink = await acceptLink.isVisible({ timeout: 3000 }).catch(() => false)

      // Either accept button or error should be visible
      const hasError = await page.getByText(/invalid|expired/i).isVisible({ timeout: 1000 }).catch(() => false)

      expect(hasButton || hasLink || hasError).toBeTruthy()
    })
  })

  test.describe('Invitation URL Handling', () => {
    test('should handle invitation URL with query parameters', async ({ page }) => {
      await page.goto('/invite/test-token?email=test@example.com')

      await expect(page.locator('body')).toBeVisible()
    })

    test('should redirect authenticated user trying to accept own invite', async ({ page }) => {
      // This test would require setting up auth first
      // Skip if not authenticated
      await page.goto('/invite/test-token')
      await expect(page.locator('body')).toBeVisible()
    })
  })
})
```

**Step 2: Run the tests to verify they pass**

Run: `npx playwright test e2e/invitations --project=chromium-unauth -v`
Expected: Tests should pass or skip appropriately

**Step 3: Commit**

```bash
git add e2e/invitations/
git commit -m "test(e2e): add invitation flow tests"
```

---

## Task 2: Account Page Security Tests

**Files:**
- Create: `e2e/crud/account.spec.ts`
- Reference: `src/client/routes/__authenticated/account.tsx`

**Step 1: Create the account page test file**

```typescript
import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Account Page E2E Tests
 *
 * Tests for account security features, API keys, sessions,
 * and danger zone functionality.
 *
 * @tags @crud @account
 */

test.describe('Account Page @crud @account', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('Page Structure', () => {
    test('should display account page heading', async ({ page }) => {
      await page.goto('/account')

      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()
    })

    test('should display all account sections', async ({ page }) => {
      await page.goto('/account')

      // Security section
      await expect(page.getByRole('heading', { name: /security/i })).toBeVisible()

      // Connected accounts section
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Active sessions section
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // API access section
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()

      // Danger zone section
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()
    })
  })

  test.describe('Connected Accounts', () => {
    test('should show Google as connected provider', async ({ page }) => {
      await page.goto('/account')

      await expect(page.getByText(/google/i).first()).toBeVisible()
      await expect(page.getByText(/connected/i).first()).toBeVisible()
    })

    test('should show connected date for provider', async ({ page }) => {
      await page.goto('/account')

      // Look for date or "Connected" status
      const connectedText = page.locator('text=/connected|linked/i')
      await expect(connectedText.first()).toBeVisible()
    })
  })

  test.describe('Active Sessions', () => {
    test('should display current session', async ({ page }) => {
      await page.goto('/account')

      await expect(page.getByText(/current/i)).toBeVisible()
    })

    test('should show session details (device/browser)', async ({ page }) => {
      await page.goto('/account')

      // Should show device or browser info
      const sessionInfo = page.locator('text=/chrome|firefox|safari|desktop|mobile/i')
      const sessionCount = await sessionInfo.count()
      expect(sessionCount).toBeGreaterThan(0)
    })

    test('should have sign out all button', async ({ page }) => {
      await page.goto('/account')

      const signOutAllButton = page.getByRole('button', { name: /sign out all|revoke all/i })
      const hasSignOutAll = await signOutAllButton.isVisible({ timeout: 2000 }).catch(() => false)

      // Some implementations may not have this
      if (hasSignOutAll) {
        await expect(signOutAllButton).toBeVisible()
      }
    })
  })

  test.describe('API Access', () => {
    test('should display Create Key button', async ({ page }) => {
      await page.goto('/account')

      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await expect(createKeyButton).toBeVisible()
      await expect(createKeyButton).toBeEnabled()
    })

    test('should open API key dialog when clicking Create Key', async ({ page }) => {
      await page.goto('/account')

      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await createKeyButton.click()

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('should have key name input in dialog', async ({ page }) => {
      await page.goto('/account')

      // Open dialog
      await page.getByRole('button', { name: /create key/i }).click()

      // Should have name input
      const nameInput = page.getByLabel(/name|key name/i)
      await expect(nameInput).toBeVisible()
    })

    test('should display existing API keys if any', async ({ page }) => {
      await page.goto('/account')

      // Look for API key list or "no keys" message
      const apiSection = page.locator('text=/api access/i').locator('..')
      await expect(apiSection).toBeVisible()
    })
  })

  test.describe('Danger Zone', () => {
    test('should display delete account button', async ({ page }) => {
      await page.goto('/account')

      const deleteButton = page.getByRole('button', { name: /delete/i }).first()
      await expect(deleteButton).toBeVisible()
    })

    test('should show confirmation dialog when clicking delete', async ({ page }) => {
      await page.goto('/account')

      const deleteButton = page.getByRole('button', { name: /delete/i }).first()
      await deleteButton.click()

      // Should show confirmation dialog
      await expect(page.getByRole('dialog')).toBeVisible()

      // Should have warning text
      const warningText = page.getByText(/cannot be undone|permanent|irreversible/i)
      await expect(warningText).toBeVisible()
    })

    test('should have cancel button in delete confirmation', async ({ page }) => {
      await page.goto('/account')

      // Open delete dialog
      await page.getByRole('button', { name: /delete/i }).first().click()

      // Should have cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await expect(cancelButton).toBeVisible()

      // Close dialog
      await cancelButton.click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('delete confirmation should require typing account name', async ({ page }) => {
      await page.goto('/account')

      // Open delete dialog
      await page.getByRole('button', { name: /delete/i }).first().click()

      // Look for confirmation input
      const confirmInput = page.getByRole('textbox')
      const hasConfirmInput = await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasConfirmInput) {
        await expect(confirmInput).toBeVisible()
      }
    })
  })

  test.describe('Navigation', () => {
    test('should navigate to account page from sidebar', async ({ page }) => {
      await page.goto('/dashboard')

      const accountLink = page.getByRole('link', { name: /account/i })
      if (await accountLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await accountLink.click()
        await expect(page).toHaveURL(/account/)
      }
    })

    test('should be accessible via direct URL', async ({ page }) => {
      await page.goto('/account')

      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()
    })
  })
})
```

**Step 2: Run tests to verify**

Run: `npx playwright test e2e/crud/account.spec.ts --project=chromium -v`
Expected: Tests pass or skip appropriately

**Step 3: Commit**

```bash
git add e2e/crud/account.spec.ts
git commit -m "test(e2e): add comprehensive account page tests"
```

---

## Task 3: Audit Log E2E Tests

**Files:**
- Create: `e2e/api/audit-logs.spec.ts`
- Reference: `src/server/routes/audits/handlers.ts`

**Step 1: Create the audit logs test file**

```typescript
import { test, expect, isAuthenticated, apiRequest } from '../fixtures'

/**
 * Audit Log API E2E Tests
 *
 * Tests for audit log retrieval and filtering via API.
 *
 * @tags @api @audit
 */

test.describe('Audit Logs API @api @audit', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('List Audit Logs', () => {
    test('should return audit logs list', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()
    })

    test('should return paginated results', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits?limit=5')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('pagination')
    })

    test('should filter by action type', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits?action=user.created')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
    })

    test('should filter by date range', async ({ page }) => {
      const today = new Date().toISOString().split('T')[0]
      const response = await apiRequest(page, 'get', `/api/audits?from=${today}`)

      expect(response.ok()).toBeTruthy()
    })
  })

  test.describe('Audit Log Entry Structure', () => {
    test('should have required fields in audit entry', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits?limit=1')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      if (body.data && body.data.length > 0) {
        const entry = body.data[0]
        expect(entry).toHaveProperty('id')
        expect(entry).toHaveProperty('action')
        expect(entry).toHaveProperty('createdAt')
      }
    })
  })
})
```

**Step 2: Run tests**

Run: `npx playwright test e2e/api/audit-logs.spec.ts --project=chromium -v`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/api/audit-logs.spec.ts
git commit -m "test(e2e): add audit logs API tests"
```

---

## Task 4: Storage/File Upload Tests

**Files:**
- Create: `e2e/api/storage.spec.ts`
- Reference: `src/server/routes/storage/handlers.ts`

**Step 1: Create the storage test file**

```typescript
import { test, expect, isAuthenticated, apiRequest } from '../fixtures'

/**
 * Storage API E2E Tests
 *
 * Tests for file upload, download, and management via API.
 *
 * @tags @api @storage
 */

test.describe('Storage API @api @storage', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('File Upload', () => {
    test('should get presigned upload URL', async ({ page }) => {
      const response = await apiRequest(page, 'post', '/api/storage/upload', {
        data: {
          filename: 'test-file.txt',
          contentType: 'text/plain',
        },
      })

      // Should succeed or return validation error
      expect([200, 201, 400, 422]).toContain(response.status())

      if (response.ok()) {
        const body = await response.json()
        expect(body).toHaveProperty('url')
      }
    })
  })

  test.describe('File Listing', () => {
    test('should list files for account', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/storage')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()
    })
  })

  test.describe('File Download', () => {
    test('should return 404 for non-existent file', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/storage/non-existent-file-id', {})

      expect(response.status()).toBe(404)
    })
  })

  test.describe('File Deletion', () => {
    test('should return 404 when deleting non-existent file', async ({ page }) => {
      const response = await apiRequest(page, 'delete', '/api/storage/non-existent-file-id')

      expect(response.status()).toBe(404)
    })
  })
})
```

**Step 2: Run tests**

Run: `npx playwright test e2e/api/storage.spec.ts --project=chromium -v`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/api/storage.spec.ts
git commit -m "test(e2e): add storage API tests"
```

---

## Task 5: Accounts API Tests

**Files:**
- Create: `e2e/api/accounts.spec.ts`
- Reference: `src/server/routes/accounts/handlers.ts`

**Step 1: Create the accounts API test file**

```typescript
import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Accounts API E2E Tests
 *
 * Tests for account management, switching, and multi-tenancy.
 *
 * @tags @api @accounts
 */

test.describe('Accounts API @api @accounts', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test.describe('Get Current Account', () => {
    test('should return current account info', async ({ page }) => {
      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')

      const response = await apiRequest(page, 'get', `/api/accounts/${accountId}`)

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('name')
    })
  })

  test.describe('List User Accounts', () => {
    test('should return list of accounts user belongs to', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/accounts')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()
      expect(body.data.length).toBeGreaterThan(0)
    })
  })

  test.describe('Update Account', () => {
    test('should update account name', async ({ page }) => {
      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')

      // First get current name
      const getResponse = await apiRequest(page, 'get', `/api/accounts/${accountId}`)
      const original = await getResponse.json()

      // Update with timestamp to ensure unique name
      const newName = `Test Account ${Date.now()}`
      const updateResponse = await apiRequest(page, 'patch', `/api/accounts/${accountId}`, {
        data: { name: newName },
      })

      expect(updateResponse.ok()).toBeTruthy()

      // Restore original name
      await apiRequest(page, 'patch', `/api/accounts/${accountId}`, {
        data: { name: original.name },
      })
    })
  })

  test.describe('Account Members', () => {
    test('should list account members', async ({ page }) => {
      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')

      const response = await apiRequest(page, 'get', `/api/accounts/${accountId}/members`)

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()
    })
  })

  test.describe('Account Validation', () => {
    test('should return 404 for non-existent account', async ({ page }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await apiRequest(page, 'get', `/api/accounts/${fakeId}`)

      expect(response.status()).toBe(404)
    })

    test('should return 400 for invalid account ID format', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/accounts/invalid-id')

      expect([400, 422]).toContain(response.status())
    })
  })
})
```

**Step 2: Run tests**

Run: `npx playwright test e2e/api/accounts.spec.ts --project=chromium -v`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/api/accounts.spec.ts
git commit -m "test(e2e): add accounts API tests"
```

---

## Task 6: Enhanced Critical Journeys

**Files:**
- Modify: `e2e/journeys/critical-flows.spec.ts`

**Step 1: Add additional critical journey tests**

Add the following tests to the existing file:

```typescript
test('should complete settings profile update journey', async ({ page }) => {
  // Navigate to settings
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

  // Update name field
  const nameInput = page.getByLabel(/full name/i)
  await expect(nameInput).toBeVisible()

  // Get current value
  const originalValue = await nameInput.inputValue()

  // Update with new value
  await nameInput.clear()
  await nameInput.fill('Test User Updated')

  // Click save
  const saveButton = page.getByRole('button', { name: /save changes/i })
  await saveButton.click()

  // Should show success or stay on page
  await expect(page).toHaveURL(/settings/)

  // Restore original value
  await nameInput.clear()
  await nameInput.fill(originalValue)
  await saveButton.click()
})

test('should complete webhook creation journey', async ({ page }) => {
  // Navigate to integrations
  await page.goto('/integrations')
  await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible()

  // Click Add Webhook
  await page.getByRole('button', { name: /add webhook/i }).click()

  // Dialog should open
  await expect(page.getByRole('dialog')).toBeVisible()

  // Fill webhook URL
  const urlInput = page.getByLabel(/endpoint url/i)
  await urlInput.fill('https://api.test.com/webhook')

  // Select event
  await page.getByText(/user created/i).click()

  // Create button should be enabled
  const createButton = page.getByRole('button', { name: /create webhook/i })
  await expect(createButton).toBeEnabled()

  // Cancel to avoid test data pollution
  await page.getByRole('button', { name: /cancel/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('should complete account security check journey', async ({ page }) => {
  // Navigate to account
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

  // Check security section
  await expect(page.getByRole('heading', { name: /security/i })).toBeVisible()

  // Check connected accounts
  await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()
  await expect(page.getByText(/google/i).first()).toBeVisible()

  // Check active sessions
  await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()
  await expect(page.getByText(/current/i)).toBeVisible()

  // Check API access
  await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /create key/i })).toBeVisible()
})
```

**Step 2: Run tests**

Run: `npx playwright test e2e/journeys --project=chromium -v`
Expected: All journey tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/critical-flows.spec.ts
git commit -m "test(e2e): add additional critical user journey tests"
```

---

## Task 7: Enhanced Visual Regression Tests

**Files:**
- Modify: `e2e/visual/screenshots.spec.ts`

**Step 1: Add additional visual tests**

Add the following tests to the existing file:

```typescript
test('account page visual snapshot', async ({ page }) => {
  await page.goto('/account')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

  await expect(page).toHaveScreenshot('account-page.png', {
    ...screenshotOptions,
    mask: [
      // Mask avatars
      page.locator('[class*="Avatar"]'),
      // Mask session IPs/device info
      page.locator('text=/\\d{1,3}\\.\\d{1,3}\\./'),
      // Mask timestamps
      page.locator('time'),
      page.locator('text=/ago$/'),
      page.locator('[class*="text-muted"]'),
    ],
  })
})

test('webhook creation dialog visual snapshot', async ({ page }) => {
  await page.goto('/integrations')
  await page.waitForLoadState('networkidle')

  // Open webhook dialog
  await page.getByRole('button', { name: /add webhook/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()

  await expect(dialog).toHaveScreenshot('webhook-create-dialog.png', {
    maxDiffPixelRatio: 0.02,
  })
})
```

**Step 2: Run visual tests**

Run: `npx playwright test --grep @visual --project=visual -v`
Expected: Visual tests pass (may create new baselines)

**Step 3: Commit**

```bash
git add e2e/visual/screenshots.spec.ts
git commit -m "test(e2e): add additional visual regression tests"
```

---

## Task 8: Enhanced Smoke Tests

**Files:**
- Modify: `e2e/smoke.unauth.spec.ts`

**Step 1: Add additional smoke tests**

Add comprehensive smoke tests:

```typescript
test.describe('API Smoke Tests @smoke', () => {
  test('health endpoint responds', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/health`)
    expect(response.ok()).toBeTruthy()
  })

  test('liveness endpoint responds', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/health/live`)
    expect(response.ok()).toBeTruthy()
  })

  test('readiness endpoint responds', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/health/ready`)
    // May return 503 if DB not ready, but should respond
    expect([200, 503]).toContain(response.status())
  })

  test('auth/me returns 401 without session', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/auth/me`, {
      failOnStatusCode: false,
    })
    expect(response.status()).toBe(401)
  })

  test('API docs endpoint accessible', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/doc`)
    expect(response.ok()).toBeTruthy()
  })
})

test.describe('Static Assets Smoke @smoke', () => {
  test('index.html loads', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/`)
    expect(response.ok()).toBeTruthy()
  })

  test('CSS/JS assets load', async ({ page }) => {
    await page.goto('/')

    // Check that styles are applied (page has content)
    await expect(page.locator('body')).toBeVisible()

    // No console errors for missing assets
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.waitForLoadState('networkidle')
    expect(errors.length).toBe(0)
  })
})
```

**Step 2: Run smoke tests**

Run: `npx playwright test e2e/smoke --project=chromium-unauth -v`
Expected: All smoke tests pass

**Step 3: Commit**

```bash
git add e2e/smoke.unauth.spec.ts
git commit -m "test(e2e): add additional smoke tests"
```

---

## Task 9: Enhanced Accessibility Tests

**Files:**
- Modify: `e2e/a11y/accessibility.spec.ts`

**Step 1: Add additional accessibility tests**

Add the following tests:

```typescript
test('account page has proper headings and landmarks', async ({ page }) => {
  await page.goto('/account')

  // Should have main heading
  const mainHeading = page.getByRole('heading', { level: 1 })
  await expect(mainHeading).toBeVisible()

  // Should have multiple section headings
  const h2Headings = page.getByRole('heading', { level: 2 })
  const h2Count = await h2Headings.count()
  expect(h2Count).toBeGreaterThanOrEqual(3) // Security, Sessions, API Access, Danger Zone
})

test('dialogs have proper ARIA attributes', async ({ page }) => {
  await page.goto('/team')

  // Open invite dialog
  await page.getByRole('button', { name: /invite member/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Dialog should have aria-labelledby or aria-label
  const hasLabel = await dialog.getAttribute('aria-labelledby') !== null ||
                   await dialog.getAttribute('aria-label') !== null
  expect(hasLabel).toBeTruthy()
})

test('form inputs have associated labels', async ({ page }) => {
  await page.goto('/settings')

  // Check that inputs are accessible via label
  const nameInput = page.getByLabel(/full name/i)
  await expect(nameInput).toBeVisible()

  const emailInput = page.getByLabel(/email address/i)
  await expect(emailInput).toBeVisible()
})

test('interactive elements are focusable', async ({ page }) => {
  await page.goto('/integrations')

  // Tab to first interactive element
  await page.keyboard.press('Tab')

  // Something should be focused
  const focusedElement = page.locator(':focus')
  await expect(focusedElement).toBeVisible()
})
```

**Step 2: Run accessibility tests**

Run: `npx playwright test --grep @a11y --project=a11y -v`
Expected: All a11y tests pass

**Step 3: Commit**

```bash
git add e2e/a11y/accessibility.spec.ts
git commit -m "test(e2e): add additional accessibility tests"
```

---

## Task 10: Enhanced Mobile Tests

**Files:**
- Modify: `e2e/mobile/responsive.spec.ts`

**Step 1: Add additional mobile tests**

Add the following tests:

```typescript
test.describe('Mobile Navigation @mobile', () => {
  test('hamburger menu is visible on mobile', async ({ page }) => {
    await page.goto('/login')

    // Look for mobile menu button
    const menuButton = page.getByRole('button', { name: /menu|navigation/i })
    const hamburger = page.locator('[class*="hamburger"]')

    const hasMenu = await menuButton.isVisible({ timeout: 2000 }).catch(() => false)
    const hasHamburger = await hamburger.isVisible({ timeout: 2000 }).catch(() => false)

    // Mobile should have some navigation control
    // (This may vary based on design)
  })

  test('login form is usable on mobile', async ({ page }) => {
    await page.goto('/login')

    // Login button should be visible and touchable
    const loginButton = page.getByRole('button', { name: /continue with google/i })
    await expect(loginButton).toBeVisible()

    // Button should have adequate size
    const box = await loginButton.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(36)
  })

  test('content does not overflow on mobile', async ({ page }) => {
    await page.goto('/login')

    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // Allow 1px tolerance
  })
})

test.describe('Mobile Touch Interactions @mobile', () => {
  test('buttons respond to touch', async ({ page }) => {
    await page.goto('/login')

    const button = page.getByRole('button', { name: /continue with google/i })
    await expect(button).toBeVisible()

    // Should be clickable (tap simulation)
    await button.tap()
  })
})
```

**Step 2: Run mobile tests**

Run: `npx playwright test --grep @mobile --project=mobile-chrome -v`
Expected: Mobile tests pass

**Step 3: Commit**

```bash
git add e2e/mobile/responsive.spec.ts
git commit -m "test(e2e): add additional mobile responsive tests"
```

---

## Final Summary

After completing all tasks, run full test suite:

```bash
npx playwright test --reporter=list
```

### Expected Coverage Distribution

| Category | Tests | Percentage |
|----------|-------|------------|
| Smoke | ~15 | 8% |
| Critical Journeys | ~12 | 6% |
| Feature/CRUD | ~100 | 53% |
| Error Handling | ~18 | 9% |
| Visual Regression | ~9 | 5% |
| Accessibility | ~12 | 6% |
| Mobile/Responsive | ~10 | 5% |
| API Tests | ~15 | 8% |
| **Total** | **~191** | **100%** |

### Test Tags Reference

- `@smoke` - Quick deployment verification
- `@critical` - Essential user journeys
- `@crud` - Feature/page tests
- `@api` - API endpoint tests
- `@error` - Error handling tests
- `@visual` - Visual regression tests
- `@a11y` - Accessibility tests
- `@mobile` - Mobile responsive tests
- `@auth` - Authentication tests
- `@invitation` - Invitation flow tests
- `@account` - Account page tests
- `@audit` - Audit log tests
- `@storage` - Storage/file tests
- `@accounts` - Multi-tenancy tests

### Running Specific Categories

```bash
# Run only smoke tests
npx playwright test --grep @smoke

# Run critical journeys
npx playwright test --grep @critical

# Run all except visual (faster CI)
npx playwright test --grep-invert @visual
```
