import { test, expect, isAuthenticated, apiRequest, getAccountId, closeAllDialogs } from '../fixtures'

/**
 * Audit Log Investigation Journey Tests
 *
 * These tests verify complete audit log investigation flows,
 * including listing logs, filtering, and examining individual entries.
 *
 * @tags @journey @audit @security
 */

test.describe('Audit Log Investigation Journey @journey @audit', () => {
  test.describe('Audit Log Overview', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test.afterEach(async ({ page }) => {
      await closeAllDialogs(page)
    })

    test('should retrieve audit logs via API with proper structure', async ({ page }) => {
      // Step 1: Fetch audit logs from API
      const response = await apiRequest(page, 'get', '/api/audits')
      expect(response.ok()).toBeTruthy()

      // Step 2: Verify response structure
      const body = await response.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
      expect(Array.isArray(body.data)).toBeTruthy()

      // Step 3: Verify pagination metadata
      expect(body.meta).toHaveProperty('currentPage')
      expect(body.meta).toHaveProperty('limit')
      expect(body.meta).toHaveProperty('totalItems')
      expect(body.meta).toHaveProperty('totalPages')
    })

    test('should filter audit logs by LOGIN action type', async ({ page }) => {
      // Step 1: Fetch filtered audit logs
      const response = await apiRequest(page, 'get', '/api/audits?action=LOGIN')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')

      // Step 2: Verify all results match the filter
      if (body.data.length > 0) {
        for (const entry of body.data) {
          expect(entry.action).toBe('LOGIN')
        }
      }
    })

    test('should filter audit logs by INSERT action type', async ({ page }) => {
      // Step 1: Fetch filtered audit logs
      const response = await apiRequest(page, 'get', '/api/audits?action=INSERT')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')

      // Step 2: Verify all results match the filter
      if (body.data.length > 0) {
        for (const entry of body.data) {
          expect(entry.action).toBe('INSERT')
        }
      }
    })

    test('should filter audit logs by UPDATE action type', async ({ page }) => {
      // Step 1: Fetch filtered audit logs
      const response = await apiRequest(page, 'get', '/api/audits?action=UPDATE')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('data')

      // Step 2: Verify all results match the filter
      if (body.data.length > 0) {
        for (const entry of body.data) {
          expect(entry.action).toBe('UPDATE')
        }
      }
    })
  })

  test.describe('Audit Log Entry Details', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should have complete audit entry fields for investigation', async ({ page }) => {
      // Step 1: Fetch a single audit log entry
      const response = await apiRequest(page, 'get', '/api/audits?limit=1')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Skip if no audit logs exist
      if (body.data.length === 0) {
        test.skip(true, 'No audit logs available to validate')
        return
      }

      const entry = body.data[0]

      // Step 3: Verify required investigative fields
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('action')
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('transactionId')
      expect(entry).toHaveProperty('entity')
      expect(entry).toHaveProperty('entityId')

      // Step 4: Verify field types
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.action).toBe('string')
      expect(typeof entry.timestamp).toBe('string')
      expect(typeof entry.transactionId).toBe('string')
    })

    test('should have valid action types for audit entries', async ({ page }) => {
      // Step 1: Fetch audit log entries
      const response = await apiRequest(page, 'get', '/api/audits?limit=10')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Skip if no audit logs exist
      if (body.data.length === 0) {
        test.skip(true, 'No audit logs available to validate')
        return
      }

      // Step 3: Validate action types
      const validActions = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED']

      for (const entry of body.data) {
        expect(validActions).toContain(entry.action)
      }
    })
  })

  test.describe('Audit Log Pagination', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('should paginate audit logs correctly', async ({ page }) => {
      // Step 1: Fetch first page with small limit
      const page1Response = await apiRequest(page, 'get', '/api/audits?page=1&limit=5')
      expect(page1Response.ok()).toBeTruthy()

      const page1Body = await page1Response.json()
      expect(page1Body.meta.currentPage).toBe(1)
      expect(page1Body.meta.limit).toBe(5)
      expect(page1Body.data.length).toBeLessThanOrEqual(5)

      // Step 2: If there are more pages, fetch second page
      if (page1Body.meta.hasNextPage) {
        const page2Response = await apiRequest(page, 'get', '/api/audits?page=2&limit=5')
        expect(page2Response.ok()).toBeTruthy()

        const page2Body = await page2Response.json()
        expect(page2Body.meta.currentPage).toBe(2)

        // Step 3: Verify no duplicate entries between pages
        const page1Ids = page1Body.data.map((e: { id: string }) => e.id)
        const page2Ids = page2Body.data.map((e: { id: string }) => e.id)

        for (const id of page2Ids) {
          expect(page1Ids).not.toContain(id)
        }
      }
    })

    test('should respect pagination limit parameter', async ({ page }) => {
      // Test different limit values
      const limits = [5, 10, 20]

      for (const limit of limits) {
        const response = await apiRequest(page, 'get', `/api/audits?limit=${limit}`)
        expect(response.ok()).toBeTruthy()

        const body = await response.json()
        expect(body.meta.limit).toBe(limit)
        expect(body.data.length).toBeLessThanOrEqual(limit)
      }
    })
  })

  test.describe('Audit Investigation Flow', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session available')

      const accountId = getAccountId()
      test.skip(!accountId, 'No account ID available')
    })

    test('complete audit investigation workflow', async ({ page }) => {
      // Step 1: Start investigation - fetch recent audit logs
      const recentResponse = await apiRequest(page, 'get', '/api/audits?limit=50')
      expect(recentResponse.ok()).toBeTruthy()

      const recentBody = await recentResponse.json()
      expect(recentBody).toHaveProperty('data')

      // Step 2: Gather statistics from available logs
      const actionCounts: Record<string, number> = {}
      for (const entry of recentBody.data) {
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1
      }

      // Step 3: Identify most common action type
      let mostCommonAction = ''
      let maxCount = 0
      for (const [action, count] of Object.entries(actionCounts)) {
        if (count > maxCount) {
          maxCount = count
          mostCommonAction = action
        }
      }

      // Step 4: If we have a common action, investigate it further
      if (mostCommonAction) {
        const filteredResponse = await apiRequest(page, 'get', `/api/audits?action=${mostCommonAction}`)
        expect(filteredResponse.ok()).toBeTruthy()

        const filteredBody = await filteredResponse.json()
        expect(filteredBody.data.length).toBeGreaterThanOrEqual(maxCount)
      }

      // Step 5: Verify timeline ordering (most recent first)
      if (recentBody.data.length >= 2) {
        const firstTimestamp = new Date(recentBody.data[0].timestamp).getTime()
        const secondTimestamp = new Date(recentBody.data[1].timestamp).getTime()
        expect(firstTimestamp).toBeGreaterThanOrEqual(secondTimestamp)
      }
    })

    test('should trace activity by transaction ID', async ({ page }) => {
      // Step 1: Fetch audit logs
      const response = await apiRequest(page, 'get', '/api/audits?limit=10')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Skip if no logs available
      if (body.data.length === 0) {
        test.skip(true, 'No audit logs available')
        return
      }

      // Step 3: Verify all entries have transaction IDs for tracing
      for (const entry of body.data) {
        expect(entry.transactionId).toBeDefined()
        expect(typeof entry.transactionId).toBe('string')
        expect(entry.transactionId.length).toBeGreaterThan(0)
      }
    })

    test('should identify entity types in audit logs', async ({ page }) => {
      // Step 1: Fetch audit logs
      const response = await apiRequest(page, 'get', '/api/audits?limit=50')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Gather entity types
      const entityTypes = new Set<string>()
      for (const entry of body.data) {
        if (entry.entity) {
          entityTypes.add(entry.entity)
        }
      }

      // Step 3: If we have entities, verify they are valid table names
      const validEntities = ['users', 'accounts', 'account_users', 'invitations', 'sessions']
      for (const entity of entityTypes) {
        expect(validEntities).toContain(entity)
      }
    })
  })
})
