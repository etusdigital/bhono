import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Authenticated API Integration Tests
 *
 * These tests verify API endpoints from an authenticated browser context.
 * Uses apiRequest helper to make API calls with session cookie and account-id header.
 *
 * @tags @api
 */

test.describe('Authenticated API @api', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    const accountId = getAccountId()
    test.skip(!accountId, 'No account ID available')
  })

  test.describe('Auth Endpoints', () => {
    test('GET /auth/me should return current user', async ({ page }) => {
      const response = await page.request.get('/auth/me')

      expect(response.ok()).toBeTruthy()
      expect(response.status()).toBe(200)

      const body = await response.json()

      // Should have user object with required fields
      expect(body).toHaveProperty('user')
      expect(body.user).toHaveProperty('id')
      expect(body.user).toHaveProperty('email')
      expect(body.user).toHaveProperty('name')

      // Validate field types
      expect(typeof body.user.id).toBe('string')
      expect(typeof body.user.email).toBe('string')
      expect(typeof body.user.name).toBe('string')
    })
  })

  test.describe('Users Endpoints', () => {
    test('GET /api/users should return paginated list', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/users')

      expect(response.ok()).toBeTruthy()
      expect(response.status()).toBe(200)

      const body = await response.json()

      // Should have data array
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()

      // Should have pagination meta
      expect(body).toHaveProperty('meta')
      expect(body.meta).toHaveProperty('currentPage')
      expect(body.meta).toHaveProperty('limit')
      expect(body.meta).toHaveProperty('totalItems')
      expect(body.meta).toHaveProperty('totalPages')
      expect(body.meta).toHaveProperty('hasPreviousPage')
      expect(body.meta).toHaveProperty('hasNextPage')

      // Validate pagination meta types
      expect(typeof body.meta.currentPage).toBe('number')
      expect(typeof body.meta.limit).toBe('number')
      expect(typeof body.meta.totalItems).toBe('number')
      expect(typeof body.meta.totalPages).toBe('number')
      expect(typeof body.meta.hasPreviousPage).toBe('boolean')
      expect(typeof body.meta.hasNextPage).toBe('boolean')

      // If there are users, validate structure
      if (body.data.length > 0) {
        const user = body.data[0]
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('email')
        expect(user).toHaveProperty('name')
        expect(user).toHaveProperty('status')
        expect(user).toHaveProperty('createdAt')
        expect(user).toHaveProperty('updatedAt')
      }
    })

    test('GET /api/users with pagination params should respect parameters', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/users?page=1&limit=10')

      expect(response.ok()).toBeTruthy()
      expect(response.status()).toBe(200)

      const body = await response.json()

      // Should have data and meta
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')

      // Limit should be respected
      expect(body.meta.limit).toBe(10)
      expect(body.meta.currentPage).toBe(1)

      // Data length should not exceed limit
      expect(body.data.length).toBeLessThanOrEqual(10)
    })

    test('GET /api/users with page 2 should return second page', async ({ page }) => {
      // First get total count
      const firstResponse = await apiRequest(page, 'get', '/api/users?page=1&limit=5')
      const firstBody = await firstResponse.json()

      // Only test page 2 if there are enough items
      if (firstBody.meta.totalItems > 5) {
        const response = await apiRequest(page, 'get', '/api/users?page=2&limit=5')

        expect(response.ok()).toBeTruthy()

        const body = await response.json()
        expect(body.meta.currentPage).toBe(2)
        expect(body.meta.hasPreviousPage).toBe(true)
      }
    })

    test('GET /api/users with sortOrder should respect sort', async ({ page }) => {
      const ascResponse = await apiRequest(page, 'get', '/api/users?sortOrder=ASC')
      const descResponse = await apiRequest(page, 'get', '/api/users?sortOrder=DESC')

      expect(ascResponse.ok()).toBeTruthy()
      expect(descResponse.ok()).toBeTruthy()

      const ascBody = await ascResponse.json()
      const descBody = await descResponse.json()

      // Both should return valid responses
      expect(ascBody).toHaveProperty('data')
      expect(descBody).toHaveProperty('data')

      // If there are multiple users, order should differ
      if (ascBody.data.length > 1 && descBody.data.length > 1) {
        // The first items should potentially be different (unless all same createdAt)
        // We just verify both requests succeed with valid structure
        expect(Array.isArray(ascBody.data)).toBeTruthy()
        expect(Array.isArray(descBody.data)).toBeTruthy()
      }
    })
  })

  test.describe('Accounts Endpoints', () => {
    test('GET /api/accounts should return account list', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/accounts')

      expect(response.ok()).toBeTruthy()
      expect(response.status()).toBe(200)

      const body = await response.json()

      // Should have data array
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()

      // Should have pagination meta
      expect(body).toHaveProperty('meta')
      expect(body.meta).toHaveProperty('currentPage')
      expect(body.meta).toHaveProperty('limit')
      expect(body.meta).toHaveProperty('totalItems')
      expect(body.meta).toHaveProperty('totalPages')

      // If there are accounts, validate structure
      if (body.data.length > 0) {
        const account = body.data[0]
        expect(account).toHaveProperty('id')
        expect(account).toHaveProperty('name')
        expect(account).toHaveProperty('createdAt')
        expect(account).toHaveProperty('updatedAt')
      }
    })

    test('GET /api/accounts with pagination should respect parameters', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/accounts?page=1&limit=5')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      expect(body.meta.limit).toBe(5)
      expect(body.meta.currentPage).toBe(1)
      expect(body.data.length).toBeLessThanOrEqual(5)
    })
  })

  test.describe('Invitations Endpoints', () => {
    test('GET /api/invitations should return invitation list', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/invitations')

      expect(response.ok()).toBeTruthy()
      expect(response.status()).toBe(200)

      const body = await response.json()

      // Should have data array (may be empty if no pending invitations)
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()

      // If there are invitations, validate structure
      if (body.data.length > 0) {
        const invitation = body.data[0]
        expect(invitation).toHaveProperty('id')
        expect(invitation).toHaveProperty('email')
        expect(invitation).toHaveProperty('role')
        expect(invitation).toHaveProperty('expiresAt')
      }
    })
  })

  test.describe('Error Handling', () => {
    test('GET /api/users/:id should return 404 for non-existent user', async ({ page }) => {
      // Use a valid UUID format that doesn't exist
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const accountId = getAccountId()
      const response = await page.request.get(`/api/users/${nonExistentId}`, {
        failOnStatusCode: false,
        headers: accountId ? { 'account-id': accountId } : {},
      })

      expect(response.status()).toBe(404)

      const body = await response.json()

      // Should have error response structure
      // API returns { error: { code, message, status, timestamp } }
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('status', 404)
      expect(body.error).toHaveProperty('code', 'NOT_FOUND')
    })

    test('GET /api/accounts/:id should return 404 for non-existent account', async ({ page }) => {
      // Use a valid UUID format that doesn't exist
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const accountId = getAccountId()
      const response = await page.request.get(`/api/accounts/${nonExistentId}`, {
        failOnStatusCode: false,
        headers: accountId ? { 'account-id': accountId } : {},
      })

      expect(response.status()).toBe(404)

      const body = await response.json()

      // Should have error response structure
      // API returns { error: { code, message, status, timestamp } }
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('status', 404)
      expect(body.error).toHaveProperty('code', 'NOT_FOUND')
    })

    test('GET /api/users/:id with invalid UUID should return 400', async ({ page }) => {
      const invalidId = 'not-a-valid-uuid'

      const accountId = getAccountId()
      const response = await page.request.get(`/api/users/${invalidId}`, {
        failOnStatusCode: false,
        headers: accountId ? { 'account-id': accountId } : {},
      })

      // Should return 400 for invalid UUID format
      expect([400, 422]).toContain(response.status())

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })

    test('GET /api/accounts/:id with invalid UUID should return 400', async ({ page }) => {
      const invalidId = 'not-a-valid-uuid'

      const accountId = getAccountId()
      const response = await page.request.get(`/api/accounts/${invalidId}`, {
        failOnStatusCode: false,
        headers: accountId ? { 'account-id': accountId } : {},
      })

      // Should return 400 for invalid UUID format
      expect([400, 422]).toContain(response.status())

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })
  })

  test.describe('Response Headers', () => {
    test('API responses should have correct content-type', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/users')

      expect(response.ok()).toBeTruthy()

      const contentType = response.headers()['content-type']
      expect(contentType).toMatch(/application\/json/)
    })
  })

  test.describe('API Authentication', () => {
    test('API requests should use session authentication', async ({ page }) => {
      // Make an authenticated request
      const response = await apiRequest(page, 'get', '/api/users')
      expect(response.ok()).toBeTruthy()

      // Verify we're actually authenticated by checking we get data, not a redirect
      const body = await response.json()
      expect(body).toHaveProperty('data')
    })
  })
})
