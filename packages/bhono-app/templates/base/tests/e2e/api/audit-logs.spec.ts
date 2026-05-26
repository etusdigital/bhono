import { test, expect, isAuthenticated, apiRequest, getAccountId } from '../fixtures'

/**
 * Audit Logs API E2E tests for the @etus/auth audit router.
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

  test('GET /audit/logs returns package audit logs', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/audit/logs')

    if (response.status() === 403) {
      test.skip(true, 'Captured OAuth user is not an @etus/auth product admin')
    }

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.logs)).toBe(true)
    expect(typeof body.total).toBe('number')
  })

  test('GET /audit/logs respects limit and offset parameters', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/audit/logs?limit=10&offset=0')

    if (response.status() === 403) {
      test.skip(true, 'Captured OAuth user is not an @etus/auth product admin')
    }

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.logs)).toBe(true)
    expect(body.logs.length).toBeLessThanOrEqual(10)
    expect(typeof body.total).toBe('number')
  })

  test('GET /audit/logs filters by eventType when logs exist', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/audit/logs?eventType=account.created')

    if (response.status() === 403) {
      test.skip(true, 'Captured OAuth user is not an @etus/auth product admin')
    }

    expect(response.status()).toBe(200)
    const body = await response.json()

    expect(Array.isArray(body.logs)).toBe(true)
    for (const entry of body.logs) {
      expect(entry.type).toBe('account.created')
    }
  })

  test('audit log entries expose the package audit field names', async ({ page }) => {
    const response = await apiRequest(page, 'get', '/audit/logs?limit=1')

    if (response.status() === 403) {
      test.skip(true, 'Captured OAuth user is not an @etus/auth product admin')
    }

    expect(response.status()).toBe(200)
    const body = await response.json()

    if (body.logs.length === 0) {
      test.skip(true, 'No audit logs available to validate structure')
    }

    const entry = body.logs[0]
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('type')
    expect(entry).toHaveProperty('actorId')
    expect(entry).toHaveProperty('targetId')
    expect(entry).toHaveProperty('targetType')
    expect(entry).toHaveProperty('createdAt')
  })
})
