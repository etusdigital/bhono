// src/server/middleware/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sessionAuth, jwtAuth } from './auth'
import { createUserFixture, createInactiveUserFixture } from '../__tests__/fixtures'

// Mock the session module
vi.mock('../lib/session', () => ({
  getSession: vi.fn(),
}))

// Mock hono/jwt
vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}))

import { getSession } from '../lib/session'
import { verify } from 'hono/jwt'

describe('sessionAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createApp = () => {
    const app = new Hono()
    // Setup mock db in context
    app.use('*', async (c, next) => {
      c.set('db', mockDb)
      await next()
    })
    app.use('*', sessionAuth)
    app.get('/test', (c) => {
      const user = c.get('user')
      return c.json({ success: true, user })
    })
    return app
  }

  // Create mock database
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    }
  })

  it('calls next() when valid session exists', async () => {
    const testUser = createUserFixture({ id: 'user-123', email: 'test@example.com' })

    // Mock session exists
    vi.mocked(getSession).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isSuperAdmin: false,
    })

    // Mock db returns user
    mockDb.limit.mockResolvedValue([testUser])

    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.user.id).toBe('user-123')
  })

  it('throws 401 when no session', async () => {
    vi.mocked(getSession).mockReturnValue(null)

    const app = createApp()
    const res = await app.request('/test')

    expect(res.status).toBe(401)
  })

  it('throws 401 when user not found', async () => {
    vi.mocked(getSession).mockReturnValue({
      userId: 'nonexistent-user',
      email: 'test@example.com',
      name: 'Test User',
      isSuperAdmin: false,
    })

    // Mock db returns empty array (user not found)
    mockDb.limit.mockResolvedValue([])

    const app = createApp()
    const res = await app.request('/test')

    expect(res.status).toBe(401)
  })

  it('throws 401 when user is inactive', async () => {
    const inactiveUser = createInactiveUserFixture({ id: 'user-123' })

    vi.mocked(getSession).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isSuperAdmin: false,
    })

    // Mock db returns inactive user
    mockDb.limit.mockResolvedValue([inactiveUser])

    const app = createApp()
    const res = await app.request('/test')

    expect(res.status).toBe(401)
  })

  it('sets user in context with correct fields', async () => {
    const testUser = createUserFixture({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: ['google', 'github'],
      isSuperAdmin: true,
    })

    vi.mocked(getSession).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isSuperAdmin: true,
    })

    mockDb.limit.mockResolvedValue([testUser])

    const app = createApp()
    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toMatchObject({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: ['google', 'github'],
      isSuperAdmin: true,
    })
  })
})

describe('jwtAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Create mock database
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    }
  })

  const createApp = () => {
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    // Setup mock db and env in context
    app.use('*', async (c, next) => {
      c.set('db', mockDb)
      ;(c.env as any) = { JWT_SECRET: 'test-secret' }
      await next()
    })
    app.use('*', jwtAuth)
    app.get('/test', (c) => {
      const user = c.get('user')
      return c.json({ success: true, user })
    })
    return app
  }

  it('calls next() when valid JWT provided', async () => {
    const testUser = createUserFixture({ id: 'user-123', email: 'test@example.com' })

    // Mock JWT verification
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    // Mock db returns user
    mockDb.limit.mockResolvedValue([testUser])

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.user.id).toBe('user-123')
  })

  it('throws 401 when Authorization header missing', async () => {
    const app = createApp()
    const res = await app.request('/test')

    expect(res.status).toBe(401)
  })

  it('throws 401 when Authorization header format invalid', async () => {
    const app = createApp()

    // Test with wrong scheme
    const res1 = await app.request('/test', {
      headers: { Authorization: 'Basic some-token' },
    })
    expect(res1.status).toBe(401)

    // Test with no token
    const res2 = await app.request('/test', {
      headers: { Authorization: 'Bearer ' },
    })
    expect(res2.status).toBe(401)

    // Test with Bearer only
    const res3 = await app.request('/test', {
      headers: { Authorization: 'Bearer' },
    })
    expect(res3.status).toBe(401)
  })

  it('throws 401 when JWT invalid/expired', async () => {
    // Mock JWT verification to throw error
    vi.mocked(verify).mockRejectedValue(new Error('Invalid token'))

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    })

    expect(res.status).toBe(401)
  })

  it('throws 401 when payload missing sub', async () => {
    // Mock JWT verification without sub claim
    vi.mocked(verify).mockResolvedValue({
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer token-without-sub' },
    })

    expect(res.status).toBe(401)
  })

  it('throws 401 when user not found', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'nonexistent-user',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    // Mock db returns empty array
    mockDb.limit.mockResolvedValue([])

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(401)
  })

  it('throws 401 when user is inactive', async () => {
    const inactiveUser = createInactiveUserFixture({ id: 'user-123' })

    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    // Mock db returns inactive user
    mockDb.limit.mockResolvedValue([inactiveUser])

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(401)
  })

  it('sets user in context with correct fields', async () => {
    const testUser = createUserFixture({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: ['google'],
      isSuperAdmin: false,
    })

    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    mockDb.limit.mockResolvedValue([testUser])

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user).toMatchObject({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: ['google'],
      isSuperAdmin: false,
    })
  })
})
