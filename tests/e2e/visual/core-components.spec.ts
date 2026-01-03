import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Visual Regression Tests - Core Components
 *
 * These tests capture screenshots of key pages and components
 * to detect visual regressions across releases.
 *
 * @tags @visual @regression
 */

test.describe('Visual Regression - Core Pages @visual @regression', () => {
  test.describe('Public Pages', () => {
    test('login page visual snapshot', async ({ page }) => {
      await page.goto('/login')

      // Wait for page to fully load
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('login-page.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05, // Allow 5% difference for font rendering
      })
    })
  })

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('dashboard page visual snapshot', async ({ page }) => {
      await page.goto('/dashboard')

      // Wait for dashboard to fully load
      await expect(page.getByRole('navigation')).toBeVisible()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('dashboard-page.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })

    test('team page visual snapshot', async ({ page }) => {
      await page.goto('/team')

      // Wait for team page to fully load
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('team-page.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })

    test('settings page profile tab visual snapshot', async ({ page }) => {
      await page.goto('/settings')

      // Wait for settings page to fully load
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('settings-profile-tab.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })

    test('settings page account tab visual snapshot', async ({ page }) => {
      await page.goto('/settings')

      // Switch to Account tab
      await page.getByRole('tab', { name: /account/i }).click()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('settings-account-tab.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })

    test('integrations page visual snapshot', async ({ page }) => {
      await page.goto('/integrations')

      // Wait for integrations page to fully load
      await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('integrations-page.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })

    test('account page visual snapshot', async ({ page }) => {
      await page.goto('/account')

      // Wait for account page to fully load
      await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

      // Take full page screenshot
      await expect(page).toHaveScreenshot('account-page.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })
  })
})

test.describe('Visual Regression - Components @visual @regression', () => {
  test.describe('Dialog Components', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('invite member dialog visual snapshot', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Take dialog screenshot
      const dialog = page.getByRole('dialog')
      await expect(dialog).toHaveScreenshot('invite-member-dialog.png', {
        maxDiffPixelRatio: 0.05,
      })

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click()
    })

    test('create webhook dialog visual snapshot', async ({ page }) => {
      await page.goto('/integrations')

      // Open webhook dialog
      await page.getByRole('button', { name: 'Add Webhook' }).first().click()
      await expect(page.getByRole('heading', { name: /create webhook/i })).toBeVisible()

      // Take dialog screenshot
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toHaveScreenshot('create-webhook-dialog.png', {
        maxDiffPixelRatio: 0.05,
      })

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click()
    })

    test('delete account dialog visual snapshot', async ({ page }) => {
      await page.goto('/account')

      // Open delete dialog
      await page.getByRole('button', { name: 'Delete' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Take dialog screenshot
      const dialog = page.getByRole('dialog')
      await expect(dialog).toHaveScreenshot('delete-account-dialog.png', {
        maxDiffPixelRatio: 0.05,
      })

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click()
    })
  })

  test.describe('Navigation Components', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('sidebar navigation visual snapshot', async ({ page }) => {
      await page.goto('/dashboard')

      // Wait for navigation to load
      await expect(page.getByRole('navigation')).toBeVisible()

      // Take sidebar screenshot
      const sidebar = page.locator('aside').first()
      await expect(sidebar).toHaveScreenshot('sidebar-navigation.png', {
        maxDiffPixelRatio: 0.05,
      })
    })
  })
})
