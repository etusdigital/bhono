import { test, expect, isAuthenticated } from '../fixtures'

/**
 * API Error Handling E2E Tests
 *
 * Tests API error responses and validation behavior.
 * Form validation UI tests are in crud/team.spec.ts and crud/integrations.spec.ts.
 *
 * @tags @error @api
 */

test.describe('API Error Handling @error @api', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('API returns proper error format for invalid UUID', async ({ page }) => {
    // Request with invalid UUID format
    const invalidId = 'invalid-uuid-format'
    const response = await page.request.get(`/auth/admin/users/${invalidId}`, {
      failOnStatusCode: false,
    })

    // @etus/auth admin ids are opaque strings; malformed ids simply miss.
    expect(response.status()).toBe(404)

    const body = await response.json()

    // Should have error property
    expect(body).toHaveProperty('error')
  })

  test('API returns proper error format for non-existent resource', async ({ page }) => {
    // Request a user that doesn't exist (valid UUID format)
    const nonExistentId = '00000000-0000-0000-0000-000000000000'
    const response = await page.request.get(`/auth/admin/users/${nonExistentId}`, {
      failOnStatusCode: false,
    })

    expect(response.status()).toBe(404)

    const body = await response.json()
    expect(body).toHaveProperty('error')
  })
})
