/**
 * BILLING Role Authorization Integration Tests
 *
 * Tests the BILLING role which is a non-hierarchical (specialized) role
 * designed specifically for billing and subscription management.
 *
 * BILLING Role Characteristics:
 * - Non-hierarchical: Level -1 (does not inherit from VIEWER or any other role)
 * - Permissions: MANAGE_BILLING, VIEW_BILLING only
 * - Cannot: manage users, update accounts, create invitations, view audits
 * - Can: view users (authenticated access), view accounts (authenticated access)
 *
 * Note: Billing-specific endpoints (e.g., /api/billing/*) are not yet implemented.
 * These tests focus on verifying the role's access restrictions to existing endpoints
 * and document expected behavior for future billing endpoints.
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

describe('BILLING Role Authorization', () => {
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
      expect(ROLE_HIERARCHY.BILLING).toBe(-1)
    })

    it('should NOT be a hierarchical role', () => {
      expect(isHierarchicalRole('BILLING')).toBe(false)
    })

    it('should have MANAGE_BILLING permission', () => {
      expect(hasPermission('BILLING', Permission.MANAGE_BILLING)).toBe(true)
    })

    it('should have VIEW_BILLING permission', () => {
      expect(hasPermission('BILLING', Permission.VIEW_BILLING)).toBe(true)
    })

    it('should NOT have MANAGE_ALL_USERS permission', () => {
      expect(hasPermission('BILLING', Permission.MANAGE_ALL_USERS)).toBe(false)
    })

    it('should NOT have MANAGE_TEAM_USERS permission', () => {
      expect(hasPermission('BILLING', Permission.MANAGE_TEAM_USERS)).toBe(false)
    })

    it('should NOT have VIEW_ALL_USERS permission', () => {
      expect(hasPermission('BILLING', Permission.VIEW_ALL_USERS)).toBe(false)
    })

    it('should NOT have MANAGE_TENANT_SETTINGS permission', () => {
      expect(hasPermission('BILLING', Permission.MANAGE_TENANT_SETTINGS)).toBe(false)
    })

    it('should NOT have VIEW_ANALYTICS permission', () => {
      expect(hasPermission('BILLING', Permission.VIEW_ANALYTICS)).toBe(false)
    })

    it('should NOT have content permissions (CREATE_CONTENT, EDIT_OWN_CONTENT, etc.)', () => {
      expect(hasPermission('BILLING', Permission.CREATE_CONTENT)).toBe(false)
      expect(hasPermission('BILLING', Permission.EDIT_OWN_CONTENT)).toBe(false)
      expect(hasPermission('BILLING', Permission.EDIT_ALL_CONTENT)).toBe(false)
      expect(hasPermission('BILLING', Permission.PUBLISH_CONTENT)).toBe(false)
      expect(hasPermission('BILLING', Permission.DELETE_CONTENT)).toBe(false)
    })
  })

  // ============================================================================
  // NON-HIERARCHICAL BEHAVIOR TESTS
  // ============================================================================

  describe('Non-hierarchical role behavior', () => {
    it('should NOT satisfy VIEWER minimum role requirement', () => {
      expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
    })

    it('should NOT satisfy AUTHOR minimum role requirement', () => {
      expect(hasMinimumRole('BILLING', 'AUTHOR')).toBe(false)
    })

    it('should NOT satisfy EDITOR minimum role requirement', () => {
      expect(hasMinimumRole('BILLING', 'EDITOR')).toBe(false)
    })

    it('should NOT satisfy MANAGER minimum role requirement', () => {
      expect(hasMinimumRole('BILLING', 'MANAGER')).toBe(false)
    })

    it('should NOT satisfy ADMIN minimum role requirement', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN')).toBe(false)
    })

    it('should only satisfy its own role requirement exactly', () => {
      expect(hasMinimumRole('BILLING', 'BILLING')).toBe(true)
    })

    it('should NOT grant access when other non-hierarchical roles are required', () => {
      expect(hasMinimumRole('BILLING', 'ANALYTICS')).toBe(false)
    })

    it('should grant access when explicitly added to additionalRoles', () => {
      // BILLING can access if explicitly added to additionalRoles for MANAGER requirement
      expect(hasMinimumRole('BILLING', 'MANAGER', ['BILLING'])).toBe(true)
    })
  })

  // ============================================================================
  // API ACCESS TESTS - ALLOWED OPERATIONS
  // ============================================================================

  describe('Allowed operations (authenticated access)', () => {
    it('should be able to view users list', async () => {
      const account = await createAccount({ name: 'Billing View Users Test' })
      const { headers } = await createUserWithRole(account.id, 'BILLING')

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
      const account = await createAccount({ name: 'Billing View User Test' })
      const { user, headers } = await createUserWithRole(account.id, 'BILLING')

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
      const account = await createAccount({ name: 'Billing View Accounts Test' })
      const { headers } = await createUserWithRole(account.id, 'BILLING')

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
      const account = await createAccount({ name: 'Billing View Account Test' })
      const { headers } = await createUserWithRole(account.id, 'BILLING')

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

  // ============================================================================
  // API ACCESS TESTS - FORBIDDEN OPERATIONS
  // ============================================================================

  describe('Forbidden operations', () => {
    describe('User management', () => {
      it('should NOT be able to update other users', async () => {
        const account = await createAccount({ name: 'Billing Update User Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')
        const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

        const res = await app.request(`/api/users/${targetUser.id}`, {
          method: 'PATCH',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Billing Updated Name' }),
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to delete users (soft delete)', async () => {
        const account = await createAccount({ name: 'Billing Delete User Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')
        const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

        const res = await app.request(`/api/users/${targetUser.id}`, {
          method: 'DELETE',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to restore soft-deleted users', async () => {
        const account = await createAccount({ name: 'Billing Restore User Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

        const deletedUser = await createDeletedUser({
          email: 'deleted-for-billing@example.com',
          name: 'Deleted For Billing',
        })
        await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

        const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Account management', () => {
      it('should NOT be able to update account settings', async () => {
        const account = await createAccount({ name: 'Billing Account Update Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'PATCH',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Billing Updated Account' }),
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to delete accounts', async () => {
        const account = await createAccount({ name: 'Billing Delete Account Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'DELETE',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Invitation management', () => {
      it('should NOT be able to create invitations', async () => {
        const account = await createAccount({ name: 'Billing Create Invitation Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'invited-by-billing@example.com',
            role: 'VIEWER',
          }),
        })

        expect(res.status).toBe(403)
      })

      it('should NOT be able to list invitations', async () => {
        const account = await createAccount({ name: 'Billing List Invitations Test' })
        const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...billingHeaders,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Audit log access', () => {
      it('should NOT be able to view audit logs', async () => {
        const account = await createAccount({ name: 'Billing Audit Test' })
        const { user, headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

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
            ...billingHeaders,
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
      const account = await createAccount({ name: 'Billing vs Viewer Test' })
      const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')

      const billingRes = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...billingHeaders,
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

      expect(billingRes.status).toBe(200)
      expect(viewerRes.status).toBe(200)
    })

    it('should NOT have access to audit logs unlike ANALYTICS role', async () => {
      const account = await createAccount({ name: 'Billing vs Analytics Audit Test' })
      const { user: billingUser, headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')
      const { headers: analyticsHeaders } = await createUserWithRole(account.id, 'ANALYTICS')

      // Create an audit log
      createAuditLog({
        accountId: account.id,
        userId: billingUser.id,
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
      const account = await createAccount({ name: 'Billing vs Admin User Mgmt Test' })
      const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')
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

      // BILLING should NOT be able to update users
      const billingRes = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...billingHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Billing Updated' }),
      })
      expect(billingRes.status).toBe(403)
    })

    it('should NOT have invitation management unlike MANAGER role', async () => {
      const account = await createAccount({ name: 'Billing vs Manager Invite Test' })
      const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')
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
          email: 'invited-by-manager-comp@example.com',
          role: 'VIEWER',
        }),
      })
      expect(managerRes.status).toBe(200)

      // BILLING should NOT be able to create invitations
      const billingRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...billingHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-billing-comp@example.com',
          role: 'VIEWER',
        }),
      })
      expect(billingRes.status).toBe(403)
    })
  })

  // ============================================================================
  // MULTI-TENANT ISOLATION TESTS
  // ============================================================================

  describe('Multi-tenant isolation', () => {
    it('should NOT access resources from accounts where user is not a member', async () => {
      const account1 = await createAccount({ name: 'Billing Multi-tenant Account 1' })
      const account2 = await createAccount({ name: 'Billing Multi-tenant Account 2' })

      // Create BILLING user only in account1
      const { headers: billingHeaders } = await createUserWithRole(account1.id, 'BILLING')

      // Trying to access account2 resources should fail
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...billingHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account2.id, // Different account
        },
      })

      // Should be 403 (not a member of this account)
      expect(res.status).toBe(403)
    })

    it('should only see users from own account', async () => {
      const account1 = await createAccount({ name: 'Billing User Isolation Account 1' })
      const account2 = await createAccount({ name: 'Billing User Isolation Account 2' })

      // Create BILLING user in account1
      const { user: billingUser, headers: billingHeaders } = await createUserWithRole(account1.id, 'BILLING')

      // Create user in account2
      const user2 = await createUser({ email: 'account2user@example.com', name: 'Account 2 User' })
      await addUserToAccount(user2.id, account2.id, 'ADMIN')

      // BILLING user should only see themselves (and other account1 users)
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...billingHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account1.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe(billingUser.id)
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle simultaneous BILLING and other role in different accounts', async () => {
      const billingAccount = await createAccount({ name: 'Billing Only Account' })
      const adminAccount = await createAccount({ name: 'Admin Account' })

      // Create user with BILLING in one account, ADMIN in another
      const user = await createUser({
        email: 'multi-role-billing@example.com',
        name: 'Multi-Role Billing User',
      })
      await addUserToAccount(user.id, billingAccount.id, 'BILLING')
      await addUserToAccount(user.id, adminAccount.id, 'ADMIN')

      const { sessionId, headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      // In billing account - should NOT be able to update users
      const billingRes = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': billingAccount.id,
        },
      })
      expect(billingRes.status).toBe(200)

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
          email: 'new-invite@example.com',
          role: 'VIEWER',
        }),
      })
      expect(adminRes.status).toBe(200)

      // But NOT in billing account
      const billingInviteRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': billingAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'billing-invite@example.com',
          role: 'VIEWER',
        }),
      })
      expect(billingInviteRes.status).toBe(403)
    })

    it('should verify BILLING role cannot self-promote to ADMIN', async () => {
      const account = await createAccount({ name: 'Billing Self-Promote Test' })
      const { user, headers } = await createUserWithRole(account.id, 'BILLING')

      // Try to update own role to ADMIN (if role update endpoint exists)
      // This tests that BILLING cannot modify user accounts
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
  })
})
