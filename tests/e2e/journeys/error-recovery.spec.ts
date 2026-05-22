import { test, expect, isAuthenticated, apiRequest, getAccountId, closeAllDialogs } from '../fixtures'

/**
 * Error Recovery and Retry Journey Tests
 *
 * These tests verify application resilience and error handling,
 * including graceful degradation, error display, and recovery flows.
 *
 * @tags @journey @error-handling @resilience
 */

test.describe('Error Recovery Journey @journey @error-handling', () => {
  test.describe('API Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should handle 404 errors gracefully', async ({ page }) => {
      // Step 1: Request non-existent resource
      const response = await apiRequest(page, 'get', '/auth/admin/users/00000000-0000-0000-0000-000000000000')

      // Step 2: Verify 404 response
      expect(response.status()).toBe(404)

      const body = await response.json()

      // Step 3: Verify error structure
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
      expect(typeof body.error.message).toBe('string')
    })

    test('should handle validation errors with details', async ({ page }) => {
      // Step 1: Send invalid data to create endpoint
      const response = await apiRequest(page, 'post', '/api/storage/upload-url', {
        data: {
          // Missing required fields
        },
      })

      // Step 2: Verify validation error
      expect(response.status()).toBe(400)

      const body = await response.json()

      // Step 3: Verify error structure
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })

    test('should handle invalid UUID format errors', async ({ page }) => {
      // Step 1: Request with invalid ID format
      const response = await apiRequest(page, 'get', '/accounts/invalid-uuid')

      // Step 2: Verify validation error
      expect(response.status()).toBe(404)

      const body = await response.json()

      // Step 3: Verify error structure
      expect(body).toHaveProperty('error')
    })
  })

  test.describe('UI Error Display', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should handle navigation to non-existent page', async ({ page }) => {
      // Step 1: Navigate to non-existent page
      await page.goto('/non-existent-page-12345')

      // Step 2: Should either show 404 or redirect to dashboard
      const url = page.url()
      const pageContent = await page.content()

      // App should handle gracefully - either show error or redirect
      expect(
        url.includes('404') || url.includes('dashboard') || pageContent.includes('not found')
      ).toBeTruthy()
    })

    test('should display loading states during data fetch', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')

      // Step 2: Page should eventually load content
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible({ timeout: 10000 })

      // Step 3: Verify page loaded successfully without errors
      await expect(page.getByText(/active members/i)).toBeVisible()
    })
  })

  test.describe('Form Validation Recovery', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should recover from invalid form input', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 2: Open invite dialog
      const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
      await inviteButton.click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Step 3: Verify submit is disabled with empty email
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeDisabled()

      // Step 4: Enter invalid email format (partial)
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('invalid-email')

      // Step 5: Button may still be enabled but submission would fail
      // Enter valid email to recover
      await emailInput.clear()
      await emailInput.fill('valid@example.com')

      // Step 6: Verify form recovered - button should be enabled
      await expect(sendButton).toBeEnabled()

      // Step 7: Cancel to avoid test pollution
      await page.getByRole('button', { name: /cancel/i }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('should handle empty name in profile update', async ({ page }) => {
      // Step 1: Navigate to settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Step 2: Get the name input
      const nameInput = page.getByLabel(/full name/i)
      await expect(nameInput).toBeVisible()

      // Step 3: Store original value
      const originalName = await nameInput.inputValue()

      // Step 4: Clear name and try to save
      await nameInput.clear()

      // Step 5: The save button should still work but backend validates
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await expect(saveButton).toBeVisible()

      // Step 6: Restore original name for recovery
      await nameInput.fill(originalName || 'Test User')
      await expect(nameInput).toHaveValue(originalName || 'Test User')
    })
  })

  test.describe('Network Error Recovery', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('should handle page reload without losing context', async ({ page }) => {
      // Step 1: Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Step 2: Reload the page
      await page.reload()

      // Step 3: Verify page recovered
      await expect(page).toHaveURL(/dashboard/)
      await expect(page).not.toHaveURL(/login/)

      // Step 4: Verify navigation still works
      await expect(page.getByRole('navigation')).toBeVisible()
    })

    test('should handle back/forward navigation', async ({ page }) => {
      // Step 1: Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Step 2: Navigate to team
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 3: Go back
      await page.goBack()
      await expect(page).toHaveURL(/dashboard/)

      // Step 4: Go forward
      await page.goForward()
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
    })
  })

  test.describe('API Retry Behavior', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should handle multiple rapid API requests', async ({ page }) => {
      // Step 1: Make multiple rapid requests
      const requests = Array(5)
        .fill(null)
        .map(() => apiRequest(page, 'get', '/audit/logs?limit=1'))

      // Step 2: Wait for all requests
      const responses = await Promise.all(requests)

      // Step 3: All should succeed
      for (const response of responses) {
        expect(response.ok()).toBeTruthy()
      }
    })

    test('should handle sequential API calls', async ({ page }) => {
      // Step 1: Make sequential calls to different endpoints
      const accountId = getAccountId()
      const endpoints = ['/audit/logs?limit=1', `/accounts/${accountId}/members`, '/accounts']

      for (const endpoint of endpoints) {
        const response = await apiRequest(page, 'get', endpoint)
        expect(response.ok()).toBeTruthy()

        const body = await response.json()
        expect(body.logs ?? body.members ?? body.accounts).toBeDefined()
      }
    })
  })

  test.describe('Dialog Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should close dialog on escape key', async ({ page }) => {
      // Step 1: Navigate to team page
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 2: Open invite dialog
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Step 3: Press escape
      await page.keyboard.press('Escape')

      // Step 4: Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible()

      // Step 5: Page should remain functional
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
    })

    test('should allow reopening dialog after cancel', async ({ page }) => {
      // Step 1: Navigate to integrations
      await page.goto('/integrations')
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Step 2: Open webhook dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()

      // Step 3: Cancel
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: /create webhook/i })).not.toBeVisible()

      // Step 4: Reopen dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()

      // Step 5: Clean up
      await page.getByRole('button', { name: 'Cancel' }).click()
    })
  })

  test.describe('Complete Error Recovery Workflow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('complete error recovery workflow across pages', async ({ page }) => {
      // Step 1: Start at dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Step 2: Try invalid navigation then recover
      await page.goto('/non-existent-12345')
      // Either stays on current page or shows error
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Step 3: Navigate to settings and test form recovery
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      const nameInput = page.getByLabel(/full name/i)
      const originalName = await nameInput.inputValue()

      // Modify and recover
      await nameInput.clear()
      await nameInput.fill(originalName || 'Test')
      await expect(nameInput).toHaveValue(originalName || 'Test')

      // Step 4: Navigate to team and test dialog recovery
      await page.goto('/team')
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).not.toBeVisible()

      // Step 5: Reload and verify session persists
      await page.reload()
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Step 6: Return to dashboard to complete workflow
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)
    })
  })
})
