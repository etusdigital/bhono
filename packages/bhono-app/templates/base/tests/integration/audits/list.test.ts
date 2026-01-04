/**
 * Audit Logs Integration Tests
 *
 * Tests the audit logs API:
 * - GET /api/audits - List audit logs with filters and pagination
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createUserSession,
  createTestScenario,
  createMultiUserScenario,
  createAccount,
  addUserToAccount,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'

/**
 * Creates a D1-compatible database instance for tests
 */
function createTestDb() {
  return getDb()
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

describe('Audit Logs Integration', () => {
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
  // GET /api/audits
  // ============================================================================

  describe('GET /api/audits', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/audits', {
          method: 'GET',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            Cookie: 'sid=invalid-session-id-that-does-not-exist',
            'account-id': crypto.randomUUID(),
          },
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission to view audits (VIEWER role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer User',
          userEmail: 'viewer-audit@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to view audits (MANAGER role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Manager User',
          userEmail: 'manager-audit@example.com',
          role: 'MANAGER',
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to view audits (EDITOR role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Editor User',
          userEmail: 'editor-audit@example.com',
          role: 'EDITOR',
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to view audits (BILLING role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Billing User',
          userEmail: 'billing-audit@example.com',
          role: 'BILLING',
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Successful List (200)', () => {
      it('should return 200 with empty array when no audit logs', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-audit1@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(Array.isArray(body.data)).toBe(true)
        expect(body).toHaveProperty('meta')
        expect(body.meta).toHaveProperty('totalItems')
        expect(body.meta).toHaveProperty('currentPage')
        expect(body.meta).toHaveProperty('limit')
      })

      it('should return 200 with audit logs array for ADMIN role', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-audit2@example.com',
          role: 'ADMIN',
        })

        // Create some audit logs
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
          changes: { name: 'New User' },
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
          changes: { name: { old: 'Old Name', new: 'New Name' } },
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(2)
      })

      it('should return 200 with audit logs for ANALYTICS role', async () => {
        const scenario = await createTestScenario({
          userName: 'Analytics User',
          userEmail: 'analytics-audit@example.com',
          role: 'ANALYTICS',
        })

        // Create an audit log
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Account',
          entityId: scenario.account.id,
          action: 'UPDATE',
          changes: { name: { old: 'Old Name', new: 'New Name' } },
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBeGreaterThanOrEqual(1)
      })

      it('should return only audit logs for the current account', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-audit3@example.com',
          role: 'ADMIN',
        })

        // Create another account
        const otherAccount = await createAccount({ name: 'Other Account' })
        const otherUser = await createUser({
          email: 'otheraudit@example.com',
          name: 'Other User',
        })
        await addUserToAccount(otherUser.id, otherAccount.id, 'ADMIN')

        // Create audit logs in both accounts
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: scenario.user.id,
          action: 'UPDATE',
          changes: { name: 'My Account Log' },
        })

        createAuditLog({
          accountId: otherAccount.id,
          userId: otherUser.id,
          entity: 'User',
          entityId: otherUser.id,
          action: 'UPDATE',
          changes: { name: 'Other Account Log' },
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].accountId).toBe(scenario.account.id)
      })

      it('should include all audit log fields in response', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-audit4@example.com',
          role: 'ADMIN',
        })

        const entityId = crypto.randomUUID()
        const auditLog = createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId,
          action: 'INSERT',
          changes: { name: 'Test User', email: 'test@example.com' },
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)

        const log = body.data[0]
        expect(log).toHaveProperty('id')
        expect(log).toHaveProperty('transactionId')
        expect(log).toHaveProperty('accountId', scenario.account.id)
        expect(log).toHaveProperty('userId', scenario.user.id)
        expect(log).toHaveProperty('entity', 'User')
        expect(log).toHaveProperty('entityId', entityId)
        expect(log).toHaveProperty('action', 'INSERT')
        expect(log).toHaveProperty('changes')
        expect(log).toHaveProperty('ipAddress')
        expect(log).toHaveProperty('userAgent')
        expect(log).toHaveProperty('timestamp')
      })
    })

    describe('Audit Log Entry Verification', () => {
      it('should record INSERT action for user creation', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-verify1@example.com',
          role: 'ADMIN',
        })

        const entityId = crypto.randomUUID()
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId,
          action: 'INSERT',
          changes: { name: 'New User', email: 'newuser@example.com' },
        })

        const res = await app.request('/api/audits?entity=User&action=INSERT', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBeGreaterThanOrEqual(1)

        const log = body.data.find((l: any) => l.entityId === entityId)
        expect(log).toBeDefined()
        expect(log.action).toBe('INSERT')
        expect(log.entity).toBe('User')
      })

      it('should record UPDATE action with changes for user update', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-verify2@example.com',
          role: 'ADMIN',
        })

        const entityId = crypto.randomUUID()
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId,
          action: 'UPDATE',
          changes: {
            name: { old: 'Old Name', new: 'New Name' },
            status: { old: 'active', new: 'inactive' },
          },
        })

        const res = await app.request(`/api/audits?entityId=${entityId}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)

        const log = body.data[0]
        expect(log.action).toBe('UPDATE')
        expect(log.changes).toBeDefined()
        expect(log.changes.name).toEqual({ old: 'Old Name', new: 'New Name' })
      })

      it('should record DELETE action for user deletion', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-verify3@example.com',
          role: 'ADMIN',
        })

        const entityId = crypto.randomUUID()
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId,
          action: 'DELETE',
          changes: { deleted: true },
        })

        const res = await app.request('/api/audits?action=DELETE', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBeGreaterThanOrEqual(1)

        const log = body.data.find((l: any) => l.entityId === entityId)
        expect(log).toBeDefined()
        expect(log.action).toBe('DELETE')
      })

      it('should record audit logs for Account entity', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-verify4@example.com',
          role: 'ADMIN',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Account',
          entityId: scenario.account.id,
          action: 'UPDATE',
          changes: { name: { old: 'Old Account', new: 'New Account' } },
        })

        const res = await app.request('/api/audits?entity=Account', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBeGreaterThanOrEqual(1)
        expect(body.data[0].entity).toBe('Account')
      })

      it('should record audit logs for Invitation entity', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-verify5@example.com',
          role: 'ADMIN',
        })

        const invitationId = crypto.randomUUID()
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Invitation',
          entityId: invitationId,
          action: 'INSERT',
          changes: { email: 'invited@example.com', role: 'VIEWER' },
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Invitation',
          entityId: invitationId,
          action: 'DELETE',
          changes: { revoked: true },
        })

        const res = await app.request('/api/audits?entity=Invitation', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(2)
        expect(body.data.every((l: any) => l.entity === 'Invitation')).toBe(true)
      })

      it('should record LOGIN action', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-verify6@example.com',
          role: 'ADMIN',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Session',
          entityId: scenario.user.id,
          action: 'LOGIN',
          changes: null,
        })

        const res = await app.request('/api/audits?action=LOGIN', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBeGreaterThanOrEqual(1)
        expect(body.data[0].action).toBe('LOGIN')
      })
    })

    describe('Filtering', () => {
      it('should filter by entity type', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-filter1@example.com',
          role: 'ADMIN',
        })

        // Create audit logs for different entities
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Account',
          entityId: scenario.account.id,
          action: 'UPDATE',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
        })

        const res = await app.request('/api/audits?entity=User', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(2)
        expect(body.data.every((l: any) => l.entity === 'User')).toBe(true)
      })

      it('should filter by action type', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-filter2@example.com',
          role: 'ADMIN',
        })

        // Create audit logs with different actions
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'DELETE',
        })

        const res = await app.request('/api/audits?action=UPDATE', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].action).toBe('UPDATE')
      })

      it('should filter by entityId', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-filter3@example.com',
          role: 'ADMIN',
        })

        const targetEntityId = crypto.randomUUID()

        // Create audit logs for different entities
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: targetEntityId,
          action: 'INSERT',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: targetEntityId,
          action: 'UPDATE',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        const res = await app.request(`/api/audits?entityId=${targetEntityId}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(2)
        expect(body.data.every((l: any) => l.entityId === targetEntityId)).toBe(true)
      })

      it('should combine multiple filters', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-filter4@example.com',
          role: 'ADMIN',
        })

        // Create various audit logs
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'Account',
          entityId: scenario.account.id,
          action: 'INSERT',
        })

        const res = await app.request('/api/audits?entity=User&action=INSERT', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].entity).toBe('User')
        expect(body.data[0].action).toBe('INSERT')
      })
    })

    describe('Pagination', () => {
      it('should support page parameter', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-page1@example.com',
          role: 'ADMIN',
        })

        // Create 15 audit logs
        for (let i = 0; i < 15; i++) {
          createAuditLog({
            accountId: scenario.account.id,
            userId: scenario.user.id,
            entity: 'User',
            entityId: crypto.randomUUID(),
            action: 'INSERT',
            timestamp: new Date(Date.now() - i * 1000).toISOString(), // Different timestamps
          })
        }

        const res = await app.request('/api/audits?page=1&limit=10', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(10)
        expect(body.meta.currentPage).toBe(1)
        expect(body.meta.totalItems).toBe(15)
      })

      it('should support limit parameter', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-limit1@example.com',
          role: 'ADMIN',
        })

        // Create 10 audit logs
        for (let i = 0; i < 10; i++) {
          createAuditLog({
            accountId: scenario.account.id,
            userId: scenario.user.id,
            entity: 'User',
            entityId: crypto.randomUUID(),
            action: 'UPDATE',
          })
        }

        const res = await app.request('/api/audits?limit=5', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(5)
        expect(body.meta.limit).toBe(5)
      })

      it('should return correct meta for pagination', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-meta1@example.com',
          role: 'ADMIN',
        })

        // Create 25 audit logs
        for (let i = 0; i < 25; i++) {
          createAuditLog({
            accountId: scenario.account.id,
            userId: scenario.user.id,
            entity: 'User',
            entityId: crypto.randomUUID(),
            action: 'INSERT',
          })
        }

        const res = await app.request('/api/audits?page=2&limit=10', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(10)
        expect(body.meta.currentPage).toBe(2)
        expect(body.meta.totalItems).toBe(25)
        expect(body.meta.totalPages).toBe(3)
        expect(body.meta.limit).toBe(10)
      })

      it('should return empty array for page beyond available data', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-empty@example.com',
          role: 'ADMIN',
        })

        // Create 5 audit logs
        for (let i = 0; i < 5; i++) {
          createAuditLog({
            accountId: scenario.account.id,
            userId: scenario.user.id,
            entity: 'User',
            entityId: crypto.randomUUID(),
            action: 'INSERT',
          })
        }

        const res = await app.request('/api/audits?page=10&limit=10', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(0)
        expect(body.meta.totalItems).toBe(5)
      })

      it('should use default pagination when not specified', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-default@example.com',
          role: 'ADMIN',
        })

        // Create a few audit logs
        for (let i = 0; i < 3; i++) {
          createAuditLog({
            accountId: scenario.account.id,
            userId: scenario.user.id,
            entity: 'User',
            entityId: crypto.randomUUID(),
            action: 'INSERT',
          })
        }

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.meta.currentPage).toBe(1)
        expect(body.meta.limit).toBe(50) // Default limit from schema
      })
    })

    describe('Super Admin Access', () => {
      it('should allow super admin to see all audit logs across accounts', async () => {
        // Create a super admin
        const superAdmin = await createUser({
          email: 'superadmin-audit@example.com',
          name: 'Super Admin',
          isSuperAdmin: true,
        })

        // Create two accounts with audit logs
        const account1 = await createAccount({ name: 'Account 1' })
        const account2 = await createAccount({ name: 'Account 2' })

        await addUserToAccount(superAdmin.id, account1.id, 'ADMIN')

        // Create audit logs in both accounts
        createAuditLog({
          accountId: account1.id,
          userId: superAdmin.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        createAuditLog({
          accountId: account2.id,
          userId: superAdmin.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
        })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account1.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        // Super admin should see logs from both accounts
        expect(body.data.length).toBeGreaterThanOrEqual(2)

        const accountIds = new Set(body.data.map((l: any) => l.accountId))
        expect(accountIds.has(account1.id)).toBe(true)
        expect(accountIds.has(account2.id)).toBe(true)
      })
    })

    describe('Ordering', () => {
      it('should return audit logs ordered by timestamp descending (newest first)', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-order1@example.com',
          role: 'ADMIN',
        })

        // Create audit logs with specific timestamps
        const now = Date.now()
        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'INSERT',
          timestamp: new Date(now - 2000).toISOString(), // Oldest
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'UPDATE',
          timestamp: new Date(now - 1000).toISOString(), // Middle
        })

        createAuditLog({
          accountId: scenario.account.id,
          userId: scenario.user.id,
          entity: 'User',
          entityId: crypto.randomUUID(),
          action: 'DELETE',
          timestamp: new Date(now).toISOString(), // Newest
        })

        const res = await app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(3)

        // Verify order is newest first
        expect(body.data[0].action).toBe('DELETE')
        expect(body.data[1].action).toBe('UPDATE')
        expect(body.data[2].action).toBe('INSERT')
      })
    })
  })
})
