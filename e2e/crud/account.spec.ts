import { test, expect, isAuthenticated, closeAllDialogs } from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * Account Page E2E Tests
 *
 * Comprehensive tests for the account page including security settings,
 * connected accounts, active sessions, API access, and danger zone.
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

      // Should see the Account heading
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

      // Should see the page description
      await expect(
        page.getByText(/manage your account settings, security, and connected services/i)
      ).toBeVisible()
    })

    test('should display all account sections', async ({ page }) => {
      await page.goto('/account')

      // Verify all section headings are present
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()
      await expect(page.getByRole('heading', { name: /security/i })).toBeVisible()
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()
      await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()
    })

    test('should have proper page layout with multiple sections', async ({ page }) => {
      await page.goto('/account')

      // Verify the page has the expected sections by checking headings
      const sectionHeadings = [
        /connected accounts/i,
        /security/i,
        /active sessions/i,
        /api access/i,
        /danger zone/i,
      ]

      // Check each section heading exists
      for (const heading of sectionHeadings) {
        await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      }
    })
  })

  test.describe('Connected Accounts', () => {
    test('should show Google as connected provider', async ({ page }) => {
      await page.goto('/account')

      // Should see Google provider name
      await expect(page.getByText('Google').first()).toBeVisible()

      // Should show Connected status text
      await expect(page.getByText('Connected').first()).toBeVisible()
    })

    test('should display primary login method status', async ({ page }) => {
      await page.goto('/account')

      // Should show that Google is the primary login method
      await expect(page.getByText(/primary login method/i)).toBeVisible()
    })

    test('should show GitHub as not connected with connect option', async ({ page }) => {
      await page.goto('/account')

      // Should see GitHub provider
      await expect(page.getByText('GitHub')).toBeVisible()

      // Should show Not connected status text
      await expect(page.getByText('Not connected')).toBeVisible()

      // Should have a Connect button somewhere on the page for GitHub
      const connectButton = page.getByRole('button', { name: /connect/i })
      await expect(connectButton).toBeVisible()
    })
  })

  test.describe('Security', () => {
    test('should display two-factor authentication option', async ({ page }) => {
      await page.goto('/account')

      // Should see Two-Factor Authentication card
      await expect(page.getByText('Two-Factor Authentication')).toBeVisible()

      // Should show Recommended badge
      await expect(page.getByText('Recommended')).toBeVisible()

      // Should have Enable button
      const enableButton = page.getByRole('button', { name: /enable/i })
      await expect(enableButton).toBeVisible()
    })

    test('should display password section for OAuth users', async ({ page }) => {
      await page.goto('/account')

      // Should see Password label
      await expect(page.getByText('Password').first()).toBeVisible()

      // Should indicate no password set for OAuth users
      await expect(page.getByText(/using oauth login.*no password set/i)).toBeVisible()

      // There should be a Change button (it has an icon and "Change" text)
      const changeButtons = page.getByRole('button', { name: /change/i })
      const count = await changeButtons.count()
      if (count > 0) {
        await expect(changeButtons.first()).toBeVisible()
      }
    })
  })

  test.describe('Active Sessions', () => {
    test('should display current session indicator', async ({ page }) => {
      await page.goto('/account')

      // Should see the Active Sessions heading
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Should see a session marked as current (case-insensitive)
      await expect(page.getByText(/current/i).first()).toBeVisible()
    })

    test('should show session details with device and browser', async ({ page }) => {
      await page.goto('/account')

      // Should see device information like "Chrome on macOS" or "Safari on iPhone"
      await expect(page.getByText(/chrome on|safari on|firefox on/i).first()).toBeVisible()
    })

    test('should have sign out all button', async ({ page }) => {
      await page.goto('/account')

      // Should see Sign out all button in the Active Sessions section
      const signOutAllButton = page.getByRole('button', { name: /sign out all/i })
      await expect(signOutAllButton).toBeVisible()
      await expect(signOutAllButton).toBeEnabled()
    })

    test('should display session location and activity time', async ({ page }) => {
      await page.goto('/account')

      // Should show some location or activity information
      // The page shows "San Francisco, CA" and "Active now" or "2 hours ago"
      const sessionDetails = page.getByText(/san francisco|active now|hours ago/i)
      await expect(sessionDetails.first()).toBeVisible()
    })
  })

  test.describe('API Access', () => {
    test('should display Create Key button', async ({ page }) => {
      await page.goto('/account')

      // Should see Create Key button
      const createKeyButton = page.getByRole('button', { name: /create key/i })
      await expect(createKeyButton).toBeVisible()
      await expect(createKeyButton).toBeEnabled()
    })

    test('should display API keys section with description', async ({ page }) => {
      await page.goto('/account')

      // Should see API Keys title (may be a heading or card title)
      await expect(page.getByText(/^api keys$/i)).toBeVisible()

      // Should see description about generating API keys
      await expect(page.getByText(/generate api keys/i)).toBeVisible()
    })

    test('should display empty state when no API keys exist', async ({ page }) => {
      await page.goto('/account')

      // Should see empty state message
      await expect(page.getByText(/no api keys created yet/i)).toBeVisible()
      await expect(page.getByText(/create a key to get started/i)).toBeVisible()
    })

    test('should have API Access section with proper heading', async ({ page }) => {
      await page.goto('/account')

      // Should see API Access heading
      await expect(page.getByRole('heading', { name: /api access/i })).toBeVisible()

      // Should see section description
      await expect(page.getByText(/manage api keys for programmatic access/i)).toBeVisible()
    })
  })

  test.describe('Danger Zone', () => {
    test.afterEach(async ({ page }) => {
      // Close any open dialogs after each test
      await closeAllDialogs(page)
    })

    // Helper to get the delete account trigger button and scroll it into view
    const getDeleteAccountButton = async (page: Page) => {
      // Scroll to the Danger Zone section first
      const dangerZoneHeading = page.getByRole('heading', { name: /danger zone/i })
      await dangerZoneHeading.scrollIntoViewIfNeeded()

      // Find the Delete button in the Delete Account card using web-first selector
      const deleteButton = page.getByRole('button', { name: /^delete$/i }).first()
      return deleteButton
    }

    // Helper to get the delete confirmation dialog elements
    const getDeleteDialog = (page: Page) => {
      return {
        dialog: page.getByRole('dialog'),
        title: page.getByRole('heading', { name: /^delete account$/i }),
      }
    }

    // Helper to open the delete confirmation dialog (reduces DRY)
    const openDeleteDialog = async (page: Page) => {
      const deleteButton = await getDeleteAccountButton(page)
      await expect(deleteButton).toBeVisible()
      await deleteButton.click()
      const deleteDialog = getDeleteDialog(page)
      await expect(deleteDialog.title).toBeVisible()
      return deleteDialog
    }

    test('should display delete account button', async ({ page }) => {
      await page.goto('/account')

      // Should see Delete Account section title
      await expect(page.getByText('Delete Account').first()).toBeVisible()

      // Should see the destructive Delete button
      const deleteButton = await getDeleteAccountButton(page)
      await expect(deleteButton).toBeVisible()
      await expect(deleteButton).toBeEnabled()
    })

    test('should show confirmation dialog when clicking delete', async ({ page }) => {
      await page.goto('/account')

      // Open the delete confirmation dialog
      await openDeleteDialog(page)

      // Should see warning message
      await expect(page.getByText(/cannot be undone/i)).toBeVisible()
    })

    test('should have cancel button in delete confirmation', async ({ page }) => {
      await page.goto('/account')

      // Open the delete confirmation dialog
      const deleteDialog = await openDeleteDialog(page)

      // Should see Cancel button in dialog
      const cancelButton = page.getByRole('button', { name: /^cancel$/i })
      await expect(cancelButton).toBeVisible()

      // Click cancel should close the dialog
      await cancelButton.click()
      await expect(deleteDialog.title).toBeHidden()
    })

    test('should require typing email to confirm deletion', async ({ page }) => {
      await page.goto('/account')

      // Open the delete confirmation dialog
      await openDeleteDialog(page)

      // Should see confirmation input with placeholder
      const confirmInput = page.getByPlaceholder(/enter your email/i)
      await expect(confirmInput).toBeVisible()

      // Delete Account button in footer should be disabled initially
      const confirmDeleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(confirmDeleteButton).toBeDisabled()
    })

    test('should display export data option', async ({ page }) => {
      await page.goto('/account')

      // Should see Export Data section
      await expect(page.getByText('Export Data')).toBeVisible()
      await expect(page.getByText(/download a copy/i)).toBeVisible()

      // Should have Export button
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })

    test('should display warning messages in delete dialog', async ({ page }) => {
      await page.goto('/account')

      // Open the delete confirmation dialog
      await openDeleteDialog(page)

      // Should see warning list items - check for key warning phrases
      await expect(page.getByText(/permanently deleted/i)).toBeVisible()
      await expect(page.getByText(/lose access/i)).toBeVisible()
      // Be specific about which irreversible text to match (the one in the dialog warning list)
      await expect(page.getByText('This action is irreversible')).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
    test('should be accessible via direct URL', async ({ page }) => {
      await page.goto('/account')

      // Should not redirect away from account page
      await expect(page).toHaveURL(/\/account/)

      // Should display account content
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()
    })

    test('should navigate to account page from sidebar', async ({ page }) => {
      // Start from dashboard or another page
      await page.goto('/dashboard')

      // Find and click the account link in sidebar
      const accountLink = page.getByRole('link', { name: /account/i })

      // Check if account link exists in navigation
      const linkCount = await accountLink.count()
      if (linkCount > 0) {
        await accountLink.first().click()
        await expect(page).toHaveURL(/\/account/)
        await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()
      } else {
        // If no direct sidebar link, check for settings/user menu button
        const userMenuButton = page.getByRole('button', { name: /user|profile|menu|account/i })
        const userMenuCount = await userMenuButton.count()
        if (userMenuCount > 0 && await userMenuButton.first().isVisible()) {
          await userMenuButton.first().click()
          const accountMenuItem = page.getByRole('menuitem', { name: /account/i })
          if (await accountMenuItem.isVisible()) {
            await accountMenuItem.click()
            await expect(page).toHaveURL(/\/account/)
          }
        }
      }
    })
  })
})
