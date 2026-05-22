import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Mobile Responsive Journey Tests
 *
 * These tests verify that the application works correctly
 * on mobile viewports and handles responsive design properly.
 *
 * @tags @mobile @responsive
 */

// Define mobile viewport
const mobileViewport = { width: 375, height: 667 } // iPhone SE

test.describe('Mobile Responsive - Public Pages @mobile @responsive', () => {
  test.use({ viewport: mobileViewport })

  test('login page should be usable on mobile', async ({ page }) => {
    await page.goto('/login')

    // Verify login page loads correctly on mobile
    await expect(page.getByText('Welcome back')).toBeVisible()

    // Verify OAuth button is visible and tappable
    const authButton = page.getByRole('button', { name: /continue with etus/i })
    await expect(authButton).toBeVisible()
    await expect(authButton).toBeEnabled()
  })
})

test.describe('Mobile Responsive - Authenticated Pages @mobile @responsive', () => {
  test.use({ viewport: mobileViewport })

  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('dashboard should be responsive on mobile', async ({ page }) => {
    await page.goto('/dashboard')

    // Verify page loads
    await expect(page).not.toHaveURL(/login/)

    // Verify main content is visible
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('team page should be responsive on mobile', async ({ page }) => {
    await page.goto('/team')

    // Verify page loads
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

    // Verify Invite Member button is accessible
    const inviteButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    await expect(inviteButton).toBeVisible()

    // Verify team member count is visible
    await expect(page.getByText(/active members/i)).toBeVisible()
  })

  test('invite dialog should work on mobile', async ({ page }) => {
    await page.goto('/team')

    // Open invite dialog
    await page.locator('button').filter({ hasText: 'Invite Member' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Verify dialog is usable on mobile
    const emailInput = page.getByLabel(/email address/i)
    await expect(emailInput).toBeVisible()
    await emailInput.fill('mobile-test@example.com')

    // Verify buttons are tappable
    const sendButton = page.getByRole('button', { name: /send invitation/i })
    await expect(sendButton).toBeEnabled()

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('settings page should be responsive on mobile', async ({ page }) => {
    await page.goto('/settings')

    // Verify page loads
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    // Verify tabs are accessible
    const profileTab = page.getByRole('tab', { name: /profile/i })
    await expect(profileTab).toBeVisible()

    // Verify form inputs are accessible
    const nameInput = page.getByLabel(/full name/i)
    await expect(nameInput).toBeVisible()
  })

  test('integrations page should be responsive on mobile', async ({ page }) => {
    await page.goto('/integrations')

    // Verify page loads
    await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

    // Verify search is accessible
    const searchInput = page.getByPlaceholder(/search integrations/i)
    await expect(searchInput).toBeVisible()

    // Verify integration cards are visible
    await expect(page.getByText('Slack').first()).toBeVisible()
  })

  test('account page should be responsive on mobile', async ({ page }) => {
    await page.goto('/account')

    // Verify page loads
    await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()

    // Verify key sections are visible
    await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^security$/i })).toBeVisible()
  })

  test('navigation should work on mobile', async ({ page }) => {
    // Start at dashboard
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/login/)

    // Navigate to team
    await page.goto('/team')
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

    // Navigate to settings
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    // Navigate to integrations
    await page.goto('/integrations')
    await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()

    // Navigate to account
    await page.goto('/account')
    await expect(page.getByRole('heading', { name: /^account$/i, level: 1 })).toBeVisible()
  })
})

test.describe('Tablet Responsive Journeys @tablet @responsive', () => {
  test.use({ viewport: { width: 768, height: 1024 } }) // iPad

  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('dashboard should work on tablet', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('team page should work on tablet', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
    await expect(page.getByText(/active members/i)).toBeVisible()
  })

  test('settings page should work on tablet', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible()
  })

  test('integrations page should work on tablet', async ({ page }) => {
    await page.goto('/integrations')
    await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
    await expect(page.getByPlaceholder(/search integrations/i)).toBeVisible()
  })
})
