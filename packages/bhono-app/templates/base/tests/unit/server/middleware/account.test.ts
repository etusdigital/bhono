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

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isSystemAdminAccess).toBe(true)
    expect(body.userRole).toBe('ADMIN')
  })

  it('normal user with membership proceeds', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // Mock membership exists
    setMockQueryResult(mockDb, ['user-123', 'account-123'], { role: 'VIEWER' })

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

    // Mock membership with ADMIN role
    setMockQueryResult(mockDb, ['user-123', 'account-123'], { role: 'ADMIN' })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userRole).toBe('ADMIN')
    expect(body.isSystemAdminAccess).toBe(false)
  })

  it('sets userRole VIEWER for viewer membership', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // Mock membership with VIEWER role
    setMockQueryResult(mockDb, ['user-123', 'account-123'], { role: 'VIEWER' })

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userRole).toBe('VIEWER')
  })

  it('throws 403 when user has no membership', async () => {
    const testUser = createUserFixture({ id: 'user-123' })
    const app = createApp((app) => {
      app.use('*', async (c, next) => {
        c.set('user', testUser)
        await next()
      })
    })

    // No query result -> no membership

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })

    expect(res.status).toBe(403)
  })
})
