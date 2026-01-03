/**
 * Integration tests for auth middleware
 * Tests sessionAuth and jwtAuth middleware functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '../../../src/server/types'
import { sessionAuth, jwtAuth } from '../../../src/server/middleware/auth'
import { sessionMiddleware } from '../../../src/server/lib/session'
import {
  getEnv,
  getDb,
  getKV,
  seedUser,
  createSession,
  clearDatabase,
} from '../setup'

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return (target as any).run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('Auth Middleware', () => {
  let app: Hono<HonoEnv>

  beforeEach(async () => {
    await clearDatabase()

    // Create a fresh app for each test
    app = new Hono<HonoEnv>()

    // Add error handler for HTTPException
    app.onError((err, c) => {
      if (err instanceof HTTPException) {
        return c.json({ message: err.message }, err.status)
      }
      return c.json({ message: 'Internal Server Error' }, 500)
    })

    // Inject env and db into context
    app.use('*', async (c, next) => {
      const env = getEnv()
      ;(c as any).env = env

      // Set up the db for middleware (use the test drizzle instance with proxy)
      const db = createTestDb()
      c.set('db', db)

      await next()
    })

    // Add session middleware to read session from KV
    app.use('*', sessionMiddleware())
  })

  describe('sessionAuth', () => {
    beforeEach(() => {
      // Add protected route using sessionAuth
      app.use('/protected/*', sessionAuth)
      app.get('/protected/resource', (c) => {
        const user = c.get('user')
        return c.json({ user })
      })
    })

    it('should return 401 when no session cookie is present', async () => {
      const res = await app.request('/protected/resource')

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Not authenticated')
    })

    it('should return 401 when session cookie is invalid', async () => {
      const res = await app.request('/protected/resource', {
        headers: {
          Cookie: 'sid=invalid-session-id',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Not authenticated')
    })

    it('should return 401 when session exists but user is not found', async () => {
      // Create session for non-existent user
      const kv = getKV()
      await kv.put(
        'sid:orphan-session',
        JSON.stringify({
          userId: 'non-existent-user-id',
          email: 'ghost@example.com',
          name: 'Ghost User',
          avatarUrl: null,
          isSuperAdmin: false,
          fingerprint: { ip: '127.0.0.1', userAgent: 'Test' },
        }),
        { expirationTtl: 86400 }
      )

      const res = await app.request('/protected/resource', {
        headers: {
          Cookie: 'sid=orphan-session',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('User not found')
    })

    it('should return 401 when user account is inactive', async () => {
      // Create inactive user
      const user = await seedUser({
        email: 'inactive@example.com',
        name: 'Inactive User',
        status: 'inactive',
      })

      // Create session for inactive user
      const { sessionId } = await createSession(user.id, {
        email: user.email,
        name: user.name,
      })

      const res = await app.request('/protected/resource', {
        headers: {
          Cookie: `sid=${sessionId}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('User account is not active')
    })

    it('should set user in context and allow access for valid session', async () => {
      // Create active user
      const user = await seedUser({
        email: 'active@example.com',
        name: 'Active User',
        status: 'active',
      })

      // Create session
      const { sessionId } = await createSession(user.id, {
        email: user.email,
        name: user.name,
      })

      const res = await app.request('/protected/resource', {
        headers: {
          Cookie: `sid=${sessionId}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user).toBeDefined()
      expect(body.user.id).toBe(user.id)
      expect(body.user.email).toBe(user.email)
      expect(body.user.name).toBe(user.name)
      expect(body.user.status).toBe('active')
    })

    it('should set isSuperAdmin flag correctly', async () => {
      // Create super admin user
      const user = await seedUser({
        email: 'admin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })

      const { sessionId } = await createSession(user.id, {
        email: user.email,
        name: user.name,
        isSuperAdmin: true,
      })

      const res = await app.request('/protected/resource', {
        headers: {
          Cookie: `sid=${sessionId}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.isSuperAdmin).toBe(true)
    })

    it('should return 401 when user is soft-deleted', async () => {
      // Create user and then soft-delete
      const user = await seedUser({
        email: 'deleted@example.com',
        name: 'Deleted User',
      })

      // Soft delete the user
      const { getSqlite } = await import('../setup')
      const sqlite = getSqlite()
      sqlite.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(user.id)

      const { sessionId } = await createSession(user.id, {
        email: user.email,
        name: user.name,
      })

      const res = await app.request('/protected/resource', {
        headers: {
          Cookie: `sid=${sessionId}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('User not found')
    })
  })

  describe('jwtAuth', () => {
    beforeEach(() => {
      // Add protected route using jwtAuth
      app.use('/api/*', jwtAuth)
      app.get('/api/resource', (c) => {
        const user = c.get('user')
        return c.json({ user })
      })
    })

    it('should return 401 when no Authorization header is present', async () => {
      const res = await app.request('/api/resource')

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Missing authorization header')
    })

    it('should return 401 when Authorization header format is invalid', async () => {
      const res = await app.request('/api/resource', {
        headers: {
          Authorization: 'InvalidFormat token123',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Invalid authorization header format. Expected: Bearer <token>')
    })

    it('should return 401 when Authorization header has no token', async () => {
      const res = await app.request('/api/resource', {
        headers: {
          Authorization: 'Bearer',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Invalid authorization header format. Expected: Bearer <token>')
    })

    it('should return 401 when JWT is invalid', async () => {
      const res = await app.request('/api/resource', {
        headers: {
          Authorization: 'Bearer invalid.jwt.token',
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Invalid or expired token')
    })

    it('should return 401 when JWT is expired', async () => {
      const env = getEnv()

      // Create expired token (exp in the past)
      const expiredToken = await sign(
        {
          sub: 'test-user-id',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Invalid or expired token')
    })

    it('should return 401 when JWT payload is missing sub', async () => {
      const env = getEnv()

      // Create token without sub claim
      const tokenWithoutSub = await sign(
        {
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${tokenWithoutSub}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Invalid token payload: missing sub')
    })

    it('should return 401 when user is not found', async () => {
      const env = getEnv()

      // Create valid token for non-existent user
      const token = await sign(
        {
          sub: 'non-existent-user-id',
          email: 'ghost@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('User not found')
    })

    it('should return 401 when user account is inactive', async () => {
      const env = getEnv()

      // Create inactive user
      const user = await seedUser({
        email: 'inactive@example.com',
        name: 'Inactive User',
        status: 'inactive',
      })

      // Create valid token for inactive user
      const token = await sign(
        {
          sub: user.id,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('User account is not active')
    })

    it('should set user in context for valid JWT', async () => {
      const env = getEnv()

      // Create active user
      const user = await seedUser({
        email: 'valid@example.com',
        name: 'Valid User',
        status: 'active',
      })

      // Create valid token
      const token = await sign(
        {
          sub: user.id,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user).toBeDefined()
      expect(body.user.id).toBe(user.id)
      expect(body.user.email).toBe(user.email)
      expect(body.user.name).toBe(user.name)
    })

    it('should return 401 when user is soft-deleted', async () => {
      const env = getEnv()

      // Create user and soft-delete
      const user = await seedUser({
        email: 'deleted@example.com',
        name: 'Deleted User',
      })

      // Soft delete the user
      const { getSqlite } = await import('../setup')
      const sqlite = getSqlite()
      sqlite.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(user.id)

      // Create valid token
      const token = await sign(
        {
          sub: user.id,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('User not found')
    })

    it('should set isSuperAdmin flag correctly', async () => {
      const env = getEnv()

      // Create super admin user
      const user = await seedUser({
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })

      // Create valid token
      const token = await sign(
        {
          sub: user.id,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET
      )

      const res = await app.request('/api/resource', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.isSuperAdmin).toBe(true)
    })
  })
})
