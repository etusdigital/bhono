/**
 * Refresh Token Integration Tests
 *
 * Tests the refresh token flow:
 * - Token refresh endpoint
 * - Token revocation
 * - Expired token handling
 * - Invalid token handling
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import { createUser, createUserSession } from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { auth } from '../../../src/server/routes/auth'
import { sessionMiddleware } from '../../../src/server/lib/session'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { hashToken, generateRefreshToken, getRefreshTokenExpiry } from '../../../src/server/lib/tokens'

/**
 * Creates a database wrapper
 */
function createTestDb() {
  return getDb()
}

describe('Refresh Token Integration', () => {
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

  describe('POST /auth/refresh', () => {
    it('should return 401 when no refresh token cookie is present', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe('No refresh token')
    })

    it('should return 401 for invalid refresh token', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: 'refresh_token=invalid_token_that_does_not_exist',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid or expired refresh token')
    })

    it('should return 401 for expired refresh token', async () => {
      const user = await createUser({ email: 'expiredtoken@example.com', name: 'Expired Token User' })

      // Create an expired refresh token directly in the database
      const db = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      // Expires 1 day ago
      const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000)

      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
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

    it('should return 401 for revoked refresh token', async () => {
      const user = await createUser({ email: 'revokedtoken@example.com', name: 'Revoked Token User' })

      // Create a revoked refresh token
      const db = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      // Valid expiry, but revoked
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const revokedAt = new Date()

      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
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

    it('should return 401 if user is inactive', async () => {
      const user = await createUser({
        email: 'inactiverefresh@example.com',
        name: 'Inactive User',
        status: 'inactive',
      })

      // Create a valid refresh token
      const db = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
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

    it('should return 401 if user is deleted', async () => {
      const user = await createUser({
        email: 'deletedrefresh@example.com',
        name: 'Deleted User',
        deletedAt: new Date().toISOString(),
      })

      // Create a valid refresh token
      const db = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
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

    it('should return new access token for valid refresh token', async () => {
      const user = await createUser({
        email: 'validrefresh@example.com',
        name: 'Valid Refresh User',
      })

      // Create a valid refresh token
      const db = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
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
      expect(body).toHaveProperty('tokens')
      expect(body.tokens).toHaveProperty('accessToken')
      expect(body.tokens).toHaveProperty('expiresIn')
      expect(body.tokens.accessToken).toBeTruthy()
      expect(body.tokens.expiresIn).toBe(60 * 15) // 15 minutes
    })

    it('should log TOKEN_REFRESH audit event on successful refresh', async () => {
      const user = await createUser({
        email: 'auditrefresh@example.com',
        name: 'Audit Refresh User',
      })

      // Create a valid refresh token
      const db = getSqlite()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        tokenId,
        user.id,
        tokenHash,
        Math.floor(expiresAt.getTime() / 1000),
        Math.floor(Date.now() / 1000)
      )

      await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `refresh_token=${refreshToken}`,
        },
      })

      // Verify audit log was created
      const auditLogs = db.prepare(`
        SELECT * FROM audit_logs WHERE user_id = ? AND action = 'TOKEN_REFRESH'
      `).all(user.id) as any[]

      expect(auditLogs.length).toBe(1)
      expect(auditLogs[0].entity).toBe('Auth')
      expect(auditLogs[0].entity_id).toBe(user.id)
    })
  })

  describe('Token Utility Functions', () => {
    it('generateRefreshToken should generate unique tokens', () => {
      const token1 = generateRefreshToken()
      const token2 = generateRefreshToken()

      expect(token1).not.toBe(token2)
      expect(token1.length).toBe(64) // 32 bytes as hex
      expect(token2.length).toBe(64)
    })

    it('hashToken should produce consistent hashes', async () => {
      const token = 'test_token_value'
      const hash1 = await hashToken(token)
      const hash2 = await hashToken(token)

      expect(hash1).toBe(hash2)
      expect(hash1.length).toBe(64) // SHA-256 as hex
    })

    it('hashToken should produce different hashes for different tokens', async () => {
      const hash1 = await hashToken('token1')
      const hash2 = await hashToken('token2')

      expect(hash1).not.toBe(hash2)
    })

    it('getRefreshTokenExpiry should return future date', () => {
      const expiry = getRefreshTokenExpiry(env)

      expect(expiry).toBeInstanceOf(Date)
      expect(expiry.getTime()).toBeGreaterThan(Date.now())
    })

    it('getRefreshTokenExpiry should respect REFRESH_TOKEN_EXPIRY_DAYS env', () => {
      const expiry = getRefreshTokenExpiry(env)
      const expectedDays = Number.parseInt(String(env.REFRESH_TOKEN_EXPIRY_DAYS) || '30', 10)

      const now = new Date()
      const expectedMinTime = now.getTime() + (expectedDays - 1) * 24 * 60 * 60 * 1000
      const expectedMaxTime = now.getTime() + (expectedDays + 1) * 24 * 60 * 60 * 1000

      expect(expiry.getTime()).toBeGreaterThan(expectedMinTime)
      expect(expiry.getTime()).toBeLessThan(expectedMaxTime)
    })
  })
})
