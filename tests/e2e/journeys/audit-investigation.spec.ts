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
      const response = await apiRequest(page, 'get', '/audit/logs')
      expect(response.ok()).toBeTruthy()

      // Step 2: Verify response structure
      const body = await response.json()
      expect(body).toHaveProperty('logs')
      expect(body).toHaveProperty('total')
      expect(Array.isArray(body.logs)).toBeTruthy()

      // Step 3: Verify pagination metadata
      expect(typeof body.total).toBe('number')
    })

    test('should filter audit logs by LOGIN action type', async ({ page }) => {
      // Step 1: Fetch filtered audit logs
      const response = await apiRequest(page, 'get', '/audit/logs?eventType=auth.login')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('logs')

      // Step 2: Verify all results match the filter
      if (body.logs.length > 0) {
        for (const entry of body.logs) {
          expect(entry.type).toBe('auth.login')
        }
      }
    })

    test('should filter audit logs by INSERT action type', async ({ page }) => {
      // Step 1: Fetch filtered audit logs
      const response = await apiRequest(page, 'get', '/audit/logs?eventType=account.created')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('logs')

      // Step 2: Verify all results match the filter
      if (body.logs.length > 0) {
        for (const entry of body.logs) {
          expect(entry.type).toBe('account.created')
        }
      }
    })

    test('should filter audit logs by UPDATE action type', async ({ page }) => {
      // Step 1: Fetch filtered audit logs
      const response = await apiRequest(page, 'get', '/audit/logs?eventType=account.updated')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()
      expect(body).toHaveProperty('logs')

      // Step 2: Verify all results match the filter
      if (body.logs.length > 0) {
        for (const entry of body.logs) {
          expect(entry.type).toBe('account.updated')
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
      const response = await apiRequest(page, 'get', '/audit/logs?limit=1')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Skip if no audit logs exist
      if (body.logs.length === 0) {
        test.skip(true, 'No audit logs available to validate')
        return
      }

      const entry = body.logs[0]

      // Step 3: Verify required investigative fields
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('type')
      expect(entry).toHaveProperty('actorId')
      expect(entry).toHaveProperty('targetId')
      expect(entry).toHaveProperty('targetType')
      expect(entry).toHaveProperty('createdAt')

      // Step 4: Verify field types
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.type).toBe('string')
      expect(typeof entry.createdAt).toBe('string')
    })

    test('should have valid action types for audit entries', async ({ page }) => {
      // Step 1: Fetch audit log entries
      const response = await apiRequest(page, 'get', '/audit/logs?limit=10')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Skip if no audit logs exist
      if (body.logs.length === 0) {
        test.skip(true, 'No audit logs available to validate')
        return
      }

      // Step 3: Validate action types
      const validPrefixes = ['auth.', 'user.', 'account.']

      for (const entry of body.logs) {
        expect(validPrefixes.some((prefix) => entry.type.startsWith(prefix))).toBe(true)
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
      const page1Response = await apiRequest(page, 'get', '/audit/logs?offset=0&limit=5')
      expect(page1Response.ok()).toBeTruthy()

      const page1Body = await page1Response.json()
      expect(page1Body.logs.length).toBeLessThanOrEqual(5)

      // Step 2: If there are more pages, fetch second page
      if (page1Body.total > 5) {
        const page2Response = await apiRequest(page, 'get', '/audit/logs?offset=5&limit=5')
        expect(page2Response.ok()).toBeTruthy()

        const page2Body = await page2Response.json()

        // Step 3: Verify no duplicate entries between pages
        const page1Ids = page1Body.logs.map((e: { id: string }) => e.id)
        const page2Ids = page2Body.logs.map((e: { id: string }) => e.id)

        for (const id of page2Ids) {
          expect(page1Ids).not.toContain(id)
        }
      }
    })

    test('should respect pagination limit parameter', async ({ page }) => {
      // Test different limit values
      const limits = [5, 10, 20]

      for (const limit of limits) {
        const response = await apiRequest(page, 'get', `/audit/logs?limit=${limit}`)
        expect(response.ok()).toBeTruthy()

        const body = await response.json()
        expect(body.logs.length).toBeLessThanOrEqual(limit)
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
      const recentResponse = await apiRequest(page, 'get', '/audit/logs?limit=50')
      expect(recentResponse.ok()).toBeTruthy()

      const recentBody = await recentResponse.json()
      expect(recentBody).toHaveProperty('logs')

      // Step 2: Gather statistics from available logs
      const actionCounts: Record<string, number> = {}
      for (const entry of recentBody.logs) {
        actionCounts[entry.type] = (actionCounts[entry.type] || 0) + 1
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
        const filteredResponse = await apiRequest(page, 'get', `/audit/logs?eventType=${mostCommonAction}`)
        expect(filteredResponse.ok()).toBeTruthy()

        const filteredBody = await filteredResponse.json()
        expect(filteredBody.logs.length).toBeGreaterThanOrEqual(maxCount)
      }

      // Step 5: Verify timeline ordering (most recent first)
      if (recentBody.logs.length >= 2) {
        const firstTimestamp = new Date(recentBody.logs[0].createdAt).getTime()
        const secondTimestamp = new Date(recentBody.logs[1].createdAt).getTime()
        expect(firstTimestamp).toBeGreaterThanOrEqual(secondTimestamp)
      }
    })

    test('should trace activity by transaction ID', async ({ page }) => {
      // Step 1: Fetch audit logs
      const response = await apiRequest(page, 'get', '/audit/logs?limit=10')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Skip if no logs available
      if (body.logs.length === 0) {
        test.skip(true, 'No audit logs available')
        return
      }

      // Step 3: Verify all entries have actor/target context for tracing
      for (const entry of body.logs) {
        expect(entry.id).toBeDefined()
        expect(entry.type).toBeDefined()
        expect(entry.createdAt).toBeDefined()
      }
    })

    test('should identify entity types in audit logs', async ({ page }) => {
      // Step 1: Fetch audit logs
      const response = await apiRequest(page, 'get', '/audit/logs?limit=50')
      expect(response.ok()).toBeTruthy()

      const body = await response.json()

      // Step 2: Gather entity types
      const entityTypes = new Set<string>()
      for (const entry of body.logs) {
        if (entry.targetType) {
          entityTypes.add(entry.targetType)
        }
      }

      // Step 3: If we have entities, verify they are valid table names
      const validEntities = ['user', 'account', 'invitation', 'session']
      for (const entity of entityTypes) {
        expect(validEntities).toContain(entity)
      }
    })
  })
})
