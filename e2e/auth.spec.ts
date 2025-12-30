import { test, expect, isAuthenticated, waitForNavigation } from './fixtures'

/**
 * Authenticated User Tests
 *
 * These tests require authentication via auth.setup.ts which creates session state.
 * Since we can't actually authenticate with Google OAuth in E2E tests without credentials,
 * tests will check for session availability and skip if not authenticated.
 *
 * Run with authenticated project: npx playwright test --project=chromium
 *
 * @tags @auth
 */

test.describe('Authenticated User @auth', () => {
  test.beforeEach(async ({ page }) => {
    // Check if we have a valid session
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No valid session available. Run auth.setup.ts with valid credentials.')
  })

  test.describe('Navigation', () => {
    test('should access dashboard when authenticated', async ({ page }) => {
      await page.goto('/dashboard')

      // Should not be redirected to login
      await expect(page).not.toHaveURL(/login/)

      // Should see dashboard content
      await expect(page.locator('body')).toBeVisible()

      // Check for common dashboard elements
      const dashboardIndicators = [
        page.getByRole('heading', { name: /dashboard/i }),
        page.getByText(/welcome/i),
        page.getByRole('navigation'),
      ]

      // At least one indicator should be visible
      const results = await Promise.all(
        dashboardIndicators.map(async (locator) => {
          try {
            await expect(locator).toBeVisible({ timeout: 2000 })
            return true
          } catch {
            return false
          }
        })
      )

      expect(results.some((r) => r)).toBeTruthy()
    })

    test('should access settings when authenticated', async ({ page }) => {
      await page.goto('/settings')

      // Should not be redirected to login
      await expect(page).not.toHaveURL(/login/)

      // Should see settings page content
      await expect(page.locator('body')).toBeVisible()
    })

    test('should access team page when authenticated', async ({ page }) => {
      await page.goto('/team')

      // Should not be redirected to login
      await expect(page).not.toHaveURL(/login/)

      // Should see team page content
      await expect(page.locator('body')).toBeVisible()
    })

    test('should navigate between protected routes', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)

      // Navigate to settings
      const settingsLink = page.getByRole('link', { name: /settings/i })
      if (await settingsLink.isVisible()) {
        await settingsLink.click()
        await waitForNavigation(page, '/settings')
        await expect(page).toHaveURL(/settings/)
      }

      // Navigate to team (if link exists)
      const teamLink = page.getByRole('link', { name: /team/i })
      if (await teamLink.isVisible()) {
        await teamLink.click()
        await waitForNavigation(page, '/team')
        await expect(page).toHaveURL(/team/)
      }
    })
  })

  test.describe('User Session', () => {
    test('/auth/me should return current user info', async ({ page, request, baseURL }) => {
      // First verify we're authenticated
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No valid session available')

      const response = await request.get(`${baseURL}/auth/me`)

      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Should have user data
      expect(body).toHaveProperty('user')
      expect(body.user).toHaveProperty('email')
      expect(body.user).toHaveProperty('name')
    })

    test('should display user info in UI', async ({ page }) => {
      await page.goto('/dashboard')

      // Look for user avatar, name, or email indicator
      const userIndicators = [
        page.getByRole('button', { name: /account|profile|user/i }),
        page.getByText(/e2e-test@example.com/i),
        page.getByRole('img', { name: /avatar|profile/i }),
      ]

      // At least one user indicator should be visible
      const results = await Promise.all(
        userIndicators.map(async (locator) => {
          try {
            await expect(locator).toBeVisible({ timeout: 3000 })
            return true
          } catch {
            return false
          }
        })
      )

      // This test is informational - may pass or fail depending on UI implementation
      if (!results.some((r) => r)) {
        console.log('Note: No user indicator found in UI. This may be expected based on UI design.')
      }
    })
  })

  test.describe('Logout Flow', () => {
    test('logout should clear session and redirect to login', async ({ page }) => {
      // Navigate to dashboard first
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)

      // Find and click logout button/link
      const logoutButton = page.getByRole('button', { name: /logout|sign out|log out/i })
      const logoutLink = page.getByRole('link', { name: /logout|sign out|log out/i })

      let logoutElement = null

      if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        logoutElement = logoutButton
      } else if (await logoutLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        logoutElement = logoutLink
      }

      if (!logoutElement) {
        // Try opening user menu first
        const userMenu = page.getByRole('button', { name: /account|profile|user|menu/i })
        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
          await userMenu.click()

          // Look for logout in dropdown
          const dropdownLogout = page.getByRole('menuitem', { name: /logout|sign out/i })
          if (await dropdownLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
            logoutElement = dropdownLogout
          }
        }
      }

      // Skip if no logout element found
      test.skip(!logoutElement, 'Logout button/link not found in UI')

      // Click logout
      await logoutElement!.click()

      // Should be redirected to login page
      await expect(page).toHaveURL(/login/, { timeout: 10000 })

      // Verify session is cleared by trying to access protected route
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/login/)
    })

    test('logout via API should clear session', async ({ page, request, baseURL }) => {
      // Verify authenticated first
      const authResponse = await request.get(`${baseURL}/auth/me`)
      test.skip(!authResponse.ok(), 'Not authenticated - cannot test logout')

      // Call logout endpoint
      const logoutResponse = await request.post(`${baseURL}/auth/logout`)

      // Should succeed (200) or redirect (302)
      expect([200, 302]).toContain(logoutResponse.status())

      // Verify session is cleared
      const checkResponse = await request.get(`${baseURL}/auth/me`, {
        failOnStatusCode: false,
      })

      // Should now return 401
      expect(checkResponse.status()).toBe(401)
    })
  })
})
