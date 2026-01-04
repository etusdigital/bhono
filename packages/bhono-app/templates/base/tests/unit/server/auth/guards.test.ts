import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requireRole, requirePermission } from '@server/guards'
import type { HonoEnv } from '@server/types'

describe('guards', () => {
  describe('requireRole', () => {
    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requireRole('ADMIN'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should allow access when user is system admin', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', true)
        return next()
      })
      app.use('*', requireRole('ADMIN'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should throw 403 when user has no role assigned', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', undefined)
        return next()
      })
      app.use('*', requireRole('ADMIN'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 403 when user has insufficient role', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'VIEWER')
        return next()
      })
      app.use('*', requireRole('ADMIN'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow access when user has sufficient role', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'ADMIN')
        return next()
      })
      app.use('*', requireRole('ADMIN'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should allow access with additional roles', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'BILLING')
        return next()
      })
      app.use('*', requireRole('EDITOR', ['BILLING']))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })
  })

  describe('requirePermission', () => {
    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requirePermission('accounts:manage'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should allow access when user is system admin', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', true)
        return next()
      })
      app.use('*', requirePermission('accounts:manage'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should throw 403 when user has no role assigned', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', undefined)
        return next()
      })
      app.use('*', requirePermission('accounts:manage'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 403 when user lacks permission', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'VIEWER')
        return next()
      })
      app.use('*', requirePermission('accounts:manage'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow access when user has permission via role', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'ADMIN')
        return next()
      })
      // ADMIN has VIEW_ALL_USERS permission
      app.use('*', requirePermission('VIEW_ALL_USERS'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })
  })
})
