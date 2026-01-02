/**
 * Session Cookie Security Integration Tests
 *
 * Tests comprehensive session cookie security attributes beyond what is
 * covered in csrf-protection.test.ts.
 *
 * Already tested in csrf-protection.test.ts:
 * - SameSite=Lax attribute
 * - HttpOnly attribute
 * - Path=/ attribute
 * - Combined security attributes
 *
 * This file covers additional security aspects:
 * - Secure flag behavior (HTTP vs HTTPS context)
 * - Cookie naming conventions (__Host- prefix for HTTPS)
 * - Cookie deletion on logout
 * - Session data removal from KV on logout
 * - Session expiration/TTL behavior
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getKV, type TestEnv } from '../setup'
import type { HonoEnv } from '../../types'
import { auth } from '../../routes/auth'
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

describe('Session Cookie Security', () => {
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

    // Session middleware
    app.use('*', sessionMiddleware())

    // Mount auth routes
    app.route('/auth', auth)
  })

  // ============================================================================
  // Cookie Name Convention Tests (HTTP vs HTTPS)
  // ============================================================================

  describe('Cookie Name Conventions', () => {
    it('should use "sid" cookie name in HTTP context', async () => {
      const res = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'http-cookie-name@example.com', name: 'HTTP Cookie Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // In HTTP context, should use simple "sid" name (not __Host-)
      expect(setCookie).toMatch(/^sid=/)
      expect(setCookie).not.toContain('__Host-sid')
    })

    it('should use "__Host-sid" cookie name in HTTPS context', async () => {
      // Create a custom app that simulates HTTPS
      const httpsApp = new Hono<HonoEnv>()
      httpsApp.onError(errorHandler)

      httpsApp.use('*', async (c, next) => {
        ;(c as any).env = env
        c.set('db', createTestDb())
        c.set('transactionId', crypto.randomUUID())
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'IntegrationTest/1.0')
        await next()
      })

      httpsApp.use('*', sessionMiddleware())
      httpsApp.route('/auth', auth)

      // Request with HTTPS URL
      const res = await httpsApp.request('https://secure.example.com/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'https-cookie-name@example.com', name: 'HTTPS Cookie Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // In HTTPS context, should use __Host- prefix
      expect(setCookie).toContain('__Host-sid=')
    })
  })

  // ============================================================================
  // Secure Flag Tests
  // ============================================================================

  describe('Secure Flag Behavior', () => {
    it('should NOT have Secure flag in HTTP context', async () => {
      const res = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'http-secure-flag@example.com', name: 'HTTP Secure Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // HTTP context should NOT have Secure flag
      // (cookies would not be sent over HTTP if Secure is set)
      expect(setCookie?.toLowerCase()).not.toContain('; secure')
    })

    it('should have Secure flag in HTTPS context', async () => {
      // Create HTTPS test app
      const httpsApp = new Hono<HonoEnv>()
      httpsApp.onError(errorHandler)

      httpsApp.use('*', async (c, next) => {
        ;(c as any).env = env
        c.set('db', createTestDb())
        c.set('transactionId', crypto.randomUUID())
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'IntegrationTest/1.0')
        await next()
      })

      httpsApp.use('*', sessionMiddleware())
      httpsApp.route('/auth', auth)

      const res = await httpsApp.request('https://secure.example.com/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'https-secure-flag@example.com', name: 'HTTPS Secure Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // HTTPS context should have Secure flag
      // __Host- prefix requires Secure
      expect(setCookie?.toLowerCase()).toContain('secure')
    })

    it('__Host- prefix cookie must have Secure flag', async () => {
      // Verify __Host- cookies always set Secure (per RFC 6265bis)
      const httpsApp = new Hono<HonoEnv>()
      httpsApp.onError(errorHandler)

      httpsApp.use('*', async (c, next) => {
        ;(c as any).env = env
        c.set('db', createTestDb())
        c.set('transactionId', crypto.randomUUID())
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'IntegrationTest/1.0')
        await next()
      })

      httpsApp.use('*', sessionMiddleware())
      httpsApp.route('/auth', auth)

      const res = await httpsApp.request('https://secure.example.com/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'host-prefix@example.com', name: 'Host Prefix Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // When using __Host- prefix, Secure and Path=/ are mandatory
      if (setCookie?.includes('__Host-')) {
        expect(setCookie.toLowerCase()).toContain('secure')
        expect(setCookie.toLowerCase()).toContain('path=/')
      }
    })
  })

  // ============================================================================
  // Cookie Deletion on Logout Tests
  // ============================================================================

  describe('Cookie Deletion on Logout', () => {
    it('should clear session cookie on logout', async () => {
      // First, login to get a session
      const loginRes = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'logout-clear@example.com', name: 'Logout Clear Test' }),
      })

      expect(loginRes.status).toBe(200)

      const loginCookie = loginRes.headers.get('set-cookie')
      expect(loginCookie).not.toBeNull()

      // Extract session ID from cookie
      const sidMatch = loginCookie?.match(/sid=([^;]+)/)
      expect(sidMatch).not.toBeNull()
      const sessionId = sidMatch![1]

      // Now logout with the session cookie
      const logoutRes = await app.request('http://localhost:8787/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      expect(logoutRes.status).toBe(200)

      // Check that logout sets cookie with empty value and past expiration
      const logoutCookie = logoutRes.headers.get('set-cookie')
      expect(logoutCookie).not.toBeNull()

      // Cookie should have empty value or be cleared
      expect(logoutCookie).toContain('sid=')
      // Should have an Expires in the past or Max-Age=0
      expect(logoutCookie).toMatch(/expires=.*1970/i)
    })

    it('should remove session from KV store on logout', async () => {
      const kv = getKV()

      // Login to create session
      const loginRes = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'logout-kv@example.com', name: 'Logout KV Test' }),
      })

      expect(loginRes.status).toBe(200)

      const loginCookie = loginRes.headers.get('set-cookie')
      const sidMatch = loginCookie?.match(/sid=([^;]+)/)
      expect(sidMatch).not.toBeNull()
      const sessionId = sidMatch![1]

      // Verify session exists in KV
      const sessionBefore = await kv.get(`sid:${sessionId}`)
      expect(sessionBefore).not.toBeNull()

      // Logout
      await app.request('http://localhost:8787/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      // Verify session is removed from KV
      const sessionAfter = await kv.get(`sid:${sessionId}`)
      expect(sessionAfter).toBeNull()
    })

    it('should not allow access to protected routes after logout', async () => {
      // Login
      const loginRes = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'logout-access@example.com', name: 'Logout Access Test' }),
      })

      const loginCookie = loginRes.headers.get('set-cookie')
      const sidMatch = loginCookie?.match(/sid=([^;]+)/)
      const sessionId = sidMatch![1]

      // Access /auth/me before logout - should work
      const meBeforeRes = await app.request('http://localhost:8787/auth/me', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      expect(meBeforeRes.status).toBe(200)

      // Logout
      await app.request('http://localhost:8787/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      // Access /auth/me after logout with same session - should fail
      const meAfterRes = await app.request('http://localhost:8787/auth/me', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      expect(meAfterRes.status).toBe(401)
    })
  })

  // ============================================================================
  // Session Expiration Tests
  // ============================================================================

  describe('Session Expiration', () => {
    it('should set expiration TTL when creating session in KV', async () => {
      const kv = getKV()

      // Login to create session
      const res = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'session-ttl@example.com', name: 'Session TTL Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      const sidMatch = setCookie?.match(/sid=([^;]+)/)
      const sessionId = sidMatch![1]

      // Verify session was stored in KV with TTL
      // The mock KV stores expirationTtl
      const entry = kv._store.get(`sid:${sessionId}`)
      expect(entry).toBeDefined()
      expect(entry?.expirationTtl).toBeDefined()
      expect(entry?.expirationTtl).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // HttpOnly Prevents JavaScript Access Tests
  // ============================================================================

  describe('HttpOnly Cookie Protection', () => {
    it('session cookie should have HttpOnly to prevent JavaScript access', async () => {
      const res = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'httponly-js@example.com', name: 'HttpOnly JS Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).not.toBeNull()

      // HttpOnly attribute prevents document.cookie access in browser
      expect(setCookie?.toLowerCase()).toContain('httponly')
    })
  })

  // ============================================================================
  // Session Fingerprint Validation Tests
  // ============================================================================

  describe('Session Fingerprint Validation', () => {
    it('should invalidate session when User-Agent changes (potential hijacking)', async () => {
      const kv = getKV()

      // Login with original User-Agent
      const loginRes = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OriginalBrowser/1.0',
        },
        body: JSON.stringify({ email: 'fingerprint-test@example.com', name: 'Fingerprint Test' }),
      })

      expect(loginRes.status).toBe(200)

      const setCookie = loginRes.headers.get('set-cookie')
      const sidMatch = setCookie?.match(/sid=([^;]+)/)
      const sessionId = sidMatch![1]

      // Verify session exists
      const sessionBefore = await kv.get(`sid:${sessionId}`)
      expect(sessionBefore).not.toBeNull()

      // Try to access with different User-Agent (simulating session hijacking)
      const meRes = await app.request('http://localhost:8787/auth/me', {
        method: 'GET',
        headers: {
          'User-Agent': 'DifferentBrowser/2.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      // Session should be invalidated due to fingerprint mismatch
      expect(meRes.status).toBe(401)

      // Session should be deleted from KV
      const sessionAfter = await kv.get(`sid:${sessionId}`)
      expect(sessionAfter).toBeNull()
    })

    it('should allow same User-Agent to continue using session', async () => {
      // Login with User-Agent
      const loginRes = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ConsistentBrowser/1.0',
        },
        body: JSON.stringify({ email: 'same-ua@example.com', name: 'Same UA Test' }),
      })

      expect(loginRes.status).toBe(200)

      const setCookie = loginRes.headers.get('set-cookie')
      const sidMatch = setCookie?.match(/sid=([^;]+)/)
      const sessionId = sidMatch![1]

      // Access with same User-Agent
      const meRes = await app.request('http://localhost:8787/auth/me', {
        method: 'GET',
        headers: {
          'User-Agent': 'ConsistentBrowser/1.0',
          'Cookie': `sid=${sessionId}`,
        },
      })

      // Should work fine
      expect(meRes.status).toBe(200)
    })
  })

  // ============================================================================
  // Cookie Content Security Tests
  // ============================================================================

  describe('Cookie Content Security', () => {
    it('session cookie value should be cryptographically random', async () => {
      const res = await app.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'random-sid@example.com', name: 'Random SID Test' }),
      })

      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      const sidMatch = setCookie?.match(/sid=([^;]+)/)
      expect(sidMatch).not.toBeNull()

      const sessionId = sidMatch![1]

      // Session ID should be sufficiently long (32 bytes = 43 chars base64url)
      expect(sessionId.length).toBeGreaterThanOrEqual(32)

      // Should only contain URL-safe base64 characters
      expect(sessionId).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('session IDs should be unique across logins', async () => {
      const sessionIds: string[] = []

      for (let i = 0; i < 3; i++) {
        const res = await app.request('http://localhost:8787/auth/test-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'IntegrationTest/1.0',
          },
          body: JSON.stringify({ email: `unique-sid-${i}@example.com`, name: `Unique SID ${i}` }),
        })

        expect(res.status).toBe(200)

        const setCookie = res.headers.get('set-cookie')
        const sidMatch = setCookie?.match(/sid=([^;]+)/)
        sessionIds.push(sidMatch![1])
      }

      // All session IDs should be unique
      const uniqueIds = new Set(sessionIds)
      expect(uniqueIds.size).toBe(sessionIds.length)
    })
  })
})
