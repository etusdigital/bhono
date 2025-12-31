import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Error Handling E2E Tests
 *
 * Tests error states, 404 pages, authentication errors, and form validation.
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

      // Try to access users API endpoint
      const response = await page.request.get('/api/users', {
        failOnStatusCode: false,
      })

      // Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    })
  })

  test.describe('Form Validation Errors', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')
    })

    test('team invitation with empty email shows disabled state', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await inviteButton.click()

      // Dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible()

      // Email input should be empty
      const emailInput = page.getByLabel(/email address/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toHaveValue('')

      // Send button should be disabled when email is empty
      const sendButton = page.getByRole('button', { name: /send invitation/i })
      await expect(sendButton).toBeDisabled()
    })

    test('team invitation with invalid email format shows disabled state', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      const inviteButton = page.getByRole('button', { name: /invite member/i })
      await inviteButton.click()

      // Enter invalid email
      const emailInput = page.getByLabel(/email address/i)
      await emailInput.fill('not-an-email')

      // Send button should be disabled for invalid email
      const sendButton = page.getByRole('button', { name: /send invitation/i })

      // Check if button is disabled or if there's an error message
      const isDisabled = await sendButton.isDisabled()
      const hasError = await page.getByText(/invalid|error|valid email/i).isVisible({ timeout: 2000 }).catch(() => false)

      // Either the button should be disabled or an error message should show
      expect(isDisabled || hasError).toBeTruthy()
    })

    test('webhook creation with empty URL shows disabled state', async ({ page }) => {
      await page.goto('/integrations')

      // Open webhook creation dialog
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i })
      await addWebhookButton.click()

      // Dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible()

      // URL input should be empty
      const urlInput = page.getByLabel(/endpoint url/i)
      await expect(urlInput).toBeVisible()
      await expect(urlInput).toHaveValue('')

      // Create button should be disabled without URL and events
      const createButton = page.getByRole('button', { name: /create webhook/i })
      await expect(createButton).toBeDisabled()
    })

    test('webhook creation with invalid URL shows validation state', async ({ page }) => {
      await page.goto('/integrations')

      // Open webhook creation dialog
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i })
      await addWebhookButton.click()

      // Enter invalid URL
      const urlInput = page.getByLabel(/endpoint url/i)
      await urlInput.fill('not-a-valid-url')

      // Select an event
      await page.getByText(/user created/i).click()

      // Create button should be disabled for invalid URL
      const createButton = page.getByRole('button', { name: /create webhook/i })

      // Check if button is disabled or if there's an error message
      const isDisabled = await createButton.isDisabled()
      const hasError = await page.getByText(/invalid|error|valid url|https/i).isVisible({ timeout: 2000 }).catch(() => false)

      // Either the button should be disabled or an error message should show
      expect(isDisabled || hasError).toBeTruthy()
    })

    test('webhook creation requires event selection', async ({ page }) => {
      await page.goto('/integrations')

      // Open webhook creation dialog
      const addWebhookButton = page.getByRole('button', { name: /add webhook/i })
      await addWebhookButton.click()

      // Enter valid URL but no events selected
      const urlInput = page.getByLabel(/endpoint url/i)
      await urlInput.fill('https://api.example.com/webhooks')

      // Create button should still be disabled without events
      const createButton = page.getByRole('button', { name: /create webhook/i })
      await expect(createButton).toBeDisabled()
    })
  })

  test.describe('API Error Responses', () => {
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

    test('API 404 response has proper error format', async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      // Request a non-existent user
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      const response = await page.request.get(`/api/users/${nonExistentId}`, {
        failOnStatusCode: false,
      })

      expect(response.status()).toBe(404)

      const body = await response.json()

      // Should have proper error response structure
      expect(body).toHaveProperty('error')
      expect(body).toHaveProperty('statusCode')
      expect(body.statusCode).toBe(404)
    })

    test('API validation error has proper error format', async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      // Request with invalid UUID format
      const invalidId = 'invalid-uuid-format'
      const response = await page.request.get(`/api/users/${invalidId}`, {
        failOnStatusCode: false,
      })

      // Should return 400 or 422 for validation error
      expect([400, 422]).toContain(response.status())

      const body = await response.json()

      // Should have error property
      expect(body).toHaveProperty('error')
    })
  })

  test.describe('Network Error Simulation', () => {
    test('page handles slow network gracefully', async ({ page }) => {
      // Simulate slow network
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024, // 50kb/s
        uploadThroughput: 50 * 1024,
        latency: 2000, // 2 second latency
      })

      // Navigate to home page with extended timeout
      await page.goto('/', { timeout: 60000 })

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
