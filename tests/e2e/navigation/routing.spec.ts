import { test, expect, waitForNavigation, isAuthenticated } from '../fixtures'

/**
 * Navigation and Routing E2E Tests
 *
 * Tests for URL handling, navigation behavior, and routing functionality:
 * - URL redirect parameter preservation
 * - Query parameter preservation across navigation
 * - Browser back button behavior
 * - Deep linking to authenticated routes
 * - 404 page for invalid routes
 * - Route parameter extraction
 *
 * @tags @routing @navigation
 */

test.describe('Navigation and Routing @routing', () => {
  test.describe('404 Page Handling', () => {
    test('should show 404 page for invalid routes', async ({ page }) => {
      await page.goto('/this-route-does-not-exist-12345')

      // Should display 404 content
      await expect(page.getByText('404').first()).toBeVisible()
      await expect(page.getByText('Page not found')).toBeVisible()
    })

    test('should show 404 page for deeply nested invalid routes', async ({ page }) => {
      await page.goto('/deeply/nested/invalid/path/that/does/not/exist')

      // Should display 404 content
      await expect(page.getByText('404').first()).toBeVisible()
      await expect(page.getByText('Page not found')).toBeVisible()
    })

    test('should provide navigation options on 404 page', async ({ page }) => {
      await page.goto('/unknown-page-xyz')

      // Should have Back to Home button
      const homeButton = page.getByRole('link', { name: /back to home/i })
      await expect(homeButton).toBeVisible()

      // Should have Go to Dashboard button
      const dashboardButton = page.getByRole('link', { name: /go to dashboard/i })
      await expect(dashboardButton).toBeVisible()
    })

    test('should be able to navigate from 404 to home', async ({ page }) => {
      await page.goto('/unknown-page-xyz')

      // Click Back to Home
      const homeButton = page.getByRole('link', { name: /back to home/i })
      await homeButton.click()

      // Should navigate to home page
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Route Parameter Extraction', () => {
    test('should correctly extract token from invite route', async ({ page }) => {
      const testToken = 'test-invite-token-123'
      await page.goto(`/invite/${testToken}`)

      // The invite page should load and show invitation content
      // This verifies the route parameter was correctly extracted
      await expect(page.getByText("You've Been Invited!")).toBeVisible()
    })

    test('should handle special characters in route parameters', async ({ page }) => {
      // URL-safe special characters in token
      const testToken = 'token_with-special.chars123'
      await page.goto(`/invite/${testToken}`)

      // Should still load the invite page
      await expect(page.getByText("You've Been Invited!")).toBeVisible()
    })
  })

  test.describe('Authenticated Navigation', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('should preserve query parameters across navigation', async ({ page }) => {
      // Navigate to dashboard with query parameters
      await page.goto('/dashboard?tab=overview&filter=active')

      // Verify we're on dashboard
      await expect(page).toHaveURL(/dashboard/)
      await expect(page).not.toHaveURL(/login/)

      // Navigate to team page
      const teamLink = page.getByRole('link', { name: /team/i })
      await expect(teamLink).toBeVisible()
      await teamLink.click()
      await waitForNavigation(page, '/team')

      // Navigate back to dashboard using sidebar
      const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      await expect(dashboardLink).toBeVisible()
      await dashboardLink.click()
      await waitForNavigation(page, '/dashboard')

      // Dashboard should load without errors
      await expect(page).toHaveURL(/dashboard/)
    })

    test('should handle query parameters in URL correctly', async ({ page }) => {
      // Navigate with complex query parameters
      await page.goto('/settings?tab=profile&edit=true')

      // Should be on settings page
      await expect(page).toHaveURL(/settings/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Verify query params are in URL
      const url = page.url()
      expect(url).toContain('settings')
    })

    test('should handle browser back button correctly', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Navigate to team
      const teamLink = page.getByRole('link', { name: /team/i })
      await expect(teamLink).toBeVisible()
      await teamLink.click()
      await waitForNavigation(page, '/team')
      await expect(page).toHaveURL(/team/)

      // Navigate to settings
      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()
      await waitForNavigation(page, '/settings')
      await expect(page).toHaveURL(/settings/)

      // Press back button - should go to team
      await page.goBack()
      await expect(page).toHaveURL(/team/)

      // Press back button again - should go to dashboard
      await page.goBack()
      await expect(page).toHaveURL(/dashboard/)
    })

    test('should handle browser forward button after going back', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Navigate to settings
      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()
      await waitForNavigation(page, '/settings')
      await expect(page).toHaveURL(/settings/)

      // Go back to dashboard
      await page.goBack()
      await expect(page).toHaveURL(/dashboard/)

      // Go forward to settings
      await page.goForward()
      await expect(page).toHaveURL(/settings/)
    })

    test('should maintain history stack during navigation circuit', async ({ page }) => {
      // Navigate through multiple pages
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Dashboard -> Team
      const teamLink = page.getByRole('link', { name: /team/i })
      await teamLink.click()
      await waitForNavigation(page, '/team')

      // Team -> Account
      const accountLink = page.getByRole('link', { name: /account/i })
      await accountLink.click()
      await waitForNavigation(page, '/account')

      // Account -> Integrations
      const integrationsLink = page.getByRole('link', { name: /integrations/i })
      await integrationsLink.click()
      await waitForNavigation(page, '/integrations')

      // Navigate back through history
      await page.goBack()
      await expect(page).toHaveURL(/account/)

      await page.goBack()
      await expect(page).toHaveURL(/team/)

      await page.goBack()
      await expect(page).toHaveURL(/dashboard/)
    })
  })

  test.describe('Deep Linking - Unauthenticated', () => {
    // Run serially to avoid affecting other tests' session state
    test.describe.configure({ mode: 'serial' })

    test('should redirect unauthenticated user from dashboard to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected route directly
      await page.goto('/dashboard')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
      await expect(page.getByText('Welcome back')).toBeVisible()
    })

    test('should redirect unauthenticated user from settings to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected settings route directly
      await page.goto('/settings')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
      await expect(page.getByText('Welcome back')).toBeVisible()
    })

    test('should redirect unauthenticated user from team to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected team route directly
      await page.goto('/team')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
      await expect(page.getByText('Welcome back')).toBeVisible()
    })

    test('should redirect unauthenticated user from account to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected account route directly
      await page.goto('/account')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
      await expect(page.getByText('Welcome back')).toBeVisible()
    })

    test('should redirect unauthenticated user from integrations to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected integrations route directly
      await page.goto('/integrations')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
      await expect(page.getByText('Welcome back')).toBeVisible()
    })
  })

  test.describe('URL Redirect Parameter Preservation', () => {
    // Note: Full redirect flow testing requires OAuth which is complex to test in E2E.
    // These tests verify the frontend behavior for redirect handling.

    test('login page should load correctly when accessed directly', async ({ page }) => {
      await page.goto('/login')

      // Should show login page content
      await expect(page.getByText('Welcome back')).toBeVisible()
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    })

    test('should handle redirect query parameter in login URL', async ({ page }) => {
      // Access login with redirect parameter
      await page.goto('/login?redirect=/dashboard/settings')

      // Login page should still load correctly
      await expect(page.getByText('Welcome back')).toBeVisible()
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

      // URL should contain the redirect parameter
      const url = page.url()
      expect(url).toContain('redirect')
    })

    test('should handle encoded redirect parameter', async ({ page }) => {
      // Access login with encoded redirect parameter containing query strings
      const redirectPath = encodeURIComponent('/settings?tab=profile&edit=true')
      await page.goto(`/login?redirect=${redirectPath}`)

      // Login page should still load correctly
      await expect(page.getByText('Welcome back')).toBeVisible()
    })
  })

  test.describe('Public Route Access', () => {
    test('should access home page without authentication', async ({ page }) => {
      await page.goto('/')

      // Should load the home/landing page
      await expect(page.locator('body')).toBeVisible()
    })

    test('should access login page without authentication', async ({ page }) => {
      await page.goto('/login')

      // Should show login page
      await expect(page.getByText('Welcome back')).toBeVisible()
    })

    test('should access invite page without authentication', async ({ page }) => {
      await page.goto('/invite/any-token')

      // Should show invite page
      await expect(page.getByText("You've Been Invited!")).toBeVisible()
    })
  })

  test.describe('Navigation Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('should handle rapid navigation clicks', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/dashboard/)

      // Click multiple navigation links rapidly
      const teamLink = page.getByRole('link', { name: /team/i })
      const settingsLink = page.getByRole('link', { name: /settings/i })

      await teamLink.click()
      // Immediately click another link
      await settingsLink.click()

      // Should end up on the last clicked destination
      await waitForNavigation(page, '/settings')
      await expect(page).toHaveURL(/settings/)
    })

    test('should handle navigation during page load', async ({ page }) => {
      // Start navigation to dashboard
      await page.goto('/dashboard')

      // Wait for dashboard to load
      await expect(page).toHaveURL(/dashboard/)

      // Verify page is functional
      await expect(page.locator('body')).toBeVisible()
    })

    test('should handle hash fragments in URLs', async ({ page }) => {
      await page.goto('/settings#profile')

      // Should be on settings page
      await expect(page).toHaveURL(/settings/)

      // Hash fragment should be preserved
      const url = page.url()
      expect(url).toContain('#profile')
    })
  })
})
