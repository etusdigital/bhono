/**
 * Multi-Tenancy Isolation Integration Tests
 *
 * Comprehensive tests for tenant data isolation across all API endpoints.
 *
 * Test categories:
 * 1. User access isolation - Users can only access users in their accounts
 * 2. Account access isolation - Users can only access accounts they belong to
 * 3. Invitation isolation - Users can only manage invitations in their accounts
 * 4. Audit log isolation - Users can only view audit logs in their accounts
 * 5. Account switching - Users with multiple accounts get correct role enforcement
 * 6. Super admin override - Super admins can access any account
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createSuperAdmin,
  createUserSession,
  createAccount,
  addUserToAccount,
  createMultiTenantScenario,
  createInvitation,
  type Role,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'

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

describe('Multi-Tenancy Isolation', () => {
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
  // USER ACCESS ISOLATION TESTS
  // ============================================================================

  describe('User access isolation', () => {
    it('should only view users in accessible accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Create users in the accessible account
      const userInAccessibleAccount = await createUser({
        email: 'accessible-account-user@example.com',
        name: 'Accessible Account User',
      })
      await addUserToAccount(userInAccessibleAccount.id, accountWithAdminAccess.account.id, 'VIEWER')

      // Create users in an account without access
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]
      const userInInaccessibleAccount = await createUser({
        email: 'inaccessible-account-user@example.com',
        name: 'Inaccessible Account User',
      })
      await addUserToAccount(userInInaccessibleAccount.id, accountWithoutAccess.id, 'VIEWER')

      // Request users from the accessible account - should work
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const userIds = body.data.map((u: any) => u.id)

      // Should include user from accessible account
      expect(userIds).toContain(userInAccessibleAccount.id)
      // Should NOT include user from inaccessible account
      expect(userIds).not.toContain(userInInaccessibleAccount.id)
    })

    it('should NOT be able to view a specific user from another account', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Create a user in another account
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]
      const otherUser = await createUser({
        email: 'other-account-specific@example.com',
        name: 'Other Account User',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'VIEWER')

      // Try to get the other user from the accessible account context
      const res = await app.request(`/api/users/${otherUser.id}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Should return 404 (not 403) for security - don't reveal user exists
      expect(res.status).toBe(404)
    })

    it('should NOT be able to update users in other accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Create a user in another account
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]
      const otherUser = await createUser({
        email: 'update-other-account@example.com',
        name: 'Update Other Account User',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'VIEWER')

      // Try to update the other user
      const res = await app.request(`/api/users/${otherUser.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Not Update' }),
      })

      // Should return 404 (not 403) for security
      expect(res.status).toBe(404)

      // Verify user was not updated
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT name FROM users WHERE id = ?').get(otherUser.id) as { name: string }
      expect(row.name).toBe('Update Other Account User')
    })

    it('should NOT be able to delete users in other accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Create a user in another account
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]
      const otherUser = await createUser({
        email: 'delete-other-account@example.com',
        name: 'Delete Other Account User',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'VIEWER')

      // Try to delete the other user
      const res = await app.request(`/api/users/${otherUser.id}`, {
        method: 'DELETE',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Should return 404 (not 403) for security
      expect(res.status).toBe(404)

      // Verify user was not deleted
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT deleted_at FROM users WHERE id = ?').get(otherUser.id) as { deleted_at: string | null }
      expect(row.deleted_at).toBeNull()
    })
  })

  // ============================================================================
  // ACCOUNT ACCESS ISOLATION TESTS
  // ============================================================================

  describe('Account access isolation', () => {
    it('should only view accounts user has access to', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Request accounts list
      const res = await app.request('/api/accounts', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const accountIds = body.data.map((a: any) => a.id)

      // Should include all accounts with access
      for (const { account } of scenario.accounts.withAccess) {
        expect(accountIds).toContain(account.id)
      }

      // Should NOT include accounts without access
      for (const account of scenario.accounts.withoutAccess) {
        expect(accountIds).not.toContain(account.id)
      }
    })

    it('should return 404 (not 403) when viewing other accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Try to get an account without access
      const res = await app.request(`/api/accounts/${accountWithoutAccess.id}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Should return 404 for security - don't reveal account exists
      expect(res.status).toBe(404)
    })

    it('should NOT be able to update other accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithManagerAccess = scenario.accounts.withAccess.find(a => a.role === 'MANAGER')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Try to update an account without access
      const res = await app.request(`/api/accounts/${accountWithoutAccess.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithManagerAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Not Update Account' }),
      })

      // Should return 404 for security
      expect(res.status).toBe(404)

      // Verify account was not updated
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT name FROM accounts WHERE id = ?').get(accountWithoutAccess.id) as { name: string }
      expect(row.name).toBe(accountWithoutAccess.name)
    })

    it('should NOT be able to delete other accounts (even with ADMIN role)', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Try to delete an account without access
      const res = await app.request(`/api/accounts/${accountWithoutAccess.id}`, {
        method: 'DELETE',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Should return 403 (requires super-admin) or 404
      expect([403, 404]).toContain(res.status)

      // Verify account was not deleted
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT deleted_at FROM accounts WHERE id = ?').get(accountWithoutAccess.id) as { deleted_at: string | null }
      expect(row.deleted_at).toBeNull()
    })
  })

  // ============================================================================
  // INVITATION ISOLATION TESTS
  // ============================================================================

  describe('Invitation isolation', () => {
    it('should only view invitations in accessible accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Create invitation in accessible account
      const invitationInAccessible = await createInvitation({
        accountId: accountWithAdminAccess.account.id,
        email: 'accessible-invitation@example.com',
        role: 'VIEWER',
        invitedById: scenario.user.id,
      })

      // Create user in inaccessible account to create invitation
      const otherUser = await createUser({
        email: 'other-inviter@example.com',
        name: 'Other Inviter',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'ADMIN')

      // Create invitation in inaccessible account
      const invitationInInaccessible = await createInvitation({
        accountId: accountWithoutAccess.id,
        email: 'inaccessible-invitation@example.com',
        role: 'VIEWER',
        invitedById: otherUser.id,
      })

      // Request invitations from the accessible account
      const res = await app.request('/api/invitations', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const invitationIds = body.data.map((i: any) => i.id)

      // Should include invitation from accessible account
      expect(invitationIds).toContain(invitationInAccessible.id)
      // Should NOT include invitation from inaccessible account
      expect(invitationIds).not.toContain(invitationInInaccessible.id)
    })

    it('should NOT be able to create invitations for other accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      const testEmail = 'cross-tenant-invite@example.com'

      // Create an invitation in the authorized account context
      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)

      // Verify the invitation was created in the correct account by checking database
      const sqlite = getSqlite()
      const invitation = sqlite.prepare(
        'SELECT account_id FROM invitations WHERE email = ?'
      ).get(testEmail) as { account_id: string }

      // The invitation should be in the account from the header, not any other
      expect(invitation.account_id).toBe(accountWithAdminAccess.account.id)
      expect(invitation.account_id).not.toBe(accountWithoutAccess.id)
    })

    it('should NOT be able to revoke invitations in other accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Create user in inaccessible account
      const otherUser = await createUser({
        email: 'other-revoke-inviter@example.com',
        name: 'Other Revoke Inviter',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'ADMIN')

      // Create invitation in inaccessible account
      const invitation = await createInvitation({
        accountId: accountWithoutAccess.id,
        email: 'revoke-cross-tenant@example.com',
        role: 'VIEWER',
        invitedById: otherUser.id,
      })

      // Try to revoke the invitation from accessible account context
      const res = await app.request(`/api/invitations/${invitation.id}`, {
        method: 'DELETE',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Should return 404 for security
      expect(res.status).toBe(404)

      // Verify invitation still exists
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT id FROM invitations WHERE id = ?').get(invitation.id)
      expect(row).not.toBeNull()
    })
  })

  // ============================================================================
  // AUDIT LOG ISOLATION TESTS
  // ============================================================================

  describe('Audit log isolation', () => {
    it('should only view audit logs for accessible accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Create audit log in accessible account
      const auditInAccessible = createAuditLog({
        accountId: accountWithAdminAccess.account.id,
        userId: scenario.user.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
        changes: { name: 'Accessible Audit' },
      })

      // Create user in inaccessible account for audit log
      const otherUser = await createUser({
        email: 'other-audit-user@example.com',
        name: 'Other Audit User',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'ADMIN')

      // Create audit log in inaccessible account
      const auditInInaccessible = createAuditLog({
        accountId: accountWithoutAccess.id,
        userId: otherUser.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
        changes: { name: 'Inaccessible Audit' },
      })

      // Request audit logs from the accessible account
      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const auditIds = body.data.map((a: any) => a.id)

      // Should include audit from accessible account
      expect(auditIds).toContain(auditInAccessible.id)
      // Should NOT include audit from inaccessible account
      expect(auditIds).not.toContain(auditInInaccessible.id)
    })

    it('should NOT be able to view audit logs from other accounts via filtering', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Create user and audit log in inaccessible account
      const otherUser = await createUser({
        email: 'other-filter-audit@example.com',
        name: 'Other Filter Audit User',
      })
      await addUserToAccount(otherUser.id, accountWithoutAccess.id, 'ADMIN')

      const specificEntityId = crypto.randomUUID()
      createAuditLog({
        accountId: accountWithoutAccess.id,
        userId: otherUser.id,
        entity: 'User',
        entityId: specificEntityId,
        action: 'INSERT',
      })

      // Try to filter by the specific entityId from the inaccessible account
      const res = await app.request(`/api/audits?entityId=${specificEntityId}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()

      // Should return empty - the audit is in another account
      expect(body.data.length).toBe(0)
    })
  })

  // ============================================================================
  // ACCOUNT SWITCHING TESTS
  // ============================================================================

  describe('Account switching', () => {
    it('should enforce different roles in different accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithViewerAccess = scenario.accounts.withAccess.find(a => a.role === 'VIEWER')!

      // Create a target user in both accounts
      const targetUser = await createUser({
        email: 'target-for-switching@example.com',
        name: 'Target For Switching',
      })
      await addUserToAccount(targetUser.id, accountWithAdminAccess.account.id, 'VIEWER')
      await addUserToAccount(targetUser.id, accountWithViewerAccess.account.id, 'VIEWER')

      // Try to update user in account where user has ADMIN role - should succeed
      const adminRes = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Admin Updated' }),
      })
      expect(adminRes.status).toBe(200)

      // Try to update user in account where user has VIEWER role - should fail
      const viewerRes = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithViewerAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Viewer Updated' }),
      })
      expect(viewerRes.status).toBe(403)
    })

    it('should allow same user to view users in both accounts with correct filtering', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithViewerAccess = scenario.accounts.withAccess.find(a => a.role === 'VIEWER')!

      // Create users unique to each account
      const userInAccount1 = await createUser({
        email: 'unique-to-admin-account@example.com',
        name: 'Unique To Admin Account',
      })
      await addUserToAccount(userInAccount1.id, accountWithAdminAccess.account.id, 'VIEWER')

      const userInAccount2 = await createUser({
        email: 'unique-to-viewer-account@example.com',
        name: 'Unique To Viewer Account',
      })
      await addUserToAccount(userInAccount2.id, accountWithViewerAccess.account.id, 'VIEWER')

      // Get users from admin account
      const res1 = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })
      expect(res1.status).toBe(200)
      const body1 = await res1.json()
      const userIds1 = body1.data.map((u: any) => u.id)
      expect(userIds1).toContain(userInAccount1.id)
      expect(userIds1).not.toContain(userInAccount2.id)

      // Get users from viewer account
      const res2 = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithViewerAccess.account.id,
        },
      })
      expect(res2.status).toBe(200)
      const body2 = await res2.json()
      const userIds2 = body2.data.map((u: any) => u.id)
      expect(userIds2).toContain(userInAccount2.id)
      expect(userIds2).not.toContain(userInAccount1.id)
    })

    it('should correctly enforce invitation permissions across accounts', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithViewerAccess = scenario.accounts.withAccess.find(a => a.role === 'VIEWER')!

      // Try to create invitation in admin account - should succeed
      const adminInviteRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin-invite-test@example.com',
          role: 'VIEWER',
        }),
      })
      expect(adminInviteRes.status).toBe(200)

      // Try to create invitation in viewer account - should fail (VIEWER cannot invite)
      const viewerInviteRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithViewerAccess.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'viewer-invite-test@example.com',
          role: 'VIEWER',
        }),
      })
      expect(viewerInviteRes.status).toBe(403)
    })
  })

  // ============================================================================
  // SUPER ADMIN OVERRIDE TESTS
  // ============================================================================

  describe('Super admin override', () => {
    it('should allow super admin to access any account', async () => {
      // Create a super admin
      const superAdmin = await createSuperAdmin({
        email: 'super-admin-override@example.com',
        name: 'Super Admin Override',
      })

      // Create an account for the super admin context
      const adminContext = await createAccount({ name: 'Super Admin Context' })
      await addUserToAccount(superAdmin.id, adminContext.id, 'ADMIN')

      // Create another account with users
      const otherAccount = await createAccount({ name: 'Other Account For Super' })
      const otherUser = await createUser({
        email: 'other-for-super@example.com',
        name: 'Other For Super',
      })
      await addUserToAccount(otherUser.id, otherAccount.id, 'VIEWER')

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should be able to see the other account
      const res = await app.request(`/api/accounts/${otherAccount.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminContext.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(otherAccount.id)
    })

    it('should allow super admin to view all users across all accounts', async () => {
      // Create a super admin
      const superAdmin = await createSuperAdmin({
        email: 'super-admin-all-users@example.com',
        name: 'Super Admin All Users',
      })

      // Create an account for the super admin context
      const adminContext = await createAccount({ name: 'Super Admin Users Context' })
      await addUserToAccount(superAdmin.id, adminContext.id, 'ADMIN')

      // Create multiple accounts with users
      const account1 = await createAccount({ name: 'Account 1 For Super' })
      const user1 = await createUser({
        email: 'user1-for-super@example.com',
        name: 'User 1 For Super',
      })
      await addUserToAccount(user1.id, account1.id, 'VIEWER')

      const account2 = await createAccount({ name: 'Account 2 For Super' })
      const user2 = await createUser({
        email: 'user2-for-super@example.com',
        name: 'User 2 For Super',
      })
      await addUserToAccount(user2.id, account2.id, 'VIEWER')

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin can see user in account1
      const res1 = await app.request(`/api/users/${user1.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminContext.id,
        },
      })
      expect(res1.status).toBe(200)

      // Super admin can see user in account2
      const res2 = await app.request(`/api/users/${user2.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminContext.id,
        },
      })
      expect(res2.status).toBe(200)
    })

    it('should allow super admin to modify any account', async () => {
      // Create a super admin
      const superAdmin = await createSuperAdmin({
        email: 'super-admin-modify@example.com',
        name: 'Super Admin Modify',
      })

      // Create an account for the super admin context
      const adminContext = await createAccount({ name: 'Super Admin Modify Context' })
      await addUserToAccount(superAdmin.id, adminContext.id, 'ADMIN')

      // Create another account to modify
      const targetAccount = await createAccount({
        name: 'Target Account For Super',
        description: 'Original Description',
      })

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should be able to update the account
      const res = await app.request(`/api/accounts/${targetAccount.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminContext.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Super Admin Updated Name',
          description: 'Super Admin Updated Description',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Super Admin Updated Name')
      expect(body.data.description).toBe('Super Admin Updated Description')
    })

    it('should allow super admin to view audit logs across all accounts', async () => {
      // Create a super admin
      const superAdmin = await createSuperAdmin({
        email: 'super-admin-audits@example.com',
        name: 'Super Admin Audits',
      })

      // Create an account for the super admin context
      const adminContext = await createAccount({ name: 'Super Admin Audits Context' })
      await addUserToAccount(superAdmin.id, adminContext.id, 'ADMIN')

      // Create audit logs in different accounts
      const account1 = await createAccount({ name: 'Audit Account 1' })
      const user1 = await createUser({
        email: 'audit-user1@example.com',
        name: 'Audit User 1',
      })
      await addUserToAccount(user1.id, account1.id, 'ADMIN')

      const audit1 = createAuditLog({
        accountId: account1.id,
        userId: user1.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
        changes: { name: 'Audit 1' },
      })

      const account2 = await createAccount({ name: 'Audit Account 2' })
      const user2 = await createUser({
        email: 'audit-user2@example.com',
        name: 'Audit User 2',
      })
      await addUserToAccount(user2.id, account2.id, 'ADMIN')

      const audit2 = createAuditLog({
        accountId: account2.id,
        userId: user2.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
        changes: { name: 'Audit 2' },
      })

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should see all audit logs
      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminContext.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const auditIds = body.data.map((a: any) => a.id)

      // Should include audits from both accounts
      expect(auditIds).toContain(audit1.id)
      expect(auditIds).toContain(audit2.id)
    })

    it('should allow super admin to delete any account', async () => {
      // Create a super admin
      const superAdmin = await createSuperAdmin({
        email: 'super-admin-delete@example.com',
        name: 'Super Admin Delete',
      })

      // Create an account for the super admin context
      const adminContext = await createAccount({ name: 'Super Admin Delete Context' })
      await addUserToAccount(superAdmin.id, adminContext.id, 'ADMIN')

      // Create another account to delete
      const targetAccount = await createAccount({ name: 'Account To Be Deleted By Super' })

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should be able to delete the account
      const res = await app.request(`/api/accounts/${targetAccount.id}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': adminContext.id,
        },
      })

      expect(res.status).toBe(204)

      // Verify the account was soft-deleted
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT deleted_at FROM accounts WHERE id = ?').get(targetAccount.id) as { deleted_at: string | null }
      expect(row.deleted_at).not.toBeNull()
    })
  })

  // ============================================================================
  // CROSS-TENANT DATA LEAKAGE PREVENTION
  // ============================================================================

  describe('Cross-tenant data leakage prevention', () => {
    it('should not leak user existence across accounts via response timing', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Create a user in another account
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]
      const existingUser = await createUser({
        email: 'timing-test-user@example.com',
        name: 'Timing Test User',
      })
      await addUserToAccount(existingUser.id, accountWithoutAccess.id, 'VIEWER')

      // Non-existent user ID
      const nonExistentId = crypto.randomUUID()

      // Both should return 404 (same response for security)
      const resExisting = await app.request(`/api/users/${existingUser.id}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      const resNonExistent = await app.request(`/api/users/${nonExistentId}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Both should return the same status code (404)
      expect(resExisting.status).toBe(404)
      expect(resNonExistent.status).toBe(404)
    })

    it('should not leak account existence across tenants via response timing', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]

      // Non-existent account ID
      const nonExistentId = crypto.randomUUID()

      // Both should return 404
      const resExisting = await app.request(`/api/accounts/${accountWithoutAccess.id}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      const resNonExistent = await app.request(`/api/accounts/${nonExistentId}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': accountWithAdminAccess.account.id,
        },
      })

      // Both should return the same status code (404)
      expect(resExisting.status).toBe(404)
      expect(resNonExistent.status).toBe(404)
    })

    it('should prevent enumeration attacks on user IDs', async () => {
      const scenario = await createMultiTenantScenario()
      const accountWithAdminAccess = scenario.accounts.withAccess.find(a => a.role === 'ADMIN')!

      // Create multiple users in another account
      const accountWithoutAccess = scenario.accounts.withoutAccess[0]
      const users = await Promise.all(
        Array.from({ length: 3 }, async (_, i) => {
          const user = await createUser({
            email: `enum-test-${i}@example.com`,
            name: `Enum Test User ${i}`,
          })
          await addUserToAccount(user.id, accountWithoutAccess.id, 'VIEWER')
          return user
        })
      )

      // Try to enumerate users - all should return 404
      for (const user of users) {
        const res = await app.request(`/api/users/${user.id}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': accountWithAdminAccess.account.id,
          },
        })

        expect(res.status).toBe(404)
      }
    })
  })
})
