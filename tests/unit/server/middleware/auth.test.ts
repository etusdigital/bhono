// src/server/middleware/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { sessionAuth, jwtAuth } from '@server/middleware/auth'
import { createUserFixture, createInactiveUserFixture } from '@tests/fixtures/server'
import { createMockEnv, setMockQueryResult } from '@tests/helpers/server'

// Mock the session module
vi.mock('@server/lib/session', () => ({
  getSession: vi.fn(),
}))

// Mock hono/jwt
vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}))

import { getSession } from '@server/lib/session'
import { verify } from 'hono/jwt'

describe('sessionAuth', () => {
  let env: ReturnType<typeof createMockEnv>
  let mockDb: ReturnType<typeof createMockEnv>['DB']['_mock']

  beforeEach(() => {
    vi.clearAllMocks()
    env = createMockEnv()
    mockDb = env.DB._mock
  })

  const createApp = () => {
    const app = new Hono<HonoEnv>()
    // Setup mock db in context + env
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      c.set('db', env.DB)
      await next()
    })
    app.use('*', sessionAuth)
    app.get('/test', (c) => {
      const user = c.get('user')
      return c.json({ success: true, user })
    })
    return app
  }

  const toUserRow = (user: ReturnType<typeof createUserFixture>) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    providerIds: user.providerIds,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
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
    setMockQueryResult(mockDb, ['user-123'], toUserRow(testUser))

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

    // No query result -> user not found

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
    setMockQueryResult(mockDb, ['user-123'], toUserRow(inactiveUser))

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

    setMockQueryResult(mockDb, ['user-123'], toUserRow(testUser))

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
  let env: ReturnType<typeof createMockEnv>
  let mockDb: ReturnType<typeof createMockEnv>['DB']['_mock']

  beforeEach(() => {
    vi.clearAllMocks()
    env = createMockEnv()
    mockDb = env.DB._mock
  })

  const createApp = () => {
    const app = new Hono<HonoEnv>()
    // Setup mock db and env in context
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      c.set('db', env.DB)
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
    setMockQueryResult(mockDb, ['user-123'], {
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      status: testUser.status,
      providerIds: testUser.providerIds,
      isSuperAdmin: testUser.isSuperAdmin,
      createdAt: testUser.createdAt,
      updatedAt: testUser.updatedAt,
      deletedAt: testUser.deletedAt,
    })

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

    // No query result -> user not found

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
    setMockQueryResult(mockDb, ['user-123'], {
      id: inactiveUser.id,
      email: inactiveUser.email,
      name: inactiveUser.name,
      status: inactiveUser.status,
      providerIds: inactiveUser.providerIds,
      isSuperAdmin: inactiveUser.isSuperAdmin,
      createdAt: inactiveUser.createdAt,
      updatedAt: inactiveUser.updatedAt,
      deletedAt: inactiveUser.deletedAt,
    })

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

    setMockQueryResult(mockDb, ['user-123'], {
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      status: testUser.status,
      providerIds: testUser.providerIds,
      isSuperAdmin: testUser.isSuperAdmin,
      createdAt: testUser.createdAt,
      updatedAt: testUser.updatedAt,
      deletedAt: testUser.deletedAt,
    })

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

  it('handles snake_case column names from DB', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    // Use snake_case column names as returned by SQLite
    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      provider_ids: JSON.stringify(['google']),
      is_super_admin: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.providerIds).toEqual(['google'])
    expect(body.user.isSuperAdmin).toBe(true)
  })

  it('handles providerIds as JSON string', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: '["google", "github"]',
      isSuperAdmin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.providerIds).toEqual(['google', 'github'])
  })

  it('handles invalid JSON in providerIds', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: 'invalid-json',
      isSuperAdmin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.providerIds).toEqual([])
  })

  it('handles non-array JSON in providerIds', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: '{"key": "value"}',
      isSuperAdmin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.providerIds).toEqual([])
  })

  it('handles null providerIds', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: null,
      isSuperAdmin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.providerIds).toEqual([])
  })

  it('handles isSuperAdmin as boolean true', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: [],
      isSuperAdmin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.isSuperAdmin).toBe(true)
  })

  it('handles isSuperAdmin as string "1"', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: [],
      isSuperAdmin: '1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.isSuperAdmin).toBe(true)
  })

  it('handles isSuperAdmin as string "true"', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: [],
      isSuperAdmin: 'true',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.isSuperAdmin).toBe(true)
  })

  it('handles deletedAt with value', async () => {
    vi.mocked(verify).mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    })

    const deletedDate = new Date().toISOString()
    setMockQueryResult(mockDb, ['user-123'], {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      providerIds: [],
      isSuperAdmin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted_at: deletedDate,
    })

    const app = createApp()
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.deletedAt).toBe(deletedDate)
  })
})
