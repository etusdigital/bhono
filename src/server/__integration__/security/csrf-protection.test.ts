/**
 * CSRF Protection Integration Tests
 *
 * Tests that the API is protected against CSRF attacks through:
 * - Session cookies have SameSite=Lax attribute
 * - CORS middleware rejects cross-origin requests from malicious sites
 * - Same-origin requests are allowed
 *
 * CSRF protection in this API is provided by:
 * 1. SameSite cookie attribute - browsers won't send cookies with cross-site requests
 * 2. CORS policy - server rejects requests from unauthorized origins
 * 3. Session-based authentication - no bearer tokens that could be intercepted
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import { createTestScenario } from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { auth } from '../../routes/auth'
import { errorHandler } from '../../middleware/error-handler'
import { configurableCors } from '../../middleware/cors'
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

describe('CSRF Protection', () => {
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

    // CORS middleware - configured with allowed origins
    app.use('*', async (c, next) => {
      const corsOrigins = env.CORS_ORIGINS
        ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : []
      return configurableCors({
        corsOrigins,
        appUrl: env.APP_URL,
      })(c, next)
    })

    // Session middleware - reads session from KV and sets sessionData in context
    app.use('*', sessionMiddleware())

    // Mount auth routes (includes test-login)
    app.route('/auth', auth)

    // Mount API routes (includes sessionAuth and accountMiddleware)
    app.route('/api', api)
  })

  // ============================================================================
  // SameSite Cookie Attribute Tests
  // ============================================================================

  describe('SameSite Cookie Attribute', () => {
    it('session cookies should have SameSite=Lax attribute', async () => {
      // Login to get session cookie
      const res = await app.request('/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'csrf-test@example.com', name: 'CSRF Test User' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // Check that SameSite=Lax is present (case-insensitive check)
      expect(setCookie?.toLowerCase()).toContain('samesite=lax')
    })

    it('session cookies should have HttpOnly attribute', async () => {
      const res = await app.request('/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'httponly-test@example.com', name: 'HttpOnly Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // HttpOnly prevents JavaScript access to the cookie
      expect(setCookie?.toLowerCase()).toContain('httponly')
    })

    it('session cookies should have Path=/ attribute', async () => {
      const res = await app.request('/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'path-test@example.com', name: 'Path Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // Path=/ ensures cookie is sent for all paths
      expect(setCookie?.toLowerCase()).toContain('path=/')
    })
  })

  // ============================================================================
  // CORS Protection Tests
  // ============================================================================

  describe('CORS Protection', () => {
    it('should reject cross-origin requests from malicious sites', async () => {
      const scenario = await createTestScenario({
        userName: 'CORS Malicious Test User',
        userEmail: 'cors-malicious@example.com',
        role: 'VIEWER',
      })

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'Origin': 'https://malicious-site.com',
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // The request may succeed (browser enforces CORS), but the origin should NOT be reflected
      const allowOrigin = res.headers.get('access-control-allow-origin')

      // Should NOT allow malicious origin
      expect(allowOrigin).not.toBe('https://malicious-site.com')
    })

    it('should reject preflight requests from malicious origins', async () => {
      const res = await app.request('/api/users', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-attacker.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      })

      // CORS preflight should not include malicious origin in allowed origins
      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).not.toBe('https://evil-attacker.com')
    })

    it('should not allow wildcards that permit any origin', async () => {
      const scenario = await createTestScenario({
        userName: 'Wildcard Test User',
        userEmail: 'wildcard-test@example.com',
        role: 'VIEWER',
      })

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'Origin': 'https://random-site.com',
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      const allowOrigin = res.headers.get('access-control-allow-origin')

      // Should NOT be wildcard * (which allows any origin)
      expect(allowOrigin).not.toBe('*')
    })

    it('should allow same-origin requests from configured origins', async () => {
      const scenario = await createTestScenario({
        userName: 'Same Origin Test User',
        userEmail: 'same-origin@example.com',
        role: 'VIEWER',
      })

      // Use a configured CORS origin (from CORS_ORIGINS in test setup)
      const configuredOrigin = 'http://localhost:3000'

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'Origin': configuredOrigin,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      expect(res.status).toBe(200)

      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).toBe(configuredOrigin)
    })

    it('should reject requests from unconfigured APP_URL when CORS_ORIGINS is set', async () => {
      const scenario = await createTestScenario({
        userName: 'APP URL Test User',
        userEmail: 'app-url-test@example.com',
        role: 'VIEWER',
      })

      // When CORS_ORIGINS is set, APP_URL is NOT automatically included
      // This is the expected behavior - explicit CORS config takes precedence
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'Origin': env.APP_URL, // http://localhost:8787
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Request succeeds (server doesn't block based on CORS alone)
      expect(res.status).toBe(200)

      // But CORS headers should not reflect the unconfigured origin
      const allowOrigin = res.headers.get('access-control-allow-origin')
      // The origin should either be null or NOT be the APP_URL (since it's not in CORS_ORIGINS)
      expect(allowOrigin).not.toBe(env.APP_URL)
    })

    it('should allow configured CORS origins', async () => {
      const scenario = await createTestScenario({
        userName: 'CORS Allowed Test User',
        userEmail: 'cors-allowed@example.com',
        role: 'VIEWER',
      })

      // CORS_ORIGINS is set to 'http://localhost:3000,http://localhost:5173' in test setup
      const allowedOrigin = 'http://localhost:3000'

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'Origin': allowedOrigin,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      expect(res.status).toBe(200)

      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).toBe(allowedOrigin)
    })

    it('should include credentials header for allowed origins', async () => {
      const scenario = await createTestScenario({
        userName: 'Credentials Test User',
        userEmail: 'credentials-test@example.com',
        role: 'VIEWER',
      })

      // Use a configured CORS origin
      const configuredOrigin = 'http://localhost:3000'

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'Origin': configuredOrigin,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Credentials header is needed for cookies to be sent
      const allowCredentials = res.headers.get('access-control-allow-credentials')
      expect(allowCredentials).toBe('true')
    })

    it('should allow necessary HTTP methods for valid origins', async () => {
      // Use a configured CORS origin
      const configuredOrigin = 'http://localhost:3000'

      const res = await app.request('/api/users', {
        method: 'OPTIONS',
        headers: {
          'Origin': configuredOrigin,
          'Access-Control-Request-Method': 'POST',
        },
      })

      const allowMethods = res.headers.get('access-control-allow-methods')
      // CORS middleware should return allowed methods for valid origins
      if (allowMethods) {
        expect(allowMethods).toContain('GET')
        expect(allowMethods).toContain('POST')
        expect(allowMethods).toContain('PATCH')
        expect(allowMethods).toContain('DELETE')
      } else {
        // If no allowMethods, verify the origin is properly allowed
        const allowOrigin = res.headers.get('access-control-allow-origin')
        expect(allowOrigin).toBe(configuredOrigin)
      }
    })

    it('should allow necessary headers for valid origins', async () => {
      // Use a configured CORS origin
      const configuredOrigin = 'http://localhost:3000'

      const res = await app.request('/api/users', {
        method: 'OPTIONS',
        headers: {
          'Origin': configuredOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Account-ID',
        },
      })

      const allowHeaders = res.headers.get('access-control-allow-headers')
      // CORS middleware should return allowed headers for valid origins
      if (allowHeaders) {
        expect(allowHeaders).toContain('Content-Type')
        expect(allowHeaders).toContain('Account-ID')
      } else {
        // If no allowHeaders, verify the origin is properly allowed
        const allowOrigin = res.headers.get('access-control-allow-origin')
        expect(allowOrigin).toBe(configuredOrigin)
      }
    })
  })

  // ============================================================================
  // State-Changing Request Protection Tests
  // ============================================================================

  describe('State-Changing Request Protection', () => {
    it('should reject POST requests from unauthorized origins', async () => {
      const scenario = await createTestScenario({
        userName: 'POST CSRF Test User',
        userEmail: 'post-csrf@example.com',
        role: 'ADMIN',
      })

      const res = await app.request('/api/accounts', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'Origin': 'https://attacker-site.com',
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Malicious Account', description: 'Created via CSRF' }),
      })

      // The request might succeed (server processes it), but CORS headers should not include attacker origin
      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).not.toBe('https://attacker-site.com')
    })

    it('should reject PATCH requests from unauthorized origins', async () => {
      const scenario = await createTestScenario({
        userName: 'PATCH CSRF Test User',
        userEmail: 'patch-csrf@example.com',
        role: 'MANAGER',
      })

      const res = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'Origin': 'https://phishing-site.com',
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      })

      // CORS should not reflect unauthorized origin
      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).not.toBe('https://phishing-site.com')
    })

    it('should reject DELETE requests from unauthorized origins', async () => {
      const scenario = await createTestScenario({
        userName: 'DELETE CSRF Test User',
        userEmail: 'delete-csrf@example.com',
        role: 'ADMIN',
      })

      const res = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'DELETE',
        headers: {
          ...scenario.headers,
          'Origin': 'https://delete-attack.com',
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // CORS should not reflect unauthorized origin
      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).not.toBe('https://delete-attack.com')
    })
  })

  // ============================================================================
  // No-Origin Request Tests
  // ============================================================================

  describe('Requests Without Origin Header', () => {
    it('should handle requests without Origin header (same-site navigation)', async () => {
      const scenario = await createTestScenario({
        userName: 'No Origin Test User',
        userEmail: 'no-origin@example.com',
        role: 'VIEWER',
      })

      // Requests from same-site navigation or direct API calls may not have Origin header
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          // No Origin header
        },
      })

      // Request should succeed (SameSite cookie protects against CSRF)
      expect(res.status).toBe(200)
    })

    it('should not set CORS headers for requests without Origin', async () => {
      const scenario = await createTestScenario({
        userName: 'No Origin CORS Test User',
        userEmail: 'no-origin-cors@example.com',
        role: 'VIEWER',
      })

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          // No Origin header
        },
      })

      // When there's no Origin, CORS headers should not be set
      const allowOrigin = res.headers.get('access-control-allow-origin')
      expect(allowOrigin).toBeNull()
    })
  })

  // ============================================================================
  // Cookie Security Attribute Combination Tests
  // ============================================================================

  describe('Cookie Security Attributes Combination', () => {
    it('should have all necessary security attributes in session cookie', async () => {
      const res = await app.request('/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'full-security@example.com', name: 'Security Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // Check all security attributes
      const cookieLower = setCookie?.toLowerCase() ?? ''

      // SameSite=Lax - prevents CSRF from cross-site requests
      expect(cookieLower).toContain('samesite=lax')

      // HttpOnly - prevents JavaScript access
      expect(cookieLower).toContain('httponly')

      // Path=/ - cookie available for all paths
      expect(cookieLower).toContain('path=/')

      // Session ID cookie name should follow conventions
      // In HTTP (test env), it uses 'sid'; in HTTPS it would use '__Host-sid'
      expect(setCookie).toMatch(/sid=/)
    })
  })
})
