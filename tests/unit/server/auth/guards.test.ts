// tests/unit/server/auth/guards.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requireRole } from '@server/auth/guards'
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

    it('should allow access when user is system admin (bypass)', async () => {
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
        c.set('userRole', null)
        return next()
      })
      app.use('*', requireRole('ADMIN'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 403 when user has insufficient role (VIEWER trying to access ADMIN)', async () => {
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

    it('should allow access when user has exact required role', async () => {
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

    it('should allow access when user has higher role than required', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'ADMIN')
        return next()
      })
      // ADMIN should have access to EDITOR-required endpoints
      app.use('*', requireRole('EDITOR'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should deny access when user has lower role than required', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'AUTHOR')
        return next()
      })
      // AUTHOR should NOT have access to MANAGER-required endpoints
      app.use('*', requireRole('MANAGER'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    describe('additionalRoles parameter', () => {
      it('should allow access via additionalRoles for non-hierarchical roles', async () => {
        const app = new Hono<HonoEnv>()
        app.use('*', (c, next) => {
          c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
          c.set('isSystemAdminAccess', false)
          c.set('userRole', 'ANALYTICS')
          return next()
        })
        // ANALYTICS is non-hierarchical but granted access via additionalRoles
        app.use('*', requireRole('ADMIN', ['ANALYTICS']))
        app.get('/', (c) => c.json({ ok: true }))

        const res = await app.request('/')
        expect(res.status).toBe(200)
      })

      it('should deny when role not in additionalRoles', async () => {
        const app = new Hono<HonoEnv>()
        app.use('*', (c, next) => {
          c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
          c.set('isSystemAdminAccess', false)
          c.set('userRole', 'BILLING')
          return next()
        })
        // BILLING is non-hierarchical and not in additionalRoles
        app.use('*', requireRole('ADMIN', ['ANALYTICS']))
        app.get('/', (c) => c.json({ ok: true }))

        const res = await app.request('/')
        expect(res.status).toBe(403)
      })
    })
  })
})
