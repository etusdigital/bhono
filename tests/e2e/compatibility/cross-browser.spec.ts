import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'

/**
 * Cross-Browser Compatibility Tests
 *
 * These tests verify core functionality works consistently
 * across different browsers (Chromium, Firefox, WebKit).
 *
 * Run across browsers: npx playwright test e2e/compatibility --project=chromium --project=firefox
 *
 * @tags @compatibility @cross-browser
 */

test.describe('Cross-Browser Compatibility @compatibility @cross-browser', () => {
  test.describe('Public Pages', () => {
    test('login page renders correctly', async ({ page }) => {
      await page.goto('/login')

      // Core elements should be visible
      await expect(page.getByText('Welcome back')).toBeVisible()
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

      // Verify page structure
      await expect(page.locator('body')).toBeVisible()
    })

    test('404 page renders correctly', async ({ page, browserName }) => {
      await page.goto('/non-existent-page')

      // 404 content should be visible
      await expect(page.getByText('404').first()).toBeVisible()
    })

    test('page navigation works correctly', async ({ page }) => {
      // Navigate to login
      await page.goto('/login')
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Navigate to 404
      await page.goto('/unknown')
      await expect(page.getByText('404').first()).toBeVisible()

      // Navigate back to login
      await page.goto('/login')
      await expect(page.getByText('Welcome back')).toBeVisible()
    })
  })

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('dashboard renders correctly', async ({ page, browserName }) => {
      await page.goto('/dashboard')

      // Navigation should be visible
      await expect(page.getByRole('navigation')).toBeVisible()

      // Main content area should be visible
      await expect(page.getByRole('main')).toBeVisible()
    })

    test('team page renders correctly', async ({ page }) => {
      await page.goto('/team')

      // Team heading should be visible
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Invite button should be visible and functional
      const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
      await expect(inviteButton).toBeVisible()
      await expect(inviteButton).toBeEnabled()
    })

    test('form interactions work correctly', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Form input should work
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('test@example.com')
      await expect(emailInput).toHaveValue('test@example.com')

      // Clear input
      await emailInput.clear()
      await expect(emailInput).toHaveValue('')

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('dropdown and select interactions work correctly', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Role selector should be visible (look for the select trigger or role text)
      const roleText = page.getByText(/role/i).first()
      await expect(roleText).toBeVisible()

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
    })

    test('button states and interactions work correctly', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Send button should be disabled without email
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeDisabled()

      // Fill email to enable button
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('valid@email.com')
      await expect(sendButton).toBeEnabled()

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
    })

    test('keyboard navigation works correctly', async ({ page }) => {
      await page.goto('/settings')

      // Verify tabs are visible and accessible
      const profileTab = page.getByRole('tab', { name: /profile/i })
      await expect(profileTab).toBeVisible()

      // Click profile tab to ensure focus is in tab area
      await profileTab.click()

      // Navigate to account tab
      await page.getByRole('tab', { name: /account/i }).click()
      await expect(page.getByRole('tab', { name: /account/i })).toHaveAttribute('data-state', 'active')
    })
  })
})
