/**
 * Role Hierarchy Authorization Integration Tests
 *
 * Comprehensive tests for role-based access control (RBAC) across all API endpoints.
 *
 * Role Hierarchy:
 * - ADMIN (level 0) - highest privilege
 * - MANAGER (level 1)
 * - EDITOR (level 2)
 * - AUTHOR (level 3)
 * - VIEWER (level 4) - lowest privilege
 * - BILLING (level -1) - non-hierarchical, billing-only access
 * - ANALYTICS (level -1) - non-hierarchical, analytics/audit access only
 *
 * Permission Matrix:
 * | Operation               | ADMIN | MANAGER | EDITOR | AUTHOR | VIEWER | BILLING | ANALYTICS |
 * |-------------------------|-------|---------|--------|--------|--------|---------|-----------|
 * | View users              |   Y   |    Y    |   Y    |   Y    |   Y    |    Y    |     Y     |
 * | Update users            |   Y   |    Y    |   N    |   N    |   N    |    N    |     N     |
 * | Delete users            |   Y   |    N    |   N    |   N    |   N    |    N    |     N     |
 * | Restore users           |   Y   |    N    |   N    |   N    |   N    |    N    |     N     |
 * | View accounts           |   Y   |    Y    |   Y    |   Y    |   Y    |    Y    |     Y     |
 * | Update accounts         |   Y   |    Y    |   N    |   N    |   N    |    N    |     N     |
 * | Delete accounts         | super |   N     |   N    |   N    |   N    |    N    |     N     |
 * | Create invitations      |   Y   |    Y    |   N    |   N    |   N    |    N    |     N     |
 * | View invitations        |   Y   |    Y    |   N    |   N    |   N    |    N    |     N     |
 * | Revoke invitations      |   Y   |    Y    |   N    |   N    |   N    |    N    |     N     |
 * | View audit logs         |   Y   |    N    |   N    |   N    |   N    |    N    |     Y     |
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

// ============================================================================
// TEST SETUP
// ============================================================================

/**
 * Creates a D1-compatible database instance for tests
 */
function createTestDb() {
  return getDb()
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

describe('Role Hierarchy Authorization', () => {
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
  // ADMIN ROLE TESTS
  // ============================================================================

  describe('ADMIN role', () => {
    it('should be able to view all users', async () => {
      const account = await createAccount({ name: 'Admin Test Account' })
      const { headers } = await createUserWithRole(account.id, 'ADMIN')

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

    it('should be able to update any user', async () => {
      const account = await createAccount({ name: 'Admin Update Test' })
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Admin Updated Name' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Admin Updated Name')
    })

    it('should be able to delete any user', async () => {
      const account = await createAccount({ name: 'Admin Delete Test' })
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(204)
    })

    it('should be able to restore soft-deleted users', async () => {
      const account = await createAccount({ name: 'Admin Restore Test' })
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')

      // Create a deleted user
      const deletedUser = await createDeletedUser({
        email: 'deleted-for-admin@example.com',
        name: 'Deleted For Admin',
      })
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
        method: 'POST',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should be able to create invitations', async () => {
      const account = await createAccount({ name: 'Admin Invitation Test' })
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-admin@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should be able to list invitations', async () => {
      const account = await createAccount({ name: 'Admin List Invitations Test' })
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')

      const res = await app.request('/api/invitations', {
        method: 'GET',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should be able to update account', async () => {
      const account = await createAccount({ name: 'Admin Account Update Test' })
      const { headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')

      const res = await app.request(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: {
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Account Name' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Updated Account Name')
    })

    it('should be able to view audit logs', async () => {
      const account = await createAccount({ name: 'Admin Audit Test' })
      const { user, headers: adminHeaders } = await createUserWithRole(account.id, 'ADMIN')

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
          ...adminHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('data')
    })
  })

  // ============================================================================
  // MANAGER ROLE TESTS
  // ============================================================================

  describe('MANAGER role', () => {
    it('should be able to view all users', async () => {
      const account = await createAccount({ name: 'Manager View Users Test' })
      const { headers } = await createUserWithRole(account.id, 'MANAGER')

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should be able to update users', async () => {
      const account = await createAccount({ name: 'Manager Update Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Manager Updated Name' }),
      })

      expect(res.status).toBe(200)
    })

    it('should NOT be able to delete users', async () => {
      const account = await createAccount({ name: 'Manager Delete Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to restore soft-deleted users', async () => {
      const account = await createAccount({ name: 'Manager Restore Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')

      const deletedUser = await createDeletedUser({
        email: 'deleted-for-manager@example.com',
        name: 'Deleted For Manager',
      })
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
        method: 'POST',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should be able to create invitations', async () => {
      const account = await createAccount({ name: 'Manager Invitation Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-manager@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should be able to update account', async () => {
      const account = await createAccount({ name: 'Manager Account Update Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')

      const res = await app.request(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Manager Updated Account' }),
      })

      expect(res.status).toBe(200)
    })

    it('should NOT be able to delete account', async () => {
      const account = await createAccount({ name: 'Manager Delete Account Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')

      const res = await app.request(`/api/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to view audit logs', async () => {
      const account = await createAccount({ name: 'Manager Audit Test' })
      const { headers: managerHeaders } = await createUserWithRole(account.id, 'MANAGER')

      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...managerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })
  })

  // ============================================================================
  // EDITOR ROLE TESTS
  // ============================================================================

  describe('EDITOR role', () => {
    it('should be able to view all users', async () => {
      const account = await createAccount({ name: 'Editor View Users Test' })
      const { headers } = await createUserWithRole(account.id, 'EDITOR')

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should NOT be able to update other users', async () => {
      const account = await createAccount({ name: 'Editor Update Test' })
      const { headers: editorHeaders } = await createUserWithRole(account.id, 'EDITOR')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...editorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Editor Updated Name' }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to delete users', async () => {
      const account = await createAccount({ name: 'Editor Delete Test' })
      const { headers: editorHeaders } = await createUserWithRole(account.id, 'EDITOR')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          ...editorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to create invitations', async () => {
      const account = await createAccount({ name: 'Editor Invitation Test' })
      const { headers: editorHeaders } = await createUserWithRole(account.id, 'EDITOR')

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...editorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-editor@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to update account', async () => {
      const account = await createAccount({ name: 'Editor Account Update Test' })
      const { headers: editorHeaders } = await createUserWithRole(account.id, 'EDITOR')

      const res = await app.request(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: {
          ...editorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Editor Updated Account' }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to view audit logs', async () => {
      const account = await createAccount({ name: 'Editor Audit Test' })
      const { headers: editorHeaders } = await createUserWithRole(account.id, 'EDITOR')

      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...editorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })
  })

  // ============================================================================
  // AUTHOR ROLE TESTS
  // ============================================================================

  describe('AUTHOR role', () => {
    it('should be able to view all users', async () => {
      const account = await createAccount({ name: 'Author View Users Test' })
      const { headers } = await createUserWithRole(account.id, 'AUTHOR')

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should NOT be able to update other users', async () => {
      const account = await createAccount({ name: 'Author Update Test' })
      const { headers: authorHeaders } = await createUserWithRole(account.id, 'AUTHOR')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...authorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Author Updated Name' }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to delete users', async () => {
      const account = await createAccount({ name: 'Author Delete Test' })
      const { headers: authorHeaders } = await createUserWithRole(account.id, 'AUTHOR')
      const { user: targetUser } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          ...authorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to create invitations', async () => {
      const account = await createAccount({ name: 'Author Invitation Test' })
      const { headers: authorHeaders } = await createUserWithRole(account.id, 'AUTHOR')

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...authorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-author@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to view audit logs', async () => {
      const account = await createAccount({ name: 'Author Audit Test' })
      const { headers: authorHeaders } = await createUserWithRole(account.id, 'AUTHOR')

      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...authorHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })
  })

  // ============================================================================
  // VIEWER ROLE TESTS
  // ============================================================================

  describe('VIEWER role', () => {
    it('should be able to view all users', async () => {
      const account = await createAccount({ name: 'Viewer View Users Test' })
      const { headers } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should be able to view specific user', async () => {
      const account = await createAccount({ name: 'Viewer Get User Test' })
      const { user, headers } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request(`/api/users/${user.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
    })

    it('should NOT be able to update other users', async () => {
      const account = await createAccount({ name: 'Viewer Update Test' })
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')
      const { user: targetUser } = await createUserWithRole(account.id, 'AUTHOR')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: {
          ...viewerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Viewer Updated Name' }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to delete users', async () => {
      const account = await createAccount({ name: 'Viewer Delete Test' })
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')
      const { user: targetUser } = await createUserWithRole(account.id, 'AUTHOR')

      const res = await app.request(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          ...viewerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to create invitations', async () => {
      const account = await createAccount({ name: 'Viewer Invitation Test' })
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...viewerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invited-by-viewer@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to view audit logs', async () => {
      const account = await createAccount({ name: 'Viewer Audit Test' })
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...viewerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })

    it('should NOT be able to view invitations', async () => {
      const account = await createAccount({ name: 'Viewer List Invitations Test' })
      const { headers: viewerHeaders } = await createUserWithRole(account.id, 'VIEWER')

      const res = await app.request('/api/invitations', {
        method: 'GET',
        headers: {
          ...viewerHeaders,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(403)
    })
  })

  // ============================================================================
  // BILLING ROLE TESTS (Non-hierarchical)
  // ============================================================================

  describe('BILLING role (non-hierarchical)', () => {
    it('should be able to view users (authenticated access)', async () => {
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
    })

    it('should be able to view accounts (authenticated access)', async () => {
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
    })

    it('should NOT be able to update users', async () => {
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

    it('should NOT be able to delete users', async () => {
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

    it('should NOT be able to create invitations', async () => {
      const account = await createAccount({ name: 'Billing Invitation Test' })
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

    it('should NOT be able to view audit logs', async () => {
      const account = await createAccount({ name: 'Billing Audit Test' })
      const { headers: billingHeaders } = await createUserWithRole(account.id, 'BILLING')

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

    it('should NOT be able to update account', async () => {
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
  })

  // ============================================================================
  // ANALYTICS ROLE TESTS (Non-hierarchical)
  // ============================================================================

  describe('ANALYTICS role (non-hierarchical)', () => {
    it('should be able to view users (authenticated access)', async () => {
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
    })

    it('should be able to view audit logs (special permission)', async () => {
      const account = await createAccount({ name: 'Analytics Audit Test' })
      const { user, headers } = await createUserWithRole(account.id, 'ANALYTICS')

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
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('data')
    })

    it('should NOT be able to update users', async () => {
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

    it('should NOT be able to delete users', async () => {
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

    it('should NOT be able to create invitations', async () => {
      const account = await createAccount({ name: 'Analytics Invitation Test' })
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

    it('should NOT be able to update account', async () => {
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
  })

  // ============================================================================
  // ROLE HIERARCHY VERIFICATION TESTS
  // ============================================================================

  describe('Role hierarchy verification', () => {
    it('should allow higher roles to access lower role endpoints (ADMIN > MANAGER > EDITOR > AUTHOR > VIEWER)', async () => {
      const account = await createAccount({ name: 'Hierarchy Test' })

      // Create users with different roles
      const admin = await createUserWithRole(account.id, 'ADMIN')
      const manager = await createUserWithRole(account.id, 'MANAGER')
      const editor = await createUserWithRole(account.id, 'EDITOR')
      const author = await createUserWithRole(account.id, 'AUTHOR')
      const viewer = await createUserWithRole(account.id, 'VIEWER')

      // Test user list (all should have access)
      for (const { headers, user } of [admin, manager, editor, author, viewer]) {
        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })
        expect(res.status).toBe(200)
      }

      // Test update (only ADMIN and MANAGER should have access)
      const testTarget = await createUser({ email: 'update-target@example.com', name: 'Target' })
      await addUserToAccount(testTarget.id, account.id, 'VIEWER')

      // Admin should succeed
      const adminUpdateRes = await app.request(`/api/users/${testTarget.id}`, {
        method: 'PATCH',
        headers: {
          ...admin.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Admin Updated' }),
      })
      expect(adminUpdateRes.status).toBe(200)

      // Manager should succeed
      const managerUpdateRes = await app.request(`/api/users/${testTarget.id}`, {
        method: 'PATCH',
        headers: {
          ...manager.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Manager Updated' }),
      })
      expect(managerUpdateRes.status).toBe(200)

      // Editor, Author, Viewer should fail
      for (const { headers } of [editor, author, viewer]) {
        const res = await app.request(`/api/users/${testTarget.id}`, {
          method: 'PATCH',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Fail' }),
        })
        expect(res.status).toBe(403)
      }
    })

    it('should enforce that non-hierarchical roles (BILLING, ANALYTICS) do not inherit from hierarchy', async () => {
      const account = await createAccount({ name: 'Non-Hierarchical Test' })

      const billing = await createUserWithRole(account.id, 'BILLING')
      const analytics = await createUserWithRole(account.id, 'ANALYTICS')
      const testTarget = await createUser({ email: 'nonhier-target@example.com', name: 'Target' })
      await addUserToAccount(testTarget.id, account.id, 'VIEWER')

      // Both BILLING and ANALYTICS should NOT have MANAGER or ADMIN powers

      // BILLING should not be able to update users
      const billingUpdateRes = await app.request(`/api/users/${testTarget.id}`, {
        method: 'PATCH',
        headers: {
          ...billing.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Billing Update' }),
      })
      expect(billingUpdateRes.status).toBe(403)

      // ANALYTICS should not be able to update users
      const analyticsUpdateRes = await app.request(`/api/users/${testTarget.id}`, {
        method: 'PATCH',
        headers: {
          ...analytics.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Analytics Update' }),
      })
      expect(analyticsUpdateRes.status).toBe(403)

      // BILLING should not be able to create invitations
      const billingInviteRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...billing.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com', role: 'VIEWER' }),
      })
      expect(billingInviteRes.status).toBe(403)

      // ANALYTICS should not be able to create invitations
      const analyticsInviteRes = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...analytics.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com', role: 'VIEWER' }),
      })
      expect(analyticsInviteRes.status).toBe(403)
    })

    it('should allow ANALYTICS role special access to audit logs while BILLING cannot', async () => {
      const account = await createAccount({ name: 'Analytics vs Billing Audit Test' })

      const analytics = await createUserWithRole(account.id, 'ANALYTICS')
      const billing = await createUserWithRole(account.id, 'BILLING')

      // Create an audit log
      createAuditLog({
        accountId: account.id,
        userId: analytics.user.id,
        entity: 'User',
        entityId: crypto.randomUUID(),
        action: 'INSERT',
      })

      // ANALYTICS should be able to view audits
      const analyticsAuditRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...analytics.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(analyticsAuditRes.status).toBe(200)

      // BILLING should NOT be able to view audits
      const billingAuditRes = await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...billing.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
        },
      })
      expect(billingAuditRes.status).toBe(403)
    })
  })

  // ============================================================================
  // PERMISSION MATRIX VERIFICATION TESTS
  // ============================================================================

  describe('Permission matrix verification', () => {
    const roleOperationMatrix: {
      role: Role
      operation: string
      endpoint: string
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
      shouldSucceed: boolean
      body?: Record<string, unknown>
    }[] = [
      // ADMIN - should have access to everything
      { role: 'ADMIN', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'ADMIN', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: true },
      { role: 'ADMIN', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: true },

      // MANAGER - limited management access
      { role: 'MANAGER', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'MANAGER', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: true },
      { role: 'MANAGER', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: false },

      // EDITOR - read + content access
      { role: 'EDITOR', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'EDITOR', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: false },
      { role: 'EDITOR', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: false },

      // AUTHOR - own content access
      { role: 'AUTHOR', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'AUTHOR', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: false },
      { role: 'AUTHOR', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: false },

      // VIEWER - read-only access
      { role: 'VIEWER', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'VIEWER', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: false },
      { role: 'VIEWER', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: false },

      // BILLING - billing-only access
      { role: 'BILLING', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'BILLING', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: false },
      { role: 'BILLING', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: false },

      // ANALYTICS - analytics/audit access
      { role: 'ANALYTICS', operation: 'View users', endpoint: '/api/users', method: 'GET', shouldSucceed: true },
      { role: 'ANALYTICS', operation: 'View invitations', endpoint: '/api/invitations', method: 'GET', shouldSucceed: false },
      { role: 'ANALYTICS', operation: 'View audits', endpoint: '/api/audits', method: 'GET', shouldSucceed: true },
    ]

    for (const testCase of roleOperationMatrix) {
      it(`${testCase.role} ${testCase.shouldSucceed ? 'CAN' : 'CANNOT'} ${testCase.operation}`, async () => {
        const account = await createAccount({ name: `Matrix Test ${testCase.role} ${testCase.operation}` })
        const { user, headers } = await createUserWithRole(account.id, testCase.role)

        // Create audit log for audit tests
        if (testCase.endpoint === '/api/audits') {
          createAuditLog({
            accountId: account.id,
            userId: user.id,
            entity: 'Test',
            entityId: crypto.randomUUID(),
            action: 'INSERT',
          })
        }

        const requestInit: RequestInit = {
          method: testCase.method,
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        }

        if (testCase.body) {
          requestInit.headers = {
            ...requestInit.headers,
            'Content-Type': 'application/json',
          }
          requestInit.body = JSON.stringify(testCase.body)
        }

        const res = await app.request(testCase.endpoint, requestInit)

        if (testCase.shouldSucceed) {
          expect(res.status).toBe(200)
        } else {
          expect(res.status).toBe(403)
        }
      })
    }
  })
})
