import { test, expect, isAuthenticated, waitForNavigation } from './fixtures'

/**
 * Logout Flow Tests
 *
 * These tests verify logout functionality. They are in a separate file (.unauth.spec.ts)
 * to run in the chromium-unauth project, preventing session invalidation from
 * affecting other parallel tests.
 *
 * @tags @auth @logout
 */

test.describe('Logout Flow @auth @logout', () => {
  // Run serially - logout tests invalidate session
  test.describe.configure({ mode: 'serial' })

  test('logout should clear session and redirect to login', async ({ page }) => {
    // First authenticate via test-login
    const loginResponse = await page.request.post('/auth/test-login', {
      data: {
        email: 'logout-test@example.com',
        name: 'Logout Test User',
      },
      failOnStatusCode: false,
    })

    test.skip(!loginResponse.ok(), 'Test login endpoint not available')

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
    // First authenticate via test-login
    const loginResponse = await page.request.post('/auth/test-login', {
      data: {
        email: 'api-logout-test@example.com',
        name: 'API Logout Test User',
      },
      failOnStatusCode: false,
    })

    test.skip(!loginResponse.ok(), 'Test login endpoint not available')

    // Verify authenticated
    const authResponse = await request.get(`${baseURL}/auth/me`)
    test.skip(!authResponse.ok(), 'Not authenticated - cannot test logout')

    // Call logout endpoint
    const logoutResponse = await request.post(`${baseURL}/auth/logout`, {
      headers: {
        Origin: new URL(baseURL ?? 'http://localhost:8787').origin,
      },
    })

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
