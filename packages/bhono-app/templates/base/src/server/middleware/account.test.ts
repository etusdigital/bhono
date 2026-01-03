// src/server/middleware/account.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { accountMiddleware } from './account'
import { createUserFixture, createSuperAdminFixture } from '../__tests__/fixtures'

describe('accountMiddleware', () => {
  // Create mock database
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    }
  })

  const createApp = (setupUser?: (app: Hono) => void) => {
    const app = new Hono()
    // Setup mock db in context
    app.use('*', async (c, next) => {
      c.set('db', mockDb)
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
    mockDb.limit.mockResolvedValue([
      { userId: 'user-123', accountId: 'account-123', role: 'VIEWER' },
    ])

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
    mockDb.limit.mockResolvedValue([
      { userId: 'user-123', accountId: 'account-123', role: 'ADMIN' },
    ])

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
    mockDb.limit.mockResolvedValue([
      { userId: 'user-123', accountId: 'account-123', role: 'VIEWER' },
    ])

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

    // Mock no membership found
    mockDb.limit.mockResolvedValue([])

    const res = await app.request('/test', {
      headers: { 'account-id': 'account-123' },
    })

    expect(res.status).toBe(403)
  })
})
