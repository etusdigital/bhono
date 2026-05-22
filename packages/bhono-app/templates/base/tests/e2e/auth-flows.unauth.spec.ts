import { test, expect } from './fixtures'

/**
 * Auth Flow Tests (Unauthenticated)
 *
 * These tests verify authentication flows without requiring an authenticated session.
 * Tests are run with the 'chromium-unauth' project (no storageState).
 *
 * @tags @auth
 */

test.describe('Auth Flows @auth', () => {
  test.describe('Login Page', () => {
    test('should display login options', async ({ page }) => {
      await page.goto('/login')

      // Should see welcome message
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Should have ETUS Auth button
      const authButton = page.getByRole('button', { name: /continue with etus/i })
      await expect(authButton).toBeVisible()
      await expect(authButton).toBeEnabled()
    })

    test('ETUS Auth button should redirect to OAuth provider', async ({ page }) => {
      await page.goto('/login')

      // Get the ETUS Auth button
      const authButton = page.getByRole('button', { name: /continue with etus/i })
      await expect(authButton).toBeVisible()

      // Click and wait for navigation to the ETUS OAuth gateway.
      // We expect either:
      // 1. Redirect to the gateway authorize endpoint
      // 2. Redirect to our OAuth entrypoint (/auth/login), which then redirects to the gateway
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes('/oauth/authorize') ||
            resp.url().includes('ag.etus.io') ||
            resp.url().includes('/auth/login'),
          { timeout: 10000 }
        ).catch(() => null),
        authButton.click(),
      ])

      // Should have navigated away from login page
      // Either to ETUS Auth or to our auth endpoint
      await expect
        .poll(
          async () => {
            const url = page.url()
            return (
              url.includes('/oauth/authorize') ||
              url.includes('ag.etus.io') ||
              url.includes('/auth/login') ||
              // If OAuth is configured differently, we at least shouldn't be on login anymore
              !url.includes('/login')
            )
          },
          {
            timeout: 10000,
            message: 'Expected to navigate away from login page to OAuth provider',
          }
        )
        .toBeTruthy()
    })
  })

  test.describe('Protected Route Redirects', () => {
    const protectedRoutes = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/settings', name: 'Settings' },
      { path: '/team', name: 'Team' },
    ]

    for (const route of protectedRoutes) {
      test(`unauthenticated user should be redirected from ${route.name}`, async ({ page }) => {
        // Try to access protected route without auth
        await page.goto(route.path)

        // Should be redirected to login page
        await expect(page).toHaveURL(/login/, { timeout: 10000 })

        // Login page should be visible
        await expect(page.getByText('Welcome back')).toBeVisible()
      })
    }
  })

  test.describe('Auth Endpoints', () => {
    test('/auth/me should return 401 for unauthenticated requests', async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}/auth/me`, {
        failOnStatusCode: false,
      })

      // Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    })

    test('/auth/logout should handle unauthenticated logout gracefully', async ({
      page,
      request,
      baseURL,
    }) => {
      // Logout endpoint should not crash for unauthenticated users
      const response = await request.post(`${baseURL}/auth/logout`, {
        headers: {
          Origin: new URL(baseURL ?? 'http://localhost:8787').origin,
          'X-CSRF-Token': '1',
        },
        failOnStatusCode: false,
      })

      // Should either redirect or return success (implementation dependent)
      // Accept 200, 302 (redirect), or 401
      expect([200, 302, 401]).toContain(response.status())
    })
  })
})
