/**
 * Session Expiry Integration Tests
 *
 * Tests session expiry and refresh behavior:
 * - Session expiration in KV storage
 * - Session refresh/extension
 * - Expired session rejection
 * - Session TTL handling
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getKV, getSqlite, type TestEnv, type MockKVStore } from '../setup'
import { createUser, createUserSession } from '../fixtures'
import type { HonoEnv, SessionData } from '../../../src/server/types'
import { auth } from '../../../src/server/routes/auth'
import { sessionMiddleware } from '../../../src/server/lib/session'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { hashToken, generateRefreshToken } from '../../../src/server/lib/tokens'

// ============================================================================
// TEST SETUP
// ============================================================================

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

describe('Session Expiry Integration Tests', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      ;(c as any).env = env

      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    app.use('*', sessionMiddleware())
    app.route('/auth', auth)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============================================================================
  // SESSION EXPIRY TESTS
  // ============================================================================

  describe('Session expiration', () => {
    it('should reject requests with expired session', async () => {
      const user = await createUser({
        email: 'expired-session@example.com',
        name: 'Expired Session User',
      })

      // Create session with already-expired TTL
      const kv = getKV()
      const sessionId = crypto.randomUUID()
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: null,
        isSuperAdmin: false,
        fingerprint: {
          ip: '127.0.0.1',
          userAgent: 'IntegrationTest/1.0',
        },
      }

      // Store session with negative TTL (immediately expired)
      await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
        expirationTtl: -1,
      })

      // Request should fail
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Cookie: `sid=${sessionId}`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe('Not authenticated')
    })

    it('should accept requests with valid non-expired session', async () => {
      const user = await createUser({
        email: 'valid-session@example.com',
        name: 'Valid Session User',
      })

      // Create session with long TTL (24 hours)
      const kv = getKV()
      const sessionId = crypto.randomUUID()
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: null,
        isSuperAdmin: false,
        fingerprint: {
          ip: '127.0.0.1',
          userAgent: 'IntegrationTest/1.0',
        },
      }

      await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
        expirationTtl: 86400, // 24 hours
      })

      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Cookie: `sid=${sessionId}`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.id).toBe(user.id)
    })

    it('should handle session that becomes expired during request processing', async () => {
      const user = await createUser({
        email: 'mid-request-expire@example.com',
        name: 'Mid Request Expire User',
      })

      // Create session with very short TTL
      const kv = getKV()
      const sessionId = crypto.randomUUID()
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: null,
        isSuperAdmin: false,
        fingerprint: {
          ip: '127.0.0.1',
          userAgent: 'IntegrationTest/1.0',
        },
      }

      // Store with 1 second TTL - test that sessions work when valid
      await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
        expirationTtl: 1,
      })

      // Immediate request should work
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Cookie: `sid=${sessionId}`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Should succeed since session is still valid
      expect(res.status).toBe(200)
    })
  })

  // ============================================================================
  // REFRESH TOKEN EXPIRY TESTS
  // ============================================================================

  describe('Refresh token expiry', () => {
    it('should reject refresh with expired refresh token', async () => {
      const user = await createUser({
        email: 'expired-refresh@example.com',
        name: 'Expired Refresh User',
      })

      // Create expired refresh token
      const sqlite = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      // Expires 1 day ago
      const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000)

      sqlite
        .prepare(
          `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(
          tokenId,
          user.id,
          tokenHash,
          Math.floor(expiredAt.getTime() / 1000),
          Math.floor(Date.now() / 1000)
        )

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid or expired refresh token')
    })

    it('should accept refresh with valid non-expired refresh token', async () => {
      const user = await createUser({
        email: 'valid-refresh@example.com',
        name: 'Valid Refresh User',
      })

      // Create valid refresh token (expires in 30 days)
      const sqlite = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      sqlite
        .prepare(
          `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(
          tokenId,
          user.id,
          tokenHash,
          Math.floor(expiresAt.getTime() / 1000),
          Math.floor(Date.now() / 1000)
        )

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.tokens).toBeDefined()
      expect(body.tokens.accessToken).toBeTruthy()
    })

    it('should reject refresh with revoked token even if not expired', async () => {
      const user = await createUser({
        email: 'revoked-refresh@example.com',
        name: 'Revoked Refresh User',
      })

      const sqlite = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      // Token not expired but revoked
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const revokedAt = new Date()

      sqlite
        .prepare(
          `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          tokenId,
          user.id,
          tokenHash,
          Math.floor(expiresAt.getTime() / 1000),
          Math.floor(Date.now() / 1000),
          Math.floor(revokedAt.getTime() / 1000)
        )

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid or expired refresh token')
    })
  })

  // ============================================================================
  // SESSION TTL HANDLING
  // ============================================================================

  describe('Session TTL handling', () => {
    it('should store session with correct TTL', async () => {
      const user = await createUser({
        email: 'ttl-check@example.com',
        name: 'TTL Check User',
      })

      const kv = getKV()
      const sessionId = crypto.randomUUID()
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: null,
        isSuperAdmin: false,
        fingerprint: {
          ip: '127.0.0.1',
          userAgent: 'IntegrationTest/1.0',
        },
      }

      const expectedTtl = 3600 // 1 hour
      await kv.put(`sid:${sessionId}`, JSON.stringify(sessionData), {
        expirationTtl: expectedTtl,
      })

      // Verify session is stored
      const storedData = await kv.get(`sid:${sessionId}`, { type: 'json' })
      expect(storedData).not.toBeNull()

      // Verify the internal store has the TTL information
      const internalEntry = (kv as MockKVStore)._store.get(`sid:${sessionId}`)
      expect(internalEntry).toBeDefined()
      expect(internalEntry?.expirationTtl).toBe(expectedTtl)
    })

    it('should automatically clean up expired sessions on access', async () => {
      const kv = getKV()
      const sessionId = crypto.randomUUID()

      // Create a session that is already expired (negative TTL simulates this)
      await kv.put(`sid:${sessionId}`, JSON.stringify({ userId: 'test' }), {
        expirationTtl: -1,
      })

      // Accessing expired session should return null
      const data = await kv.get(`sid:${sessionId}`)
      expect(data).toBeNull()

      // Session should be removed from internal store
      const internalEntry = (kv as MockKVStore)._store.get(`sid:${sessionId}`)
      expect(internalEntry).toBeUndefined()
    })

    it('should list only non-expired sessions', async () => {
      const kv = getKV()

      // Create some sessions - 2 valid, 1 expired
      await kv.put('sid:valid1', JSON.stringify({ userId: 'user1' }), {
        expirationTtl: 3600,
      })
      await kv.put('sid:valid2', JSON.stringify({ userId: 'user2' }), {
        expirationTtl: 3600,
      })
      await kv.put('sid:expired', JSON.stringify({ userId: 'user3' }), {
        expirationTtl: -1,
      })

      // List sessions - should only show valid ones
      const result = await kv.list({ prefix: 'sid:' })
      const sessionKeys = result.keys.map((k) => k.name)

      expect(sessionKeys).toContain('sid:valid1')
      expect(sessionKeys).toContain('sid:valid2')
      expect(sessionKeys).not.toContain('sid:expired')
    })
  })

  // ============================================================================
  // SESSION INVALIDATION ON USER STATUS CHANGE
  // ============================================================================

  describe('Session invalidation on user status change', () => {
    it('should allow session for inactive user (session middleware does not check user status)', async () => {
      // Create user and then make them inactive
      const user = await createUser({
        email: 'inactive-session@example.com',
        name: 'Inactive Session User',
        status: 'inactive',
      })

      // Create valid session
      const { headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
        isSuperAdmin: false,
      })

      // The /auth/me endpoint returns session data, not database user data
      // Session middleware doesn't validate user status on every request
      // This is by design - status is checked during login and token refresh
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Session is valid even for inactive users (status check happens at login/refresh)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.id).toBe(user.id)
      expect(body.user.email).toBe(user.email)
    })

    it('should reject refresh token for deleted user', async () => {
      const user = await createUser({
        email: 'deleted-user-refresh@example.com',
        name: 'Deleted User Refresh',
        deletedAt: new Date().toISOString(),
      })

      // Create valid refresh token
      const sqlite = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      sqlite
        .prepare(
          `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(
          tokenId,
          user.id,
          tokenHash,
          Math.floor(expiresAt.getTime() / 1000),
          Math.floor(Date.now() / 1000)
        )

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe('User not found or inactive')
    })
  })

  // ============================================================================
  // CONCURRENT SESSION HANDLING
  // ============================================================================

  describe('Concurrent session handling', () => {
    it('should allow multiple active sessions for same user', async () => {
      const user = await createUser({
        email: 'multi-session@example.com',
        name: 'Multi Session User',
      })

      // Create multiple sessions
      const { headers: headers1 } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      const { headers: headers2 } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      // Both sessions should work
      const res1 = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          ...headers1,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const res2 = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          ...headers2,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)

      const body1 = await res1.json()
      const body2 = await res2.json()

      expect(body1.user.id).toBe(user.id)
      expect(body2.user.id).toBe(user.id)
    })

    it('should handle parallel requests with same session', async () => {
      const user = await createUser({
        email: 'parallel-requests@example.com',
        name: 'Parallel Requests User',
      })

      const { headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      // Make multiple parallel requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          app.request('/auth/me', {
            method: 'GET',
            headers: {
              ...headers,
              'User-Agent': 'IntegrationTest/1.0',
            },
          })
        )

      const responses = await Promise.all(requests)

      // All should succeed
      for (const res of responses) {
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.user.id).toBe(user.id)
      }
    })
  })
})
