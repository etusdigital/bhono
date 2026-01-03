/**
 * Logout Integration Tests
 *
 * Tests the POST /auth/logout endpoint for session termination:
 * - Successful logout with session deletion from KV
 * - Cookie clearing behavior
 * - Edge cases (no session, expired session, deleted user)
 *
 * Note: The logout endpoint is public (no auth guard) and returns success
 * even without a session. This is intentional to ensure logout always succeeds.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getKV, type TestEnv } from '../setup'
import {
  createUser,
  createDeletedUser,
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

describe('Logout Integration', () => {
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

  describe('POST /auth/logout', () => {
    describe('Successful Logout', () => {
      it('should return 200 and success message', async () => {
        const user = await createUser({
          email: 'logout-success@example.com',
          name: 'Logout Success User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body).toHaveProperty('message')
        expect(body.message).toBe('Logged out successfully')
      })

      it('should delete session from KV store', async () => {
        const user = await createUser({
          email: 'logout-kv@example.com',
          name: 'Logout KV User',
        })

        const { sessionId, headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const kv = getKV()

        // Verify session exists before logout
        const sessionBefore = await kv.get(`sid:${sessionId}`)
        expect(sessionBefore).not.toBeNull()

        // Perform logout
        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        // Verify session is deleted from KV
        const sessionAfter = await kv.get(`sid:${sessionId}`)
        expect(sessionAfter).toBeNull()
      })

      it('should clear session cookie via Set-Cookie header', async () => {
        const user = await createUser({
          email: 'logout-cookie@example.com',
          name: 'Logout Cookie User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        // Check Set-Cookie header clears the session cookie
        const setCookieHeader = res.headers.get('Set-Cookie')
        expect(setCookieHeader).not.toBeNull()

        // The cookie should be cleared with an expired date
        expect(setCookieHeader).toContain('sid=')
        expect(setCookieHeader).toContain('Expires=')
        // Expired cookie value should be empty
        expect(setCookieHeader).toMatch(/sid=;/)
      })

      it('should invalidate session for subsequent requests', async () => {
        const user = await createUser({
          email: 'logout-invalidate@example.com',
          name: 'Logout Invalidate User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        // First verify we can access /auth/me
        const meBeforeLogout = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })
        expect(meBeforeLogout.status).toBe(200)

        // Perform logout
        const logoutRes = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })
        expect(logoutRes.status).toBe(200)

        // After logout, same session should no longer work
        const meAfterLogout = await app.request('/auth/me', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })
        expect(meAfterLogout.status).toBe(401)
      })

      it('should work for super admin users', async () => {
        const user = await createUser({
          email: 'logout-superadmin@example.com',
          name: 'Logout SuperAdmin User',
          isSuperAdmin: true,
        })

        const { sessionId, headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: true,
        })

        const kv = getKV()

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        // Verify session is deleted
        const sessionAfter = await kv.get(`sid:${sessionId}`)
        expect(sessionAfter).toBeNull()
      })
    })

    describe('Logout Without Session', () => {
      it('should return 200 even without session cookie', async () => {
        // The logout endpoint is public and returns success even without a session
        // This is intentional - logout should always "succeed"
        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.message).toBe('Logged out successfully')
      })

      it('should return 200 with invalid session ID', async () => {
        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            Cookie: 'sid=nonexistent-session-id',
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.message).toBe('Logged out successfully')
      })
    })

    describe('Edge Cases', () => {
      it('should handle logout when session already expired', async () => {
        const user = await createUser({
          email: 'logout-expired@example.com',
          name: 'Logout Expired User',
        })

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

        // Store with already expired TTL
        await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
          expirationTtl: -1, // Already expired
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            Cookie: `sid=${sessionId}`,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        // Should still return success
        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.message).toBe('Logged out successfully')
      })

      it('should handle logout when user is deleted', async () => {
        // Create a deleted user
        const user = await createDeletedUser({
          email: 'logout-deleted@example.com',
          name: 'Logout Deleted User',
        })

        // Create a session for the deleted user (simulating an old session)
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

        await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
          expirationTtl: 86400,
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            Cookie: `sid=${sessionId}`,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        // Logout should still succeed (it just destroys the session)
        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.message).toBe('Logged out successfully')

        // Verify session is deleted
        const sessionAfter = await kv.get(`sid:${sessionId}`)
        expect(sessionAfter).toBeNull()
      })

      it('should handle double logout (logout twice)', async () => {
        const user = await createUser({
          email: 'logout-double@example.com',
          name: 'Double Logout User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        // First logout
        const res1 = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })
        expect(res1.status).toBe(200)

        // Second logout with same session ID (now invalid)
        const res2 = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        // Should still succeed
        expect(res2.status).toBe(200)

        const body = await res2.json()
        expect(body.message).toBe('Logged out successfully')
      })

      it('should handle malformed session data in KV', async () => {
        const kv = getKV()
        const sessionId = crypto.randomUUID()

        // Store invalid JSON in KV
        await kv.put(`sid:${sessionId}`, 'not-valid-json{', {
          expirationTtl: 86400,
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            Cookie: `sid=${sessionId}`,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        // Should still return success (logout always succeeds)
        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.message).toBe('Logged out successfully')
      })

      it('should handle empty session cookie value', async () => {
        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            Cookie: 'sid=',
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.message).toBe('Logged out successfully')
      })
    })

    describe('Response Structure', () => {
      it('should return JSON content-type', async () => {
        const user = await createUser({
          email: 'logout-json@example.com',
          name: 'Logout JSON User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.headers.get('content-type')).toContain('application/json')
      })

      it('should only have message property in response', async () => {
        const user = await createUser({
          email: 'logout-response@example.com',
          name: 'Logout Response User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
        })

        const res = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        const body = await res.json()

        // Response should only contain message property
        expect(Object.keys(body)).toEqual(['message'])
        expect(body.message).toBe('Logged out successfully')
      })
    })

    describe('Concurrency', () => {
      it('should handle multiple concurrent logouts for same session', async () => {
        const user = await createUser({
          email: 'logout-concurrent@example.com',
          name: 'Concurrent Logout User',
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

        // Execute multiple logout requests in parallel
        const requests = Array(5)
          .fill(null)
          .map(() => app.request('/auth/logout', { method: 'POST', headers: requestHeaders }))

        const responses = await Promise.all(requests)

        // All requests should succeed (even if session was already deleted)
        for (const res of responses) {
          expect(res.status).toBe(200)
          const body = await res.json()
          expect(body.message).toBe('Logged out successfully')
        }
      })
    })
  })
})
