// src/server/middleware/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { sessionAuth } from '@server/middleware/auth'
import { createUserFixture, createInactiveUserFixture } from '@tests/fixtures/server'
import { createMockEnv, setMockQueryResult } from '@tests/helpers/server'

// Mock the session module
vi.mock('@server/lib/session', () => ({
  getSession: vi.fn(),
}))

import { getSession } from '@server/lib/session'

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
