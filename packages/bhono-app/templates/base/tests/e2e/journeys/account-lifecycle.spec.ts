import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'

/**
 * Account Lifecycle Journey Tests
 *
 * These tests verify complete account management user flows,
 * including security settings, sessions, and account deletion.
 *
 * @tags @critical @journey @account
 */

test.describe('Account Lifecycle Journeys @critical @journey @account', () => {
  test.describe('Account Overview Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display account page with header', async ({ page }) => {
      await page.goto('/account')

      // Verify page loads with main heading
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Verify description
      await expect(page.getByText(/manage your account settings, security, and connected services/i)).toBeVisible()
    })

    test('should display connected accounts section', async ({ page }) => {
      await page.goto('/account')

      // Verify Connected Accounts heading
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/manage oauth providers linked to your account/i)).toBeVisible()

      // Verify Google is connected
      await expect(page.getByText('Google')).toBeVisible()
      await expect(page.locator('.text-xs').filter({ hasText: /connected/i }).first()).toBeVisible()

      // Verify GitHub option exists
      await expect(page.getByText('GitHub').first()).toBeVisible()
    })

    test('should display security section', async ({ page }) => {
      await page.goto('/account')

      // Verify Security heading
      await expect(page.getByRole('heading', { name: /^security$/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/keep your account secure with these settings/i)).toBeVisible()

      // Verify Two-Factor Authentication option
      await expect(page.getByText(/two-factor authentication/i)).toBeVisible()
      await expect(page.getByText(/recommended/i).first()).toBeVisible()

      // Verify Password option
      await expect(page.getByText('Password').first()).toBeVisible()
    })
  })

  test.describe('Security Settings Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display two-factor authentication option', async ({ page }) => {
      await page.goto('/account')

      // Verify Two-Factor Authentication card
      await expect(page.getByText(/two-factor authentication/i)).toBeVisible()
      await expect(page.getByText(/add an extra layer of security to your account/i)).toBeVisible()

      // Verify Enable button
      const enableButton = page.getByRole('button', { name: /enable/i })
      await expect(enableButton).toBeVisible()
      await expect(enableButton).toBeEnabled()
    })

    test('should display password option as disabled for OAuth users', async ({ page }) => {
      await page.goto('/account')

      // Verify Password option
      await expect(page.getByText('Password').first()).toBeVisible()
      await expect(page.getByText(/using oauth login - no password set/i)).toBeVisible()

      // Verify Change button is disabled
      const changeButton = page.getByRole('button', { name: /change/i })
      await expect(changeButton).toBeVisible()
      await expect(changeButton).toBeDisabled()
    })
  })

  test.describe('Active Sessions Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display active sessions section', async ({ page }) => {
      await page.goto('/account')

      // Verify Active Sessions heading
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/devices where you're currently logged in/i)).toBeVisible()

      // Verify Sign out all button
      const signOutAllButton = page.getByRole('button', { name: /sign out all/i })
      await expect(signOutAllButton).toBeVisible()
    })

    test('should display current session with badge', async ({ page }) => {
      await page.goto('/account')

      // Verify current session is marked
      await expect(page.getByText('Current', { exact: true })).toBeVisible()

      // Verify device info is shown
      await expect(page.getByText(/chrome on macos/i)).toBeVisible()
    })

    test('should display other sessions', async ({ page }) => {
      await page.goto('/account')

      // Verify other session is shown
      await expect(page.getByText(/safari on iphone/i)).toBeVisible()

      // Verify location and time info
      await expect(page.getByText(/san francisco, ca/i).first()).toBeVisible()
    })
  })

  test.describe('API Access Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display API access section', async ({ page }) => {
      await page.goto('/account')

      // Verify API Access heading
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/manage api keys for programmatic access/i)).toBeVisible()

      // Verify Create Key button
      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await expect(createKeyButton).toBeVisible()
      await expect(createKeyButton).toBeEnabled()
    })

    test('should display empty state for API keys', async ({ page }) => {
      await page.goto('/account')

      // Verify empty state message
      await expect(page.getByText(/no api keys created yet/i)).toBeVisible()
      await expect(page.getByText(/create a key to get started with the api/i)).toBeVisible()
    })
  })

  test.describe('Danger Zone Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display danger zone section', async ({ page }) => {
      await page.goto('/account')

      // Verify Danger Zone heading
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()

      // Verify description
      await expect(page.getByText(/irreversible and destructive actions/i)).toBeVisible()
    })

    test('should display export data option', async ({ page }) => {
      await page.goto('/account')

      // Verify Export Data option
      await expect(page.getByText('Export Data')).toBeVisible()
      await expect(page.getByText(/download a copy of all your data/i)).toBeVisible()

      // Verify Export button
      const exportButton = page.getByRole('button', { name: 'Export' })
      await expect(exportButton).toBeVisible()
      await expect(exportButton).toBeEnabled()
    })

    test('should display delete account option', async ({ page }) => {
      await page.goto('/account')

      // Verify Delete Account option
      await expect(page.getByText('Delete Account').first()).toBeVisible()
      await expect(page.getByText(/permanently delete your account and data/i)).toBeVisible()

      // Verify Delete button
      const deleteButton = page.getByRole('button', { name: 'Delete' }).first()
      await expect(deleteButton).toBeVisible()
    })

    test('should open delete account confirmation dialog', async ({ page }) => {
      await page.goto('/account')

      // Click Delete button
      const deleteButton = page.getByRole('button', { name: 'Delete' }).first()
      await deleteButton.click()

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: /delete account/i })).toBeVisible()

      // Verify warning message
      await expect(page.getByText(/this action cannot be undone/i)).toBeVisible()
      await expect(page.getByText(/all your data will be permanently deleted/i)).toBeVisible()
    })

    test('should require email confirmation for account deletion', async ({ page }) => {
      await page.goto('/account')

      // Open delete dialog
      await page.getByRole('button', { name: 'Delete' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Verify Delete Account button is disabled initially
      const confirmDeleteButton = page.getByRole('button', { name: 'Delete Account' })
      await expect(confirmDeleteButton).toBeDisabled()

      // Type incorrect email
      const confirmInput = page.getByPlaceholder(/enter your email/i)
      await confirmInput.fill('wrong@email.com')

      // Button should still be disabled
      await expect(confirmDeleteButton).toBeDisabled()
    })

    test('should cancel account deletion', async ({ page }) => {
      await page.goto('/account')

      // Open delete dialog
      await page.getByRole('button', { name: 'Delete' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click()

      // Verify dialog is closed
      await expect(page.getByRole('dialog')).not.toBeVisible()

      // Verify we're still on account page
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()
    })
  })

  test.describe('Account Navigation Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should navigate from account to other pages and back', async ({ page }) => {
      // Start at account
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Navigate to dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Return to account
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Navigate to settings
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Return to account
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()
    })
  })
})
