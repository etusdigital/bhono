import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requireRole, requirePermission, requireAnyPermission, requireAllPermissions, requireSuperAdmin } from '@server/auth/guards'
import { Permission } from '@server/auth/permissions'
import type { HonoEnv } from '@server/types'

describe('guards', () => {
  describe('requireRole', () => {
    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requireRole('admin'))
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
      app.use('*', requireRole('admin'))
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
      app.use('*', requireRole('admin'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 403 when user has insufficient role', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        return next()
      })
      app.use('*', requireRole('admin'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow access when user has sufficient role', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'admin')
        return next()
      })
      app.use('*', requireRole('admin'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should allow access when user has higher role than required', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'admin')
        return next()
      })
      // Admin role should have access to user-required endpoints
      app.use('*', requireRole('user'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should deny access when user has lower role than required', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'user')
        return next()
      })
      // user role should NOT have access to manager-required endpoints
      app.use('*', requireRole('manager'))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })
  })

  describe('requirePermission', () => {
    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requirePermission(Permission.ACCOUNT_UPDATE))
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
      app.use('*', requirePermission(Permission.ACCOUNT_UPDATE))
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
      app.use('*', requirePermission(Permission.ACCOUNT_UPDATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 403 when user lacks permission', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        return next()
      })
      // viewer does not have DATA_CREATE permission
      app.use('*', requirePermission(Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow access when user has permission via role', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'admin')
        return next()
      })
      // admin has ACCOUNT_UPDATE permission
      app.use('*', requirePermission(Permission.ACCOUNT_UPDATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should block write operations when read-only mode is enabled', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'admin')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // DATA_CREATE is a write operation
      app.use('*', requirePermission(Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow read operations when read-only mode is enabled', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // DATA_READ is a read operation
      app.use('*', requirePermission(Permission.DATA_READ))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })
  })

  describe('requireAnyPermission', () => {
    it('should allow access when user has any of the permissions', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'user')
        return next()
      })
      // user has DATA_READ but not ACCOUNT_UPDATE
      app.use('*', requireAnyPermission(Permission.DATA_READ, Permission.ACCOUNT_UPDATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should deny access when user has none of the permissions', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        return next()
      })
      // viewer has neither DATA_CREATE nor ACCOUNT_UPDATE
      app.use('*', requireAnyPermission(Permission.DATA_CREATE, Permission.ACCOUNT_UPDATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requireAnyPermission(Permission.DATA_READ, Permission.ACCOUNT_UPDATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should allow access when user is system admin (lines 247-248)', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', true)
        // No userRole set - system admin should bypass role check entirely
        return next()
      })
      app.use('*', requireAnyPermission(Permission.ACCOUNT_UPDATE, Permission.BILLING_MANAGE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should throw 403 when user has no role assigned (line 254)', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', undefined)
        return next()
      })
      app.use('*', requireAnyPermission(Permission.DATA_READ, Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should block all write permissions in read-only mode when all are write', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'admin')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // All write permissions - should be blocked
      app.use('*', requireAnyPermission(Permission.DATA_CREATE, Permission.DATA_UPDATE, Permission.DATA_DELETE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should skip write permissions and check read permissions in read-only mode (line 263)', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // Mixed permissions - DATA_CREATE is write (should be skipped), DATA_READ is read (viewer has it)
      app.use('*', requireAnyPermission(Permission.DATA_CREATE, Permission.DATA_READ))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      // Should succeed because DATA_READ is available even though DATA_CREATE is filtered out
      expect(res.status).toBe(200)
    })

    it('should deny when read permissions exist but user lacks them in read-only mode', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // Mixed: DATA_CREATE (write, filtered), BILLING_READ (read, viewer doesn't have)
      app.use('*', requireAnyPermission(Permission.DATA_CREATE, Permission.BILLING_READ))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      // Should fail because write is filtered and viewer lacks BILLING_READ
      expect(res.status).toBe(403)
    })
  })

  describe('requireAllPermissions', () => {
    it('should allow access when user has all permissions', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'user')
        return next()
      })
      // user has both DATA_READ and DATA_CREATE
      app.use('*', requireAllPermissions(Permission.DATA_READ, Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should deny access when user is missing any permission', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        return next()
      })
      // viewer has DATA_READ but not DATA_CREATE
      app.use('*', requireAllPermissions(Permission.DATA_READ, Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requireAllPermissions(Permission.DATA_READ, Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should allow access when user is system admin (lines 160-161)', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', true)
        // No userRole set - system admin should bypass entirely
        return next()
      })
      app.use('*', requireAllPermissions(Permission.ACCOUNT_UPDATE, Permission.BILLING_MANAGE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })

    it('should throw 403 when user has no role assigned (line 167)', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', undefined)
        return next()
      })
      app.use('*', requireAllPermissions(Permission.DATA_READ, Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should block write permissions in read-only mode (lines 145-149)', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'admin')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // All required, includes write permission DATA_CREATE
      app.use('*', requireAllPermissions(Permission.DATA_READ, Permission.DATA_CREATE))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow read-only permissions in read-only mode', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test' } as any)
        c.set('isSystemAdminAccess', false)
        c.set('userRole', 'viewer')
        c.set('readOnly', true) // Suspended account
        return next()
      })
      // Both are read permissions - should be allowed
      app.use('*', requireAllPermissions(Permission.DATA_READ, Permission.DASHBOARD_READ))
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })
  })

  describe('requireSuperAdmin', () => {
    it('should throw 401 when user is not authenticated', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', requireSuperAdmin())
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should throw 403 when user is not a super admin', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test', isSuperAdmin: false } as any)
        return next()
      })
      app.use('*', requireSuperAdmin())
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(403)
    })

    it('should allow access when user is a super admin', async () => {
      const app = new Hono<HonoEnv>()
      app.use('*', (c, next) => {
        c.set('user', { id: 'test-id', email: 'test@test.com', name: 'Test', isSuperAdmin: true } as any)
        return next()
      })
      app.use('*', requireSuperAdmin())
      app.get('/', (c) => c.json({ ok: true }))

      const res = await app.request('/')
      expect(res.status).toBe(200)
    })
  })
})
