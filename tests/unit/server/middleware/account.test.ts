// src/server/middleware/account.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { accountMiddleware } from '@server/middleware/account'
import { createUserFixture, createSuperAdminFixture } from '@tests/fixtures/server'
import { createMockEnv, setMockQueryResult } from '@tests/helpers/server'

describe('accountMiddleware', () => {
  let env: ReturnType<typeof createMockEnv>
  let mockDb: ReturnType<typeof createMockEnv>['DB']['_mock']

  beforeEach(() => {
    vi.clearAllMocks()
    env = createMockEnv()
    mockDb = env.DB._mock
  })

  const createApp = (setupUser?: (app: Hono) => void) => {
    const app = new Hono<HonoEnv>()
    // Setup mock db in context + env
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      c.set('db', env.DB)
      await next()
    })
    // Setup user if provided
    if (setupUser) {
      setupUser(app)
    }
    app.use('*', accountMiddleware)
    app.get('/test', (c) => {
      return c.json({
        success: true,
        accountId: c.get('accountId'),
        userRole: c.get('userRole'),
        isSystemAdminAccess: c.get('isSystemAdminAccess'),
      })
    })
    return app
  }

  it('throws 400 when account-id header missing', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    const res = await app.request('/test')
    // No account-id header

    expect(res.status).toBe(400)
  })

  it('throws 401 when user not authenticated', async () => {
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', null)
        await next()
      })
    })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })

    expect(res.status).toBe(401)
  })

  it('super admin can access any account', async () => {
    const superAdmin = createSuperAdminFixture({ id: 'super-admin-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', superAdmin)
        await next()
      })
    })

    // Mock account exists
    setMockQueryResult(mockDb, ['any-account-id'], { status: 'active', deleted_at: null })

    const res = await app.request('/test', {
      headers: { 'account-id': 'any-account-id' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.accountId).toBe('any-account-id')
  })

  it('sets isSystemAdminAccess=true for super admin', async () => {
    const superAdmin = createSuperAdminFixture({ id: 'super-admin-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', superAdmin)
        await next()
      })
    })

    // Mock account exists
    setMockQueryResult(mockDb, ['account-123'], { status: 'active', deleted_at: null })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isSystemAdminAccess).toBe(true)
    expect(body.userRole).toBe('admin')
  })

  it('normal user with membership proceeds', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // Mock account exists (first query)
    setMockQueryResult(mockDb, ['account-123'], { status: 'active', deleted_at: null })
    // Mock membership exists (second query)
    setMockQueryResult(mockDb, ['user-123', 'account-123'], { role: 'viewer', deleted_at: null })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.accountId).toBe('account-123')
  })

  it('sets userRole from membership', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // Mock account exists (first query)
    setMockQueryResult(mockDb, ['account-123'], { status: 'active', deleted_at: null })
    // Mock membership with admin role (second query)
    setMockQueryResult(mockDb, ['user-123', 'account-123'], { role: 'admin', deleted_at: null })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userRole).toBe('admin')
    expect(body.isSystemAdminAccess).toBe(false)
  })

  it('sets userRole viewer for viewer membership', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // Mock account exists (first query)
    setMockQueryResult(mockDb, ['account-123'], { status: 'active', deleted_at: null })
    // Mock membership with viewer role (second query)
    setMockQueryResult(mockDb, ['user-123', 'account-123'], { role: 'viewer', deleted_at: null })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userRole).toBe('viewer')
  })

  it('throws 403 when user has no membership', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // Mock account exists (first query)
    setMockQueryResult(mockDb, ['account-123'], { status: 'active', deleted_at: null })
    // No membership query result -> should return 403

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })

    expect(res.status).toBe(403)
  })
})
