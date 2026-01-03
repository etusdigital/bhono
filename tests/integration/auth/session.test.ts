/**
 * Session Authentication Integration Tests
 *
 * Tests the /auth/me endpoint for session-based authentication:
 * - Authentication checks (401 responses for various invalid states)
 * - Successful authentication with valid session
 * - Super admin flag handling
 * - Session fingerprint validation
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getKV, createSession, type TestEnv } from '../setup'
import {
  createUser,
  createInactiveUser,
  createDeletedUser,
  createSuperAdmin,
  createUserSession,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { auth } from '../../../src/server/routes/auth'
import { sessionMiddleware } from '../../../src/server/lib/session'
import { errorHandler } from '../../../src/server/middleware/error-handler'

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

describe('Session Authentication Integration', () => {
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

    // Apply session middleware (reads session from KV)
    app.use('*', sessionMiddleware())

    // Mount auth routes
    app.route('/auth', auth)
  })

  describe('GET /auth/me', () => {
    describe('Authentication Failures (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/auth/me', { method: 'GET' })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
        expect(body.error.status).toBe(401)
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: 'sid=invalid-session-id-that-does-not-exist',
          },
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
        expect(body.error.status).toBe(401)
      })

      it('should return 401 with expired session', async () => {
        // Create a user and session
        const user = await createUser({ email: 'expired@example.com', name: 'Expired User' })

        // Manually create an expired session in KV
        const kv = getKV()
        const sessionId = crypto.randomUUID()
        const sessionData = {
          userId: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: null,
          isSuperAdmin: false,
          fingerprint: { ip: '127.0.0.1', userAgent: 'IntegrationTest/1.0' },
        }

        // Store with very short TTL (already expired by mock KV logic)
        await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
          expirationTtl: -1, // Negative TTL = already expired
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: `sid=${sessionId}`,
          },
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
        expect(body.error.status).toBe(401)
      })

      it('should return 401 when session fingerprint user-agent mismatches', async () => {
        // Create a user
        const user = await createUser({ email: 'fingerprint@example.com', name: 'Fingerprint User' })

        // Create session with specific fingerprint
        const kv = getKV()
        const sessionId = crypto.randomUUID()
        const sessionData = {
          userId: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: null,
          isSuperAdmin: false,
          fingerprint: {
            ip: '127.0.0.1',
            userAgent: 'OriginalBrowser/1.0',
          },
        }

        await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
          expirationTtl: 86400,
        })

        // Request with different user-agent
        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: `sid=${sessionId}`,
            'User-Agent': 'DifferentBrowser/2.0',
          },
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
        expect(body.error.status).toBe(401)
      })
    })

    describe('Successful Authentication', () => {
      it('should return current user with valid session', async () => {
        const user = await createUser({
          email: 'valid@example.com',
          name: 'Valid User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body).toHaveProperty('user')
        expect(body.user.id).toBe(user.id)
        expect(body.user.email).toBe(user.email)
        expect(body.user.name).toBe(user.name)
      })

      it('should include all required user fields', async () => {
        const user = await createUser({
          email: 'complete@example.com',
          name: 'Complete User',
          avatarUrl: 'https://example.com/avatar.jpg',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.user).toMatchObject({
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          isSuperAdmin: false,
        })
      })

      it('should include isSuperAdmin flag for super admins', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superadmin@example.com',
          name: 'Super Admin',
        })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.user.isSuperAdmin).toBe(true)
      })

      it('should return isSuperAdmin as false for regular users', async () => {
        const user = await createUser({
          email: 'regular@example.com',
          name: 'Regular User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.user.isSuperAdmin).toBe(false)
      })

      it('should handle null avatarUrl', async () => {
        const user = await createUser({
          email: 'noavatar@example.com',
          name: 'No Avatar User',
          avatarUrl: null,
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          avatarUrl: null,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.user.avatarUrl).toBeNull()
      })
    })

    describe('Session Fingerprint Validation', () => {
      it('should accept request when IP changes but user-agent matches', async () => {
        // Session fingerprint validation only checks user-agent, not IP
        const user = await createUser({
          email: 'ipchange@example.com',
          name: 'IP Change User',
        })

        // Create session with specific fingerprint
        const kv = getKV()
        const sessionId = crypto.randomUUID()
        const sessionData = {
          userId: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: null,
          isSuperAdmin: false,
          fingerprint: {
            ip: '192.168.1.1',
            userAgent: 'IntegrationTest/1.0',
          },
        }

        await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
          expirationTtl: 86400,
        })

        // Request from different IP but same user-agent
        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: `sid=${sessionId}`,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        // Should succeed because user-agent matches
        expect(res.status).toBe(200)
      })

      it('should accept session without fingerprint data', async () => {
        // Legacy sessions might not have fingerprint
        const user = await createUser({
          email: 'legacy@example.com',
          name: 'Legacy User',
        })

        const kv = getKV()
        const sessionId = crypto.randomUUID()
        const sessionData = {
          userId: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: null,
          isSuperAdmin: false,
          // No fingerprint field
        }

        await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
          expirationTtl: 86400,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: `sid=${sessionId}`,
            'User-Agent': 'AnyBrowser/1.0',
          },
        })

        expect(res.status).toBe(200)
      })
    })

    describe('Response Structure', () => {
      it('should return JSON content-type', async () => {
        const user = await createUser({
          email: 'jsontest@example.com',
          name: 'JSON Test User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.headers.get('content-type')).toContain('application/json')
      })

      it('should return user object wrapped in user property', async () => {
        const user = await createUser({
          email: 'wrapped@example.com',
          name: 'Wrapped User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        const body = await res.json()

        // Response should be { user: { ... } }
        expect(Object.keys(body)).toEqual(['user'])
        expect(body.user).toHaveProperty('id')
        expect(body.user).toHaveProperty('email')
        expect(body.user).toHaveProperty('name')
        expect(body.user).toHaveProperty('avatarUrl')
        expect(body.user).toHaveProperty('isSuperAdmin')
      })
    })

    describe('Edge Cases', () => {
      it('should handle malformed session data in KV', async () => {
        const kv = getKV()
        const sessionId = crypto.randomUUID()

        // Store invalid JSON
        await kv.put(`sid:${sessionId}`, 'not-valid-json{', {
          expirationTtl: 86400,
        })

        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: `sid=${sessionId}`,
          },
        })

        // Should return 401 because session middleware couldn't parse the data
        expect(res.status).toBe(401)
      })

      it('should handle empty session cookie value', async () => {
        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            Cookie: 'sid=',
          },
        })

        expect(res.status).toBe(401)
      })

      it('should handle multiple concurrent requests with same session', async () => {
        const user = await createUser({
          email: 'concurrent@example.com',
          name: 'Concurrent User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const requestHeaders = {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
        }

        // Execute multiple requests in parallel
        const requests = Array(5)
          .fill(null)
          .map(() => app.request('/auth/me', { method: 'GET', headers: requestHeaders }))

        const responses = await Promise.all(requests)

        // All requests should succeed
        for (const res of responses) {
          expect(res.status).toBe(200)
          const body = await res.json()
          expect(body.user.id).toBe(user.id)
        }
      })
    })
  })
})
