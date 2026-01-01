import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Error Handling E2E Tests - Authenticated
 *
 * Tests form validation and API error handling that require authentication.
 *
 * @tags @error
 */

test.describe('Error Handling @error', () => {
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
})
