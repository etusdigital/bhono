import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Accounts API E2E Tests
 *
 * Tests for the accounts API endpoints.
 * Uses apiRequest helper to make API calls with session cookie and account-id header.
 *
 * @tags @api @accounts
 */

test.describe('Accounts API @api @accounts', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    const accountId = getAccountId()
    test.skip(!accountId, 'No account ID available')
  })

  test.describe('Get Current Account', () => {
    test('GET /api/accounts/:id should return current account info', async ({ page }) => {
      const accountId = getAccountId()

      const response = await apiRequest(page, 'get', `/api/accounts/${accountId}`)

      expect(response.status()).toBe(200)

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body.data).toHaveProperty('id', accountId)
      expect(body.data).toHaveProperty('name')
      expect(typeof body.data.name).toBe('string')
      expect(body.data).toHaveProperty('createdAt')
      expect(body.data).toHaveProperty('updatedAt')
    })
  })

  test.describe('List User Accounts', () => {
    test('GET /api/accounts should return list of accounts user belongs to', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/accounts')

      expect(response.status()).toBe(200)

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)

      // Validate pagination meta
      expect(body.meta).toHaveProperty('totalItems')
      expect(body.meta).toHaveProperty('currentPage')
      expect(body.meta).toHaveProperty('limit')
      expect(body.meta).toHaveProperty('totalPages')

      // Validate account structure
      const account = body.data[0]
      expect(account).toHaveProperty('id')
      expect(account).toHaveProperty('name')
      expect(account).toHaveProperty('createdAt')
      expect(account).toHaveProperty('updatedAt')
    })
  })

  test.describe('Update Account', () => {
    test('PATCH /api/accounts/:id should update account name and restore original', async ({
      page,
    }) => {
      const accountId = getAccountId()

      // Get original account data
      const getResponse = await apiRequest(page, 'get', `/api/accounts/${accountId}`)
      expect(getResponse.status()).toBe(200)
      const originalData = await getResponse.json()
      const originalName = originalData.data.name

      // Update the account name
      const newName = `Test Account ${Date.now()}`
      const updateResponse = await apiRequest(page, 'patch', `/api/accounts/${accountId}`, {
        data: { name: newName },
      })

      expect(updateResponse.status()).toBe(200)
      const updatedBody = await updateResponse.json()
      expect(updatedBody.data.name).toBe(newName)

      // Restore the original name
      const restoreResponse = await apiRequest(page, 'patch', `/api/accounts/${accountId}`, {
        data: { name: originalName },
      })

      expect(restoreResponse.status()).toBe(200)
      const restoredBody = await restoreResponse.json()
      expect(restoredBody.data.name).toBe(originalName)
    })
  })

  test.describe('Account Members', () => {
    test('GET /api/users should list account members', async ({ page }) => {
      // Users endpoint lists users in the current account context
      const response = await apiRequest(page, 'get', '/api/users')

      expect(response.status()).toBe(200)

      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)

      // Validate user structure
      const user = body.data[0]
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('name')
      expect(user).toHaveProperty('createdAt')
    })
  })

  test.describe('Account Validation', () => {
    test('GET /api/accounts/:id should return 404 for non-existent account', async ({ page }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const response = await apiRequest(page, 'get', `/api/accounts/${nonExistentId}`)

      expect(response.status()).toBe(404)

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
    })

    test('GET /api/accounts/:id should return 400/422 for invalid account ID format', async ({
      page,
    }) => {
      const invalidId = 'not-a-valid-uuid'

      const response = await apiRequest(page, 'get', `/api/accounts/${invalidId}`)

      // Either 400 (Bad Request) or 422 (Unprocessable Entity) for validation error
      expect([400, 422]).toContain(response.status())

      const body = await response.json()
      expect(body).toHaveProperty('error')
    })
  })
})
