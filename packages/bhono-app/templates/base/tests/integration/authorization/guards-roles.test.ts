/**
 * Guards and Roles Integration Tests
 *
 * Tests the RBAC utility functions and guard middleware:
 * - Role hierarchy (hasMinimumRole, getRolesWithMinimumAccess)
 * - Role comparison (compareRoles, isRoleHigherThan)
 * - Role utilities (getAllRoles, getRoleLevel, isHierarchicalRole)
 * - Permission checking (hasPermission, hasAnyPermission, hasAllPermissions)
 * - Guard middleware (requireRole, requirePermission)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getKV, type TestEnv } from '../setup'
import { createTestScenario, createUser, createUserSession, createAccount, addUserToAccount } from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { sessionMiddleware } from '../../../src/server/lib/session'
import { sessionAuth } from '../../../src/server/middleware/auth'
import { accountMiddleware } from '../../../src/server/middleware/account'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { requireRole, requirePermission } from '../../../src/server/auth/guards'
import {
  Role,
  hasMinimumRole,
  getRolesWithMinimumAccess,
  isHierarchicalRole,
  getRoleLevel,
  getAllRoles,
  compareRoles,
  isRoleHigherThan,
} from '../../../src/server/auth/roles'
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../../../src/server/auth/permissions'

/**
 * Creates a database wrapper
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('Role Utility Functions', () => {
  describe('Role constants', () => {
    it('should have all expected roles defined', () => {
      expect(Role.ADMIN).toBe('ADMIN')
      expect(Role.MANAGER).toBe('MANAGER')
      expect(Role.EDITOR).toBe('EDITOR')
      expect(Role.AUTHOR).toBe('AUTHOR')
      expect(Role.VIEWER).toBe('VIEWER')
      expect(Role.BILLING).toBe('BILLING')
      expect(Role.ANALYTICS).toBe('ANALYTICS')
    })
  })

  describe('hasMinimumRole', () => {
    it('should return true when user has exact required role', () => {
      expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
      expect(hasMinimumRole('MANAGER', 'MANAGER')).toBe(true)
      expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true)
    })

    it('should return true when user has higher role', () => {
      expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true)
      expect(hasMinimumRole('ADMIN', 'EDITOR')).toBe(true)
      expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
      expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
      expect(hasMinimumRole('MANAGER', 'VIEWER')).toBe(true)
      expect(hasMinimumRole('EDITOR', 'AUTHOR')).toBe(true)
      expect(hasMinimumRole('EDITOR', 'VIEWER')).toBe(true)
    })

    it('should return false when user has lower role', () => {
      expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
      expect(hasMinimumRole('VIEWER', 'MANAGER')).toBe(false)
      expect(hasMinimumRole('EDITOR', 'ADMIN')).toBe(false)
      expect(hasMinimumRole('AUTHOR', 'EDITOR')).toBe(false)
    })

    it('should handle non-hierarchical roles (BILLING, ANALYTICS)', () => {
      // Non-hierarchical roles only match exactly
      expect(hasMinimumRole('BILLING', 'BILLING')).toBe(true)
      expect(hasMinimumRole('ANALYTICS', 'ANALYTICS')).toBe(true)

      // They don't satisfy hierarchical requirements
      expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
      expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)

      // Hierarchical roles don't satisfy non-hierarchical
      expect(hasMinimumRole('ADMIN', 'BILLING')).toBe(false)
      expect(hasMinimumRole('ADMIN', 'ANALYTICS')).toBe(false)
    })

    it('should respect additionalRoles parameter', () => {
      // BILLING can access VIEWER routes if in additionalRoles
      expect(hasMinimumRole('BILLING', 'VIEWER', ['BILLING'])).toBe(true)
      expect(hasMinimumRole('ANALYTICS', 'EDITOR', ['ANALYTICS'])).toBe(true)

      // But not if not in additionalRoles
      expect(hasMinimumRole('BILLING', 'VIEWER', ['ANALYTICS'])).toBe(false)
    })
  })

  describe('getRolesWithMinimumAccess', () => {
    it('should return all roles at or above minimum level', () => {
      const viewerRoles = getRolesWithMinimumAccess('VIEWER')
      expect(viewerRoles).toContain('VIEWER')
      expect(viewerRoles).toContain('AUTHOR')
      expect(viewerRoles).toContain('EDITOR')
      expect(viewerRoles).toContain('MANAGER')
      expect(viewerRoles).toContain('ADMIN')
    })

    it('should only return ADMIN for ADMIN minimum', () => {
      const adminRoles = getRolesWithMinimumAccess('ADMIN')
      expect(adminRoles).toContain('ADMIN')
      expect(adminRoles.length).toBe(1)
    })

    it('should include additionalRoles', () => {
      const roles = getRolesWithMinimumAccess('VIEWER', ['BILLING', 'ANALYTICS'])
      expect(roles).toContain('BILLING')
      expect(roles).toContain('ANALYTICS')
    })

    it('should return empty for non-hierarchical role as minimum', () => {
      const roles = getRolesWithMinimumAccess('BILLING')
      expect(roles).toEqual([])
    })

    it('should return additionalRoles for non-hierarchical role as minimum', () => {
      const roles = getRolesWithMinimumAccess('BILLING', ['ADMIN', 'BILLING'])
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('BILLING')
    })
  })

  describe('isHierarchicalRole', () => {
    it('should return true for hierarchical roles', () => {
      expect(isHierarchicalRole('ADMIN')).toBe(true)
      expect(isHierarchicalRole('MANAGER')).toBe(true)
      expect(isHierarchicalRole('EDITOR')).toBe(true)
      expect(isHierarchicalRole('AUTHOR')).toBe(true)
      expect(isHierarchicalRole('VIEWER')).toBe(true)
    })

    it('should return false for non-hierarchical roles', () => {
      expect(isHierarchicalRole('BILLING')).toBe(false)
      expect(isHierarchicalRole('ANALYTICS')).toBe(false)
    })
  })

  describe('getRoleLevel', () => {
    it('should return correct levels for hierarchical roles', () => {
      expect(getRoleLevel('ADMIN')).toBe(0)
      expect(getRoleLevel('MANAGER')).toBe(1)
      expect(getRoleLevel('EDITOR')).toBe(2)
      expect(getRoleLevel('AUTHOR')).toBe(3)
      expect(getRoleLevel('VIEWER')).toBe(4)
    })

    it('should return -1 for non-hierarchical roles', () => {
      expect(getRoleLevel('BILLING')).toBe(-1)
      expect(getRoleLevel('ANALYTICS')).toBe(-1)
    })
  })

  describe('getAllRoles', () => {
    it('should return all 7 roles', () => {
      const roles = getAllRoles()

      expect(roles).toHaveLength(7)
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).toContain('EDITOR')
      expect(roles).toContain('AUTHOR')
      expect(roles).toContain('VIEWER')
      expect(roles).toContain('BILLING')
      expect(roles).toContain('ANALYTICS')
    })
  })

  describe('compareRoles', () => {
    it('should return -1 when roleA is higher', () => {
      expect(compareRoles('ADMIN', 'MANAGER')).toBe(-1)
      expect(compareRoles('ADMIN', 'VIEWER')).toBe(-1)
      expect(compareRoles('EDITOR', 'AUTHOR')).toBe(-1)
    })

    it('should return 1 when roleA is lower', () => {
      expect(compareRoles('VIEWER', 'ADMIN')).toBe(1)
      expect(compareRoles('AUTHOR', 'MANAGER')).toBe(1)
    })

    it('should return 0 when roles are equal', () => {
      expect(compareRoles('ADMIN', 'ADMIN')).toBe(0)
      expect(compareRoles('VIEWER', 'VIEWER')).toBe(0)
    })

    it('should return 0 when both are non-hierarchical', () => {
      expect(compareRoles('BILLING', 'ANALYTICS')).toBe(0)
    })

    it('should return 1 when only roleA is non-hierarchical', () => {
      expect(compareRoles('BILLING', 'ADMIN')).toBe(1)
      expect(compareRoles('ANALYTICS', 'VIEWER')).toBe(1)
    })

    it('should return -1 when only roleB is non-hierarchical', () => {
      expect(compareRoles('ADMIN', 'BILLING')).toBe(-1)
      expect(compareRoles('VIEWER', 'ANALYTICS')).toBe(-1)
    })
  })

  describe('isRoleHigherThan', () => {
    it('should return true when roleA is strictly higher', () => {
      expect(isRoleHigherThan('ADMIN', 'MANAGER')).toBe(true)
      expect(isRoleHigherThan('ADMIN', 'VIEWER')).toBe(true)
      expect(isRoleHigherThan('MANAGER', 'EDITOR')).toBe(true)
    })

    it('should return false when roles are equal', () => {
      expect(isRoleHigherThan('ADMIN', 'ADMIN')).toBe(false)
      expect(isRoleHigherThan('VIEWER', 'VIEWER')).toBe(false)
    })

    it('should return false when roleA is lower', () => {
      expect(isRoleHigherThan('VIEWER', 'ADMIN')).toBe(false)
      expect(isRoleHigherThan('EDITOR', 'MANAGER')).toBe(false)
    })

    it('should return false when involving non-hierarchical roles', () => {
      expect(isRoleHigherThan('BILLING', 'ANALYTICS')).toBe(false)
      expect(isRoleHigherThan('ADMIN', 'BILLING')).toBe(false)
      expect(isRoleHigherThan('BILLING', 'VIEWER')).toBe(false)
    })
  })
})

describe('Permission Utility Functions', () => {
  describe('hasPermission', () => {
    it('should return true for permissions the role has', () => {
      expect(hasPermission('ADMIN', Permission.MANAGE_TENANT_SETTINGS)).toBe(true)
      expect(hasPermission('ADMIN', Permission.MANAGE_ALL_USERS)).toBe(true)
      expect(hasPermission('EDITOR', Permission.EDIT_ALL_CONTENT)).toBe(true)
      expect(hasPermission('VIEWER', Permission.VIEW_PUBLISHED_CONTENT)).toBe(true)
      expect(hasPermission('BILLING', Permission.MANAGE_BILLING)).toBe(true)
      expect(hasPermission('ANALYTICS', Permission.VIEW_ANALYTICS)).toBe(true)
    })

    it('should return false for permissions the role does not have', () => {
      expect(hasPermission('VIEWER', Permission.MANAGE_ALL_USERS)).toBe(false)
      expect(hasPermission('VIEWER', Permission.EDIT_ALL_CONTENT)).toBe(false)
      expect(hasPermission('BILLING', Permission.EDIT_ALL_CONTENT)).toBe(false)
      expect(hasPermission('ANALYTICS', Permission.MANAGE_BILLING)).toBe(false)
    })

    it('should return false for system permission (MANAGE_SYSTEM_SETTINGS)', () => {
      // No role has MANAGE_SYSTEM_SETTINGS - that requires isSuperAdmin flag
      expect(hasPermission('ADMIN', Permission.MANAGE_SYSTEM_SETTINGS)).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true if role has any of the permissions', () => {
      expect(hasAnyPermission('VIEWER', [Permission.MANAGE_ALL_USERS, Permission.VIEW_PUBLISHED_CONTENT])).toBe(true)
      expect(hasAnyPermission('BILLING', [Permission.EDIT_ALL_CONTENT, Permission.MANAGE_BILLING])).toBe(true)
    })

    it('should return false if role has none of the permissions', () => {
      expect(hasAnyPermission('VIEWER', [Permission.MANAGE_ALL_USERS, Permission.EDIT_ALL_CONTENT])).toBe(false)
      expect(hasAnyPermission('BILLING', [Permission.EDIT_ALL_CONTENT, Permission.VIEW_ANALYTICS])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if role has all permissions', () => {
      expect(hasAllPermissions('ADMIN', [Permission.MANAGE_ALL_USERS, Permission.VIEW_ALL_USERS])).toBe(true)
      expect(hasAllPermissions('EDITOR', [Permission.CREATE_CONTENT, Permission.EDIT_ALL_CONTENT])).toBe(true)
    })

    it('should return false if role is missing any permission', () => {
      expect(hasAllPermissions('VIEWER', [Permission.VIEW_PUBLISHED_CONTENT, Permission.EDIT_ALL_CONTENT])).toBe(false)
      expect(hasAllPermissions('AUTHOR', [Permission.CREATE_CONTENT, Permission.PUBLISH_CONTENT])).toBe(false)
    })
  })
})

describe('Guard Middleware Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    app.onError(errorHandler)

    // Set up middleware
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')
      await next()
    })

    app.use('*', sessionMiddleware())
    app.use('/api/*', sessionAuth)
    app.use('/api/*', accountMiddleware)

    // Test routes with different role requirements
    app.get('/api/admin-only', requireRole('ADMIN'), (c) => c.json({ access: 'granted' }))
    app.get('/api/manager-up', requireRole('MANAGER'), (c) => c.json({ access: 'granted' }))
    app.get('/api/viewer-up', requireRole('VIEWER'), (c) => c.json({ access: 'granted' }))
    app.get('/api/billing-allowed', requireRole('VIEWER', ['BILLING']), (c) => c.json({ access: 'granted' }))
    app.get('/api/analytics-only', requireRole('ANALYTICS'), (c) => c.json({ access: 'granted' }))

    // Permission-based routes
    app.get('/api/manage-users', requirePermission(Permission.MANAGE_ALL_USERS), (c) => c.json({ access: 'granted' }))
    app.get('/api/view-analytics', requirePermission(Permission.VIEW_ANALYTICS), (c) => c.json({ access: 'granted' }))
  })

  describe('requireRole middleware', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/admin-only')

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toContain('Not authenticated')
    })

    it('should return 403 when user has no role for account', async () => {
      // Create user without account membership
      const user = await createUser({ email: 'norole@example.com', name: 'No Role User' })
      const { headers } = await createUserSession(user.id, { email: user.email, name: user.name })

      const account = await createAccount({ name: 'Test Account' })

      const res = await app.request('/api/admin-only', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should allow ADMIN to access admin-only routes', async () => {
      const { headers, account } = await createTestScenario({ role: 'ADMIN' })

      const res = await app.request('/api/admin-only', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.access).toBe('granted')
    })

    it('should deny VIEWER access to admin-only routes', async () => {
      const { headers, account } = await createTestScenario({ role: 'VIEWER' })

      const res = await app.request('/api/admin-only', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should allow higher roles access to lower role routes', async () => {
      const { headers, account } = await createTestScenario({ role: 'ADMIN' })

      const res = await app.request('/api/viewer-up', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should allow additionalRoles access', async () => {
      const { headers, account } = await createTestScenario({ role: 'BILLING' })

      const res = await app.request('/api/billing-allowed', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should deny non-hierarchical role without additionalRoles', async () => {
      const { headers, account } = await createTestScenario({ role: 'BILLING' })

      const res = await app.request('/api/viewer-up', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should allow super admin to bypass all role checks', async () => {
      const { headers, account } = await createTestScenario({
        isSuperAdmin: true,
        role: 'VIEWER', // Even with VIEWER role, super admin should bypass
      })

      const res = await app.request('/api/admin-only', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
    })
  })

  describe('requirePermission middleware', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/manage-users')

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toContain('Not authenticated')
    })

    it('should return 403 when user has no role for account', async () => {
      const user = await createUser({ email: 'norole-perm@example.com', name: 'No Role Perm User' })
      const { headers } = await createUserSession(user.id, { email: user.email, name: user.name })

      const account = await createAccount({ name: 'Test Account Permissions' })

      const res = await app.request('/api/manage-users', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should allow super admin to bypass all permission checks', async () => {
      const { headers, account } = await createTestScenario({
        isSuperAdmin: true,
        role: 'VIEWER', // Even with VIEWER role, super admin should bypass
      })

      const res = await app.request('/api/manage-users', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should allow access with required permission', async () => {
      const { headers, account } = await createTestScenario({ role: 'ADMIN' })

      const res = await app.request('/api/manage-users', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should deny access without required permission', async () => {
      const { headers, account } = await createTestScenario({ role: 'VIEWER' })

      const res = await app.request('/api/manage-users', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should allow ANALYTICS role to view analytics', async () => {
      const { headers, account } = await createTestScenario({ role: 'ANALYTICS' })

      const res = await app.request('/api/view-analytics', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'Account-ID': account.id,
        },
      })

      expect(res.status).toBe(200)
    })
  })
})
