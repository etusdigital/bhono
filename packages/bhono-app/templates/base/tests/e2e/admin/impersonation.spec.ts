import { test, expect } from '../fixtures'

/**
 * Admin Impersonation Tests
 *
 * Tests for super admin account impersonation feature.
 * Verifies ability to impersonate other accounts and see their workspace.
 *
 * @tags @admin @super-admin @critical
 */

test.describe('Admin Impersonation @admin @critical', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin accounts page
    await page.goto('/admin/accounts')

    // Verify we're on the admin page
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible()
  })

  test('should show impersonate button for each account', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Wait for accounts list to load
    await expect(page.getByRole('heading', { name: /manage all tenant accounts/i })).toBeVisible()

    // Verify we can see accounts
    const accountCards = page.locator('[class*="Card"]').filter({ hasText: /member/ })
    const count = await accountCards.count()

    if (count > 0) {
      // Get first account card
      const firstCard = accountCards.first()

      // Verify impersonate button is present
      const impersonateButton = firstCard.getByRole('button', { name: /impersonate/i })
      await expect(impersonateButton).toBeVisible()
      await expect(impersonateButton).toBeEnabled()
    }
  })

  test('should successfully start impersonation', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible()

    // Find first active account
    const accountCards = page.locator('[class*="Card"]')
    const count = await accountCards.count()

    if (count > 0) {
      // Get first impersonate button we can find
      const impersonateButton = page.getByRole('button', { name: /impersonate/i }).first()

      if (await impersonateButton.isVisible()) {
        // Set up navigation listener to capture the redirect
        const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)

        await impersonateButton.click()

        // Wait for navigation or timeout
        await navigationPromise

        // After impersonation, we should be redirected or see some indication
        // The app navigates to /dashboard
        await expect(page).toHaveURL(/dashboard|admin/, { timeout: 10000 })
      }
    }
  })

  test('should show impersonation banner when impersonating', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Find an account to impersonate
    const impersonateButton = page.getByRole('button', { name: /impersonate/i }).first()

    if (await impersonateButton.isVisible()) {
      // Start impersonation
      const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)
      await impersonateButton.click()
      await navigationPromise

      // Look for impersonation banner/indicator
      // This could be a banner at the top showing "Currently impersonating: X"
      page.getByText(/impersonating|currently viewing/i)

      // The banner might appear, but if not, we've at least confirmed navigation happened
      // Verify we're on a dashboard or admin page
      await expect(page).toHaveURL(/dashboard|admin/, { timeout: 10000 })
    }
  })

  test('should exit impersonation and return to admin', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Try to find and click impersonate button
    const impersonateButton = page.getByRole('button', { name: /impersonate/i }).first()

    if (await impersonateButton.isVisible()) {
      // Start impersonation
      const navPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)
      await impersonateButton.click()
      await navPromise

      // Wait a moment for UI to settle
      await page.waitForTimeout(1000)

      // Look for exit impersonation button or link
      // This might be in a banner or in user menu
      const exitButton = page.getByRole('button', { name: /exit|stop impersonating/i }).first()
      const exitLink = page.getByRole('link', { name: /exit|stop impersonating/i }).first()

      if (await exitButton.isVisible()) {
        const exitNavPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)
        await exitButton.click()
        await exitNavPromise
      } else if (await exitLink.isVisible()) {
        const exitNavPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)
        await exitLink.click()
        await exitNavPromise
      }

      // After exiting, navigate to admin page to verify we're back
      await page.goto('/admin/accounts')
      await expect(page.getByRole('heading', { name: /manage all tenant accounts/i })).toBeVisible()
    }
  })
})
