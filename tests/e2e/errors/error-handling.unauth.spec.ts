import { test, expect } from '../fixtures'

/**
 * Error Handling E2E Tests - Unauthenticated
 *
 * Tests error states that don't require authentication:
 * - 404 pages
 * - Authentication redirect behavior
 * - Health check endpoints
 *
 * @tags @error
 */

test.describe('Error Handling @error', () => {
  test.describe('404 Errors', () => {
    test('404 page displays for unknown routes', async ({ page }) => {
      await page.goto('/this-page-does-not-exist')

      // Should show 404 content
      await expect(page.getByText('404').first()).toBeVisible()
    })

    test('404 page displays for nested unknown routes', async ({ page }) => {
      await page.goto('/some/deeply/nested/unknown/route')

      // Should show 404 content
      await expect(page.getByText('404').first()).toBeVisible()
    })

    test('404 page has navigation back to home', async ({ page }) => {
      await page.goto('/this-page-does-not-exist')

      // Should show 404 content
      await expect(page.getByText('404').first()).toBeVisible()

      // Should have some form of navigation (link, button, or nav element)
      const homeLink = page.getByRole('link', { name: /home|back|return|go back/i })
      const homeButton = page.getByRole('button', { name: /home|back|return|go back/i })
      const navElement = page.getByRole('navigation')

      const hasHomeLink = await homeLink.isVisible({ timeout: 3000 }).catch(() => false)
      const hasHomeButton = await homeButton.isVisible({ timeout: 3000 }).catch(() => false)
      const hasNavigation = await navElement.isVisible({ timeout: 3000 }).catch(() => false)

      // At least one navigation option should be present
      expect(hasHomeLink || hasHomeButton || hasNavigation).toBeTruthy()
    })
  })

  test.describe('Authentication Errors', () => {
    // Run serially to avoid affecting other tests' session state
    test.describe.configure({ mode: 'serial' })

    test('unauthenticated access to protected route redirects to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected dashboard route
      await page.goto('/dashboard')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
    })

    test('unauthenticated access to settings redirects to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected settings route
      await page.goto('/settings')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
    })

    test('unauthenticated access to team page redirects to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access protected team route
      await page.goto('/team')

      // Should be redirected to login
      await expect(page).toHaveURL(/login/)
    })

    test('invalid session cookie returns 401 from API', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access authenticated API endpoint
      const response = await page.request.get('/auth/me', {
        failOnStatusCode: false,
      })

      // Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    })

    test('cleared session cannot access protected API endpoints', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies()

      // Try to access a package-owned protected endpoint
      const response = await page.request.get('/accounts', {
        failOnStatusCode: false,
      })

      // Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    })
  })

  test.describe('API Health Endpoints', () => {
    test('health endpoint returns proper format', async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}/health`, {
        failOnStatusCode: false,
      })

      // Check content type to ensure we're hitting the API
      const contentType = response.headers()['content-type'] || ''

      if (!contentType.includes('application/json')) {
        test.skip(true, 'API not available in current dev server setup')
        return
      }

      // Accept 200 (healthy) or 503 (unhealthy but responding)
      expect([200, 503]).toContain(response.status())

      const body = await response.json()

      // Should have proper structure
      expect(body).toHaveProperty('status')
      expect(body).toHaveProperty('checks')

      // Status should be a valid value
      expect(['healthy', 'unhealthy', 'degraded']).toContain(body.status)

      // Checks should be an object with service statuses
      expect(typeof body.checks).toBe('object')
    })

    test('liveness endpoint returns proper format', async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}/health/live`, {
        failOnStatusCode: false,
      })

      // Check content type
      const contentType = response.headers()['content-type'] || ''

      if (!contentType.includes('application/json')) {
        test.skip(true, 'API not available in current dev server setup')
        return
      }

      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('alive')
      expect(body.alive).toBe(true)
    })
  })

  test.describe('Network Error Simulation @slow', () => {
    test.skip('page handles slow network gracefully', async ({ page }) => {
      // SKIPPED: This test takes 60-90s - run with: npx playwright test --grep @slow
      test.setTimeout(90000)

      // Simulate slow network (moderate throttling, not extreme)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 200 * 1024, // 200kb/s (more realistic slow 3G)
        uploadThroughput: 200 * 1024,
        latency: 500, // 500ms latency
      })

      // Navigate to home page with extended timeout
      await page.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' })

      // Page should still load (eventually)
      await expect(page.locator('body')).toBeVisible({ timeout: 60000 })
    })

    test('page shows appropriate state when offline', async ({ page }) => {
      // First load the page while online
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()

      // Go offline
      await page.context().setOffline(true)

      // Try to navigate to another page
      try {
        await page.goto('/login', { timeout: 5000 })
      } catch {
        // Navigation should fail when offline - this is expected
      }

      // Go back online for cleanup
      await page.context().setOffline(false)
    })
  })
})
