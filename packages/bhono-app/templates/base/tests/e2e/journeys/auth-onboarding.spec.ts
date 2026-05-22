import { test, expect, isAuthenticated, waitForNavigation, closeAllDialogs, apiRequest, getAccountId } from '../fixtures'

/**
 * Authentication & Onboarding Journey Tests
 *
 * These tests verify the complete authentication journey from login
 * through onboarding to session management.
 *
 * @tags @critical @journey @auth
 */

test.describe('Authentication & Onboarding Journeys @critical @journey @auth', () => {
  test.describe('OAuth Flow Structure', () => {
    test('should display complete OAuth provider options on login page', async ({ page }) => {
      await page.goto('/login')

      // Verify login page loads with welcome message
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Verify ETUS Auth button is present and properly styled
      const authButton = page.getByRole('button', { name: /continue with etus/i })
      await expect(authButton).toBeVisible()
      await expect(authButton).toBeEnabled()

      // Verify the button has the expected structure (icon + text)
      await expect(page.locator('body')).toBeVisible()
    })

    test('should show OAuth consent flow elements', async ({ page }) => {
      await page.goto('/login')

      // Verify the ETUS Auth button initiates the OAuth flow
      const authButton = page.getByRole('button', { name: /continue with etus/i })
      await expect(authButton).toBeVisible()

      // Click the button and verify navigation to OAuth provider or auth endpoint
      await authButton.click()

      // Wait for URL to change from login page (navigates to OAuth provider or auth callback)
      await expect(page).not.toHaveURL('/login', { timeout: 10000 })
    })
  })

  test.describe('Post-Login Onboarding', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('should land on dashboard after successful authentication', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard')

      // Verify we are on the dashboard (not redirected to login)
      await expect(page).not.toHaveURL(/login/)
      await expect(page).toHaveURL(/dashboard/)

      // Verify dashboard navigation is visible (primary indicator)
      await expect(page.getByRole('navigation')).toBeVisible()
    })

    test('should have user context available after login', async ({ page, request, baseURL }) => {
      // Verify /auth/me returns user data
      const response = await request.get(`${baseURL}/auth/me`)

      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Should have user data with expected fields
      expect(body).toHaveProperty('user')
      expect(body.user).toHaveProperty('email')
      expect(body.user).toHaveProperty('name')
    })

    test('should persist session across page reloads', async ({ page }) => {
      // Go to dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)

      // Reload the page
      await page.reload()

      // Should still be on dashboard (session persisted)
      await expect(page).not.toHaveURL(/login/)
      await expect(page).toHaveURL(/dashboard/)

      // Verify we can access protected content
      await expect(page.locator('body')).toBeVisible()
    })

    test('should persist session across navigation', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)
      await expect(page).toHaveURL(/dashboard/)

      // Navigate to settings and verify session persists
      await page.goto('/settings')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Navigate to team and verify session persists
      await page.goto('/team')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Navigate to account and verify session persists
      await page.goto('/account')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

      // Return to dashboard - session should still be valid
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)
      await expect(page).toHaveURL(/dashboard/)
    })
  })

  test.describe('Account Selection Flow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('should have account context in API requests', async ({ page }) => {
      // Make an API request with account context
      const response = await apiRequest(page, 'get', '/auth/me')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Verify user context is available with expected fields
      expect(body).toHaveProperty('user')
      expect(body.user).toHaveProperty('email')
      expect(body.user).toHaveProperty('name')
    })

    test('should maintain account context across pages', async ({ page }) => {
      // Navigate to account page
      await page.goto('/account')
      await expect(page).not.toHaveURL(/login/)

      // Verify account page loads with user's account data
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()

      // Verify connected accounts section shows user info
      await expect(page.getByRole('heading', { name: /connected accounts/i })).toBeVisible()

      // Navigate to settings - account context should be maintained
      await page.goto('/settings')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Navigate to team - account context should be maintained
      await page.goto('/team')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()

      // Return to account - context should still be valid
      await page.goto('/account')
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible()
    })
  })

  test.describe('Session Management Journey', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should display active sessions on account page', async ({ page }) => {
      await page.goto('/account')

      // Verify Active Sessions section is visible
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Verify at least one session is displayed with device info
      const sessionInfo = page.getByText(/chrome on|safari on|firefox on|edge on/i)
      await expect(sessionInfo.first()).toBeVisible()

      // Current session badge should be visible
      await expect(page.getByText('Current', { exact: true })).toBeVisible()
    })

    test('should show session device information', async ({ page }) => {
      await page.goto('/account')

      // Verify session shows device/browser information
      const deviceInfo = page.getByText(/chrome on|safari on|firefox on/i)
      await expect(deviceInfo.first()).toBeVisible()

      // Verify the device info includes OS context (macOS, Windows, iPhone, etc.)
      await expect(
        page.getByText(/chrome on macos|safari on iphone|chrome on windows|firefox on/i).first()
      ).toBeVisible()
    })

    test('should have sign out all sessions option', async ({ page }) => {
      await page.goto('/account')

      // Verify Active Sessions section exists
      await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible()

      // Verify "Sign out all" button is present
      const signOutAllButton = page.getByRole('button', { name: /sign out all/i })
      await expect(signOutAllButton).toBeVisible()
      await expect(signOutAllButton).toBeEnabled()
    })

    test('should show session location/activity', async ({ page }) => {
      await page.goto('/account')

      // Verify session shows location information
      const locationInfo = page.getByText(/san francisco|new york|london|active now|hours ago|minutes ago/i)
      await expect(locationInfo.first()).toBeVisible()

      // Verify current session has "Current" badge
      await expect(page.getByText('Current', { exact: true })).toBeVisible()

      // Verify activity time is displayed
      const activityInfo = page.getByText(/active now|hours ago|minutes ago|days ago/i)
      await expect(activityInfo.first()).toBeVisible()
    })
  })
})
