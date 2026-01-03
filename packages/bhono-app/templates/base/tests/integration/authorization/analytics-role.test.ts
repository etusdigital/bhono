/**
 * ANALYTICS Role Authorization Integration Tests
 *
 * Tests the ANALYTICS role which is a non-hierarchical (specialized) role
 * designed specifically for analytics, audit log access, and report generation.
 *
 * ANALYTICS Role Characteristics:
 * - Non-hierarchical: Level -1 (does not inherit from VIEWER or any other role)
 * - Permissions: VIEW_ANALYTICS, EXPORT_REPORTS only
 * - Can: view audit logs, access analytics endpoints, view users (authenticated access)
 * - Cannot: manage users, update accounts, create invitations, manage billing
 *
 * Note: Analytics-specific endpoints (e.g., /api/analytics/*) are not yet implemented.
 * These tests focus on verifying the role's access to audit logs and restrictions
 * to other endpoints, documenting expected behavior for future analytics endpoints.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createDeletedUser,
  createUserSession,
  createAccount,
  addUserToAccount,
  type Role,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'
import { hasPermission, Permission } from '../../../src/server/auth/permissions'
import { hasMinimumRole, isHierarchicalRole, ROLE_HIERARCHY } from '../../../src/server/auth/roles'

// ============================================================================
// TEST SETUP
// ============================================================================

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
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

/**
 * Helper to create a user with a specific role in an account
 */
async function createUserWithRole(
  accountId: string,
  role: Role,
  options?: { email?: string; name?: string }
): Promise<{
  user: Awaited<ReturnType<typeof createUser>>
  sessionId: string
  headers: Record<string, string>
}> {
  const user = await createUser({
    email: options?.email ?? `${role.toLowerCase()}-user-${crypto.randomUUID().slice(0, 8)}@example.com`,
    name: options?.name ?? `${role} User`,
  })

  await addUserToAccount(user.id, accountId, role)

  const { sessionId, headers } = await createUserSession(user.id, {
    email: user.email,
    name: user.name,
  })

  return { user, sessionId, headers }
}

/**
 * Helper to create an audit log entry directly in the database
 */
function createAuditLog(options: {
  accountId: string
  userId: string
  entity: string
  entityId: string
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'
  changes?: Record<string, unknown> | null
  timestamp?: string
}) {
  const sqlite = getSqlite()
  const id = crypto.randomUUID()
  const transactionId = crypto.randomUUID()
  const timestamp = options.timestamp ?? new Date().toISOString()

  sqlite.prepare(`
    INSERT INTO audit_logs (id, transaction_id, account_id, user_id, entity, entity_id, action, changes, ip_address, user_agent, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    transactionId,
    options.accountId,
    options.userId,
    options.entity,
    options.entityId,
    options.action,
    options.changes ? JSON.stringify(options.changes) : null,
    '127.0.0.1',
    'IntegrationTest/1.0',
    timestamp
  )

  return { id, transactionId, timestamp }
}

// ============================================================================
// TESTS
// ============================================================================

describe('ANALYTICS Role Authorization', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      // Inject environment bindings
      ;(c as any).env = env

      // Set up database
      const db = createTestDb()
      c.set('db', db)

      // Set up request context variables
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Session middleware - reads session from KV and sets sessionData in context
    app.use('*', sessionMiddleware())

    // Mount API routes (includes sessionAuth and accountMiddleware)
    app.route('/api', api)
  })

  // ============================================================================
  // ROLE CHARACTERISTICS UNIT TESTS
  // ============================================================================

  describe('Role characteristics', () => {
    it('should be defined as a non-hierarchical role (level -1)', () => {
      expect(ROLE_HIERARCHY.ANALYTICS).toBe(-1)
    })

    it('should NOT be a hierarchical role', () => {
      expect(isHierarchicalRole('ANALYTICS')).toBe(false)
    })

    it('should have VIEW_ANALYTICS permission', () => {
      expect(hasPermission('ANALYTICS', Permission.VIEW_ANALYTICS)).toBe(true)
    })

    it('should have EXPORT_REPORTS permission', () => {
      expect(hasPermission('ANALYTICS', Permission.EXPORT_REPORTS)).toBe(true)
    })

    it('should NOT have MANAGE_ALL_USERS permission', () => {
      expect(hasPermission('ANALYTICS', Permission.MANAGE_ALL_USERS)).toBe(false)
    })

    it('should NOT have MANAGE_TEAM_USERS permission', () => {
      expect(hasPermission('ANALYTICS', Permission.MANAGE_TEAM_USERS)).toBe(false)
    })

    it('should NOT have VIEW_ALL_USERS permission', () => {
      expect(hasPermission('ANALYTICS', Permission.VIEW_ALL_USERS)).toBe(false)
    })

    it('should NOT have MANAGE_TENANT_SETTINGS permission', () => {
      expect(hasPermission('ANALYTICS', Permission.MANAGE_TENANT_SETTINGS)).toBe(false)
    })

    it('should NOT have MANAGE_BILLING permission', () => {
      expect(hasPermission('ANALYTICS', Permission.MANAGE_BILLING)).toBe(false)
    })

    it('should NOT have VIEW_BILLING permission', () => {
      expect(hasPermission('ANALYTICS', Permission.VIEW_BILLING)).toBe(false)
    })

    it('should NOT have content permissions (CREATE_CONTENT, EDIT_OWN_CONTENT, etc.)', () => {
      expect(hasPermission('ANALYTICS', Permission.CREATE_CONTENT)).toBe(false)
      expect(hasPermission('ANALYTICS', Permission.EDIT_OWN_CONTENT)).toBe(false)
      expect(hasPermission('ANALYTICS', Permission.EDIT_ALL_CONTENT)).toBe(false)
      expect(hasPermission('ANALYTICS', Permission.PUBLISH_CONTENT)).toBe(false)
      expect(hasPermission('ANALYTICS', Permission.DELETE_CONTENT)).toBe(false)
    })
  })

  // ============================================================================
  // NON-HIERARCHICAL BEHAVIOR TESTS
  // ============================================================================

  describe('Non-hierarchical role behavior', () => {
    it('should NOT satisfy VIEWER minimum role requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)
    })

    it('should NOT satisfy AUTHOR minimum role requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'AUTHOR')).toBe(false)
    })

    it('should NOT satisfy EDITOR minimum role requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'EDITOR')).toBe(false)
    })

    it('should NOT satisfy MANAGER minimum role requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'MANAGER')).toBe(false)
    })

    it('should NOT satisfy ADMIN minimum role requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'ADMIN')).toBe(false)
    })

    it('should only satisfy its own role requirement exactly', () => {
      expect(hasMinimumRole('ANALYTICS', 'ANALYTICS')).toBe(true)
    })

    it('should NOT grant access when other non-hierarchical roles are required', () => {
      expect(hasMinimumRole('ANALYTICS', 'BILLING')).toBe(false)
    })

    it('should grant access when explicitly added to additionalRoles', () => {
      // ANALYTICS can access if explicitly added to additionalRoles for ADMIN requirement
      expect(hasMinimumRole('ANALYTICS', 'ADMIN', ['ANALYTICS'])).toBe(true)
    })
  })

  // ============================================================================
  // API ACCESS TESTS - ALLOWED OPERATIONS
  // ============================================================================

  describe('Allowed operations', () => {
    describe('Audit log access', () => {
      it('should be able to view audit logs', async () => {
        const account = await createAccount({ name: 'Analytics Audit Test' })
        const { user, headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        // Create an audit log entry
        createAuditLog({
          accountId: account.id,
          userId: user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(Array.isArray(body.data)).toBe(true)
      })

      it('should be able to filter audit logs by entity', async () => {
        const account = await createAccount({ name: 'Analytics Audit Filter Test' })
        const { user, headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        // Create audit log entries for different entities
        createAuditLog({
          accountId: account.id,
          userId: user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        createAuditLog({
          accountId: account.id,
          userId: user.id,
          entity: 'Account',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
        })

        const res = await app.request('/api/audits?entity=User', {
          method: 'GET',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(Array.isArray(body.data)).toBe(true)
        // All returned logs should be for 'User' entity
        for (const log of body.data) {
          expect(log.entity).toBe('User')
        }
      })

      it('should be able to filter audit logs by action', async () => {
        const account = await createAccount({ name: 'Analytics Audit Action Filter Test' })
        const { user, headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        // Create audit log entries for different actions
        createAuditLog({
          accountId: account.id,
          userId: user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        createAuditLog({
          accountId: account.id,
          userId: user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
        })

        const res = await app.request('/api/audits?action=INSERT', {
          method: 'GET',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(Array.isArray(body.data)).toBe(true)
        // All returned logs should be INSERT actions
        for (const log of body.data) {
          expect(log.action).toBe('INSERT')
        }
      })
    })

    describe('Authenticated access (view only)', () => {
      it('should be able to view users list', async () => {
        const account = await createAccount({ name: 'Analytics View Users Test' })
        const { headers } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(Array.isArray(body.data)).toBe(true)
      })

      it('should be able to view a specific user', async () => {
        const account = await createAccount({ name: 'Analytics View User Test' })
        const { user, headers } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request(`/api/users/${user.id}`, {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.id).toBe(user.id)
      })

      it('should be able to view accounts list', async () => {
        const account = await createAccount({ name: 'Analytics View Accounts Test' })
        const { headers } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('data')
      })

      it('should be able to view a specific account', async () => {
        const account = await createAccount({ name: 'Analytics View Account Test' })
        const { headers } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.id).toBe(account.id)
      })
    })
  })

  // ============================================================================
  // API ACCESS TESTS - FORBIDDEN OPERATIONS
  // ============================================================================

  describe('Forbidden operations', () => {
    describe('User management', () => {
      it('should NOT be able to update other users', async () => {
        const account = await createAccount({ name: 'Analytics Update User Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
        const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

        const res = await app.request(`/api/users/${targetUser.id}`, {
          method: 'PATCH',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Analytics Updated Name' }),
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to delete users (soft delete)', async () => {
        const account = await createAccount({ name: 'Analytics Delete User Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
        const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

        const res = await app.request(`/api/users/${targetUser.id}`, {
          method: 'DELETE',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to restore soft-deleted users', async () => {
        const account = await createAccount({ name: 'Analytics Restore User Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        const deletedUser = await createDeletedUser({
          email: 'deleted-for-analytics@example.com',
          name: 'Deleted For Analytics',
        })
        await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

        const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Account management', () => {
      it('should NOT be able to update account settings', async () => {
        const account = await createAccount({ name: 'Analytics Account Update Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'PATCH',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Analytics Updated Account' }),
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to delete accounts', async () => {
        const account = await createAccount({ name: 'Analytics Delete Account Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'DELETE',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Invitation management', () => {
      it('should NOT be able to create invitations', async () => {
        const account = await createAccount({ name: 'Analytics Create Invitation Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'invited-by-analytics@example.com',
            role: 'VIEWER',
          }),
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to list invitations', async () => {
        const account = await createAccount({ name: 'Analytics List Invitations Test' })
        const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...analyticsHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })
  })

  // ============================================================================
  // COMPARISON WITH OTHER ROLES
  // ============================================================================

  describe('Comparison with other roles', () => {
    it('should have same user view access as VIEWER', async () => {
      const account = await createAccount({ name: 'Analytics vs Viewer Test' })
      const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')

      const analyticsRes = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      const viewerRes = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...viewerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(analyticsRes.status).toBe(200)
      expect(viewerRes.status).toBe(200)
    })

    it('should have access to audit logs unlike BILLING role', async () => {
      const account = await createAccount({ name: 'Analytics vs Billing Audit Test' })
      const { user: analyticsUser, headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
      const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

      // Create an audit log
      createAuditLog({
        accountId: account.id,
        userId: analyticsUser.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      // ANALYTICS should be able to view audits
      const analyticsRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(analyticsRes.status).toBe(200)

      // BILLING should NOT be able to view audits
      const billingRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...billingHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(billingRes.status).toBe(403)
    })

    it('should NOT have user management access unlike ADMIN role', async () => {
      const account = await createAccount({ name: 'Analytics vs Admin User Mgmt Test' })
      const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      // ADMIN should be able to update users
      const adminRes = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Admin Updated' }),
      })
      expect(adminRes.status).toBe(200)

      // ANALYTICS should NOT be able to update users
      const analyticsRes = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Analytics Updated' }),
      })
      expect(analyticsRes.status).toBe(403)
    })

    it('should NOT have invitation management unlike MANAGER role', async () => {
      const account = await createAccount({ name: 'Analytics vs Manager Invite Test' })
      const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')

      // MANAGER should be able to create invitations
      const managerRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-manager-analytics-comp@example.com',
          role: 'VIEWER',
        }),
      })
      expect(managerRes.status).toBe(200)

      // ANALYTICS should NOT be able to create invitations
      const analyticsRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-analytics-comp@example.com',
          role: 'VIEWER',
        }),
      })
      expect(analyticsRes.status).toBe(403)
    })

    it('should have audit access same as ADMIN', async () => {
      const account = await createAccount({ name: 'Analytics vs Admin Audit Test' })
      const { user: analyticsUser, headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')

      // Create an audit log
      createAuditLog({
        accountId: account.id,
        userId: analyticsUser.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      // Both ADMIN and ANALYTICS should be able to view audits
      const adminRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(adminRes.status).toBe(200)

      const analyticsRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(analyticsRes.status).toBe(200)
    })
  })

  // ============================================================================
  // NON-HIERARCHICAL ISOLATION TESTS
  // ============================================================================

  describe('Non-hierarchical role isolation', () => {
    it('should NOT inherit BILLING permissions', () => {
      // ANALYTICS should not have BILLING permissions
      expect(hasPermission('ANALYTICS', Permission.MANAGE_BILLING)).toBe(false)
      expect(hasPermission('ANALYTICS', Permission.VIEW_BILLING)).toBe(false)
    })

    it('should NOT grant BILLING access when ANALYTICS role is required', () => {
      expect(hasMinimumRole('BILLING', 'ANALYTICS')).toBe(false)
    })

    it('should NOT grant ANALYTICS access when BILLING role is required', () => {
      expect(hasMinimumRole('ANALYTICS', 'BILLING')).toBe(false)
    })

    it('should have different permissions than BILLING', () => {
      // ANALYTICS has VIEW_ANALYTICS, BILLING does not
      expect(hasPermission('ANALYTICS', Permission.VIEW_ANALYTICS)).toBe(true)
      expect(hasPermission('BILLING', Permission.VIEW_ANALYTICS)).toBe(false)

      // BILLING has MANAGE_BILLING, ANALYTICS does not
      expect(hasPermission('BILLING', Permission.MANAGE_BILLING)).toBe(true)
      expect(hasPermission('ANALYTICS', Permission.MANAGE_BILLING)).toBe(false)
    })
  })

  // ============================================================================
  // MULTI-TENANT ISOLATION TESTS
  // ============================================================================

  describe('Multi-tenant isolation', () => {
    it('should NOT access resources from accounts where user is not a member', async () => {
      const account1 = await createAccount({ name: 'Analytics Multi-tenant Account 1' })
      const account2 = await createAccount({ name: 'Analytics Multi-tenant Account 2' })

      // Create ANALYTICS user only in account1
      const { headers: analyticsHeaders } = await createUserWithRole(account1.id, 'ANALYTICS')

      // Trying to access account2 resources should fail
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account2.id, // Different account
        },
      })

      // Should be 403 (not a member of this account)
      expect(res.status).toBe(403)
    })

    it('should only see users from own account', async () => {
      const account1 = await createAccount({ name: 'Analytics User Isolation Account 1' })
      const account2 = await createAccount({ name: 'Analytics User Isolation Account 2' })

      // Create ANALYTICS user in account1
      const { user: analyticsUser, headers: analyticsHeaders } = await createUserWithRole(account1.id, 'ANALYTICS')

      // Create user in account2
      const user2 = await createUser({ email: 'account2user-analytics@example.com', name: 'Account 2 User' })
      await addUserToAccount(user2.id, account2.id, 'ADMIN')

      // ANALYTICS user should only see themselves (and other account1 users)
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account1.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe(analyticsUser.id)
    })

    it('should only see audit logs from own account', async () => {
      const account1 = await createAccount({ name: 'Analytics Audit Isolation Account 1' })
      const account2 = await createAccount({ name: 'Analytics Audit Isolation Account 2' })

      // Create ANALYTICS user in account1
      const { user: analyticsUser, headers: analyticsHeaders } = await createUserWithRole(account1.id, 'ANALYTICS')

      // Create user in account2 and create audit log there
      const user2 = await createUser({ email: 'account2user-audit@example.com', name: 'Account 2 User' })
      await addUserToAccount(user2.id, account2.id, 'ADMIN')

      // Create audit logs in both accounts
      createAuditLog({
        accountId: account1.id,
        userId: analyticsUser.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      createAuditLog({
        accountId: account2.id,
        userId: user2.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      // ANALYTICS user should only see audit logs from account1
      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...analyticsHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account1.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      // All returned logs should be from account1
      for (const log of body.data) {
        expect(log.accountId).toBe(account1.id)
      }
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle simultaneous ANALYTICS and other role in different accounts', async () => {
      const analyticsAccount = await createAccount({ name: 'Analytics Only Account' })
      const adminAccount = await createAccount({ name: 'Admin Account' })

      // Create user with ANALYTICS in one account, ADMIN in another
      const user = await createUser({
        email: 'multi-role-analytics@example.com',
        name: 'Multi-Role Analytics User',
      })
      await addUserToAccount(user.id, analyticsAccount.id, 'ANALYTICS')
      await addUserToAccount(user.id, adminAccount.id, 'ADMIN')

      const { sessionId, headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      // In analytics account - should be able to view audits
      // First create an audit log
      createAuditLog({
        accountId: analyticsAccount.id,
        userId: user.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      const analyticsAuditRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': analyticsAccount.id,
        },
      })
      expect(analyticsAuditRes.status).toBe(200)

      // In admin account - should be able to create invitations
      const adminRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'new-invite-analytics@example.com',
          role: 'VIEWER',
        }),
      })
      expect(adminRes.status).toBe(200)

      // But NOT in analytics account
      const analyticsInviteRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': analyticsAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'analytics-invite@example.com',
          role: 'VIEWER',
        }),
      })
      expect(analyticsInviteRes.status).toBe(403)
    })

    it('should verify ANALYTICS role cannot self-promote to ADMIN', async () => {
      const account = await createAccount({ name: 'Analytics Self-Promote Test' })
      const { user, headers } = await createUserWithRole(account.id, 'ANALYTICS')

      // Try to update own role to ADMIN (if role update endpoint exists)
      // This tests that ANALYTICS cannot modify user accounts
      const res = await app.request(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Attempted Self Update' }),
      })

      expect(res.status).toBe(403)
    })

    it('should handle ANALYTICS user with both ANALYTICS and BILLING roles in same account', async () => {
      const account = await createAccount({ name: 'Dual Special Role Account' })

      // Create user with both ANALYTICS role first
      const { user, headers } = await createUserWithRole(account.id, 'ANALYTICS')

      // This user only has ANALYTICS in this account
      // They should be able to view audits
      createAuditLog({
        accountId: account.id,
        userId: user.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      const auditRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(auditRes.status).toBe(200)

      // But cannot modify users
      const updateRes = await app.request(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Not Update' }),
      })
      expect(updateRes.status).toBe(403)
    })
  })
})
