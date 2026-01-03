import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Audit Logs API E2E Tests
 *
 * Tests for the audit logs API endpoints.
 * Uses apiRequest helper to make API calls with session cookie and account-id header.
 *
 * @tags @api @audit
 */

test.describe('Audit Logs API @api @audit', () => {
  test.beforeEach(async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    const accountId = getAccountId()
    test.skip(!accountId, 'No account ID available')
  })

  test.describe('List Audit Logs', () => {
    test('GET /api/audits should return audit logs list', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits')

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
    })

    test('GET /api/audits with pagination params should return paginated results', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits?page=1&limit=10')

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

    test('GET /api/audits with action filter should filter by action type', async ({ page }) => {
      // Test filtering by LOGIN action
      const response = await apiRequest(page, 'get', '/api/audits?action=LOGIN')

      expect(response.ok()).toBeTruthy()
      expect(response.status()).toBe(200)

      const body = await response.json()

      // Should have data array
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBeTruthy()

      // If there are results, all should have the filtered action type
      if (body.data.length > 0) {
        for (const entry of body.data) {
          expect(entry.action).toBe('LOGIN')
        }
      }
    })
  })

  test.describe('Audit Log Entry Structure', () => {
    test('Audit log entries should have required fields', async ({ page }) => {
      const response = await apiRequest(page, 'get', '/api/audits?limit=1')

      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Skip validation if no audit logs exist
      if (body.data.length === 0) {
        test.skip(true, 'No audit logs available to validate structure')
        return
      }

      const entry = body.data[0]

      // Required fields from AuditLogSchema
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('action')
      expect(entry).toHaveProperty('timestamp')

      // Validate types
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.action).toBe('string')
      expect(typeof entry.timestamp).toBe('string')

      // Additional expected fields
      expect(entry).toHaveProperty('transactionId')
      expect(entry).toHaveProperty('entity')
      expect(entry).toHaveProperty('entityId')

      // Action should be one of the valid enum values
      const validActions = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED']
      expect(validActions).toContain(entry.action)
    })
  })
})
