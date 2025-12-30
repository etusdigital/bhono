import { test, expect } from '@playwright/test'

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

      // Should have Google OAuth button
      const googleButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleButton).toBeVisible()
      await expect(googleButton).toBeEnabled()
    })

    test('Google OAuth button should redirect to OAuth provider', async ({ page }) => {
      await page.goto('/login')

      // Get the Google OAuth button
      const googleButton = page.getByRole('button', { name: /continue with google/i })
      await expect(googleButton).toBeVisible()

      // Click and wait for navigation to OAuth provider
      // We expect either:
      // 1. Redirect to Google's OAuth page (accounts.google.com)
      // 2. Redirect to our OAuth endpoint (/auth/login) which then redirects to Google
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes('accounts.google.com') ||
            resp.url().includes('/auth/login') ||
            resp.url().includes('/auth/google'),
          { timeout: 10000 }
        ).catch(() => null),
        googleButton.click(),
      ])

      // Should have navigated away from login page
      // Either to Google OAuth or to our auth endpoint
      await expect
        .poll(
          async () => {
            const url = page.url()
            return (
              url.includes('accounts.google.com') ||
              url.includes('/auth/login') ||
              url.includes('/auth/google') ||
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
        failOnStatusCode: false,
      })

      // Should either redirect or return success (implementation dependent)
      // Accept 200, 302 (redirect), or 401
      expect([200, 302, 401]).toContain(response.status())
    })
  })
})
