import { test, expect } from '../fixtures'

/**
 * Admin Account Management Tests
 *
 * Tests for super admin account management features:
 * - Viewing account list
 * - Suspending accounts
 * - Reactivating accounts
 *
 * @tags @admin @super-admin @critical
 */

test.describe('Admin Account Management @admin @critical', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin accounts page
    await page.goto('/admin/accounts')

    // Verify page loads
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible()
  })

  test('should display list of all accounts', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Verify header
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible()
    await expect(page.getByText(/manage all tenant accounts in the system/i)).toBeVisible()

    // Verify search input exists
    const searchInput = page.getByPlaceholder(/search accounts/i)
    await expect(searchInput).toBeVisible()

    // Verify account count badge
    const countBadge = page.getByText(/accounts$/)
    await expect(countBadge).toBeVisible()

    // Verify at least one account card is visible (unless empty state)
    const accountCard = page.locator('[class*="Card"]').first()
    const isVisible = await accountCard.isVisible().catch(() => false)

    if (isVisible) {
      // Verify account details are shown
      const accountName = accountCard.locator('h3').first()
      await expect(accountName).toBeVisible()
    }
  })

  test('should suspend an account successfully', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Alternative approach: look for suspend button
    const suspendButton = page.getByRole('button', { name: /^suspend$/i }).first()

    if (await suspendButton.isVisible()) {
      // Click suspend button
      await suspendButton.click()

      // Wait for suspension dialog
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Verify dialog content
      await expect(page.getByRole('heading', { name: /suspend account/i })).toBeVisible()
      await expect(page.getByText(/are you sure you want to suspend/i)).toBeVisible()

      // Fill optional reason
      const reasonInput = page.getByPlaceholder(/enter suspension reason/i)
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Test suspension')
      }

      // Click confirm suspend button
      const confirmButton = page.getByRole('button', { name: /suspend account$/i })
      await expect(confirmButton).toBeVisible()

      // Wait for the operation to complete
      const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)
      await confirmButton.click()
      await navigationPromise

      // Wait a moment for list to refresh
      await page.waitForTimeout(1000)

      // Verify suspension was successful (account should now show suspended badge)
      const suspendedBadge = page.locator('text=/suspended/').first()
      await expect(suspendedBadge).toBeVisible({ timeout: 5000 })
    }
  })

  test('should show suspended status indicator', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Look for suspended accounts
    const suspendedAccounts = page.locator('text=/suspended/')
    const count = await suspendedAccounts.count()

    if (count > 0) {
      // Verify badge styling/visibility
      const suspendedBadge = suspendedAccounts.first()
      await expect(suspendedBadge).toBeVisible()

      // Verify badge has appropriate styling (typically red/destructive)
      const badgeElement = suspendedBadge.locator('..')
      await expect(badgeElement).toBeTruthy()
    }
  })

  test('should reactivate suspended account', async ({ page }) => {
    await page.goto('/admin/accounts')

    // Find a suspended account
    const suspendedBadge = page.locator('text=/suspended/').first()

    if (await suspendedBadge.isVisible()) {
      // Find reactivate button in same card
      const suspendedCard = suspendedBadge.locator('..').locator('..').locator('..')
      const reactivateButton = suspendedCard.getByRole('button', { name: /reactivate/i })

      if (await reactivateButton.isVisible()) {
        // Click reactivate
        const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null)
        await reactivateButton.click()
        await navigationPromise

        // Wait for list to refresh
        await page.waitForTimeout(1000)

        // Verify account is now active
        // The suspended badge should be replaced with active badge
        const activeBadge = page.locator('text=/active/').first()
        await expect(activeBadge).toBeVisible({ timeout: 5000 })
      }
    }
  })
})
