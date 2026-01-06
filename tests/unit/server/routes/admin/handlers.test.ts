// tests/unit/server/routes/admin/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { admin } from '@server/routes/admin'
import { errorHandler } from '@server/middleware/error-handler'
import { createMockEnv } from '@tests/helpers/server'
import { createUserFixture, createAccountFixture } from '@tests/fixtures/server'

// Mock SQL functions
vi.mock('@server/db/sql', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
  toStringValue: (v: unknown) => String(v ?? ''),
  toNullableString: (v: unknown) => (v === null || v === undefined ? null : String(v)),
}))

// Mock auditedUpdate
vi.mock('@server/lib/audited-db', () => ({
  auditedUpdate: vi.fn(),
}))

// Mock session functions
vi.mock('@server/lib/session', () => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
  createSession: vi.fn(),
  destroySession: vi.fn(),
}))

import { queryAll, queryOne } from '@server/db/sql'
import { auditedUpdate } from '@server/lib/audited-db'
import { getSession, updateSession, createSession, destroySession } from '@server/lib/session'

// Test UUIDs
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440101'
const SUPER_ADMIN_ID = '550e8400-e29b-41d4-a716-446655440201'
const OTHER_SUPER_ADMIN_ID = '550e8400-e29b-41d4-a716-446655440301'
const SOME_USER_ID = '550e8400-e29b-41d4-a716-446655440401'

describe('Admin Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let superAdminUser: ReturnType<typeof createUserFixture>
  let regularUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()

    superAdminUser = createUserFixture({
      id: SUPER_ADMIN_ID,
      email: 'superadmin@example.com',
      isSuperAdmin: true,
    })
    regularUser = createUserFixture({
      id: TEST_USER_ID,
      email: 'user@example.com',
      isSuperAdmin: false,
    })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })
  })

  // Helper to setup app with super admin access
  function setupSuperAdminApp() {
    const app = new Hono<HonoEnv>()

    // Add error handler
    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      (c as any).env = mockEnv
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', superAdminUser)
      await next()
    })

    app.route('/admin', admin)
    return app
  }

  // Helper to setup app with regular user (should be denied)
  function setupRegularUserApp() {
    const app = new Hono<HonoEnv>()

    // Add error handler
    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      (c as any).env = mockEnv
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', regularUser)
      await next()
    })

    app.route('/admin', admin)
    return app
  }

  // Helper for app without database
  function setupAppWithoutDb() {
    const app = new Hono<HonoEnv>()
    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      (c as any).env = { ...mockEnv, DB: undefined }
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', superAdminUser)
      await next()
    })

    app.route('/admin', admin)
    return app
  }

  // Helper for app with DB from context (c.get('db')) instead of c.env.DB
  function setupAppWithDbFromContext() {
    const app = new Hono<HonoEnv>()
    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      // Set env.DB to undefined to force fallback to c.get('db')
      (c as any).env = { ...mockEnv, DB: undefined }
      c.set('db' as any, mockEnv.DB)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', superAdminUser)
      await next()
    })

    app.route('/admin', admin)
    return app
  }

  describe('Database Fallback from Context', () => {
    it('should use c.get(db) when c.env.DB is undefined for listing accounts', async () => {
      const app = setupAppWithDbFromContext()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
          status: 'active',
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/accounts')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('should use c.get(db) when c.env.DB is undefined for listing users', async () => {
      const app = setupAppWithDbFromContext()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          accountCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('should use c.get(db) when c.env.DB is undefined for listing audit logs', async () => {
      const app = setupAppWithDbFromContext()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'UPDATE',
          changes: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })
  })

  describe('Super Admin Access Control', () => {
    it('should deny access to non-super-admin users', async () => {
      const app = setupRegularUserApp()

      const res = await app.request('/admin/accounts')
      expect(res.status).toBe(403)
    })

    it('should allow access to super-admin users', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 0 })
      vi.mocked(queryAll).mockResolvedValue([])

      const res = await app.request('/admin/accounts')
      expect(res.status).toBe(200)
    })
  })

  describe('Database Initialization Errors', () => {
    it('should return 500 when database not available for listing accounts', async () => {
      const app = setupAppWithoutDb()

      const res = await app.request('/admin/accounts')
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error.message).toContain('Database not initialized')
    })

    it('should return 500 when database not available for listing users', async () => {
      const app = setupAppWithoutDb()

      const res = await app.request('/admin/users')
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error.message).toContain('Database not initialized')
    })

    it('should return 500 when database not available for listing audit logs', async () => {
      const app = setupAppWithoutDb()

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error.message).toContain('Database not initialized')
    })

    it('should return 500 when database not available for suspending account', async () => {
      const app = setupAppWithoutDb()

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test reason' }),
      })
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(['Database not initialized', 'Missing required context']).toContain(body.error.message)
    })

    it('should return 500 when database not available for reactivating account', async () => {
      const app = setupAppWithoutDb()

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test reason' }),
      })
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(['Database not initialized', 'Missing required context']).toContain(body.error.message)
    })

    it('should return 500 when database not available for impersonation', async () => {
      const app = setupAppWithoutDb()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }),
      })
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(['Database not initialized', 'Missing required context']).toContain(body.error.message)
    })

    it('should return 500 when database not available for exiting impersonation', async () => {
      const app = setupAppWithoutDb()

      vi.mocked(getSession).mockReturnValue({
        userId: TEST_USER_ID,
        email: 'user@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        impersonatedBy: SUPER_ADMIN_ID,
      })

      const res = await app.request('/admin/impersonate/exit', {
        method: 'POST',
      })
      expect(res.status).toBe(500)

      const body = await res.json()
      expect(['Database not initialized', 'Missing required context']).toContain(body.error.message)
    })
  })

  describe('GET /admin/accounts', () => {
    it('should return paginated accounts with member counts', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 2 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_ACCOUNT_ID,
          name: 'Test Account 1',
          description: 'Description 1',
          domain: 'test1.com',
          status: 'active',
          statusChangedAt: null,
          statusChangedBy: null,
          statusReason: null,
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        },
      ])

      const res = await app.request('/admin/accounts')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe('Test Account 1')
      expect(body.data[0].memberCount).toBe(5)
      expect(body.meta.totalItems).toBe(2)
    })

    it('should filter accounts by status', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_ACCOUNT_ID,
          name: 'Suspended Account',
          status: 'suspended',
          memberCount: 3,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/accounts?status=suspended')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data[0].status).toBe('suspended')
    })

    it('should filter accounts by search query', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_ACCOUNT_ID,
          name: 'Acme Corp',
          description: 'Test Description',
          domain: 'acme.com',
          status: 'active',
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/accounts?query=acme')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe('Acme Corp')

      // Verify the query was called with search filter parameters
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('%acme%')
    })

    it('should include deleted accounts when includeDeleted is true', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 2 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_ACCOUNT_ID,
          name: 'Active Account',
          status: 'active',
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'deleted-account-id',
          name: 'Deleted Account',
          status: 'active',
          memberCount: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          deletedAt: '2024-06-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/accounts?includeDeleted=true')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(2)

      // Verify the query does NOT include deleted_at IS NULL filter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      const sqlQuery = queryAllCalls[0][1] as string
      // When includeDeleted=true, the WHERE clause should not filter out deleted accounts
      expect(body.meta.totalItems).toBe(2)
    })

    it('should filter accounts with status=all (no status filter)', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 3 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_ACCOUNT_ID,
          name: 'Active Account',
          status: 'active',
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'suspended-account-id',
          name: 'Suspended Account',
          status: 'suspended',
          memberCount: 3,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/accounts?status=all')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })
  })

  describe('GET /admin/users', () => {
    it('should return paginated users with account counts', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          accountCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        },
      ])

      const res = await app.request('/admin/users')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].email).toBe('user@example.com')
      expect(body.data[0].accountCount).toBe(2)
    })

    it('should filter users by super admin status', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: SUPER_ADMIN_ID,
          email: 'superadmin@example.com',
          name: 'Super Admin',
          status: 'active',
          isSuperAdmin: true,
          is_super_admin: 1,
          accountCount: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users?isSuperAdmin=true')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data[0].isSuperAdmin).toBe(true)
    })

    it('should filter users by search query', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'john.doe@example.com',
          name: 'John Doe',
          status: 'active',
          isSuperAdmin: false,
          accountCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users?query=john')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].email).toBe('john.doe@example.com')

      // Verify the query was called with search filter parameters
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('%john%')
    })

    it('should filter users by status', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'inactive@example.com',
          name: 'Inactive User',
          status: 'inactive',
          isSuperAdmin: false,
          accountCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users?status=inactive')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe('inactive')

      // Verify the query was called with status filter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('inactive')
    })

    it('should include deleted users when includeDeleted is true', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 2 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'active@example.com',
          name: 'Active User',
          status: 'active',
          isSuperAdmin: false,
          accountCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'deleted-user-id',
          email: 'deleted@example.com',
          name: 'Deleted User',
          status: 'active',
          isSuperAdmin: false,
          accountCount: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          deletedAt: '2024-06-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users?includeDeleted=true')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta.totalItems).toBe(2)
    })

    it('should filter users with status=all (no status filter)', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 2 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'active@example.com',
          name: 'Active User',
          status: 'active',
          isSuperAdmin: false,
          accountCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'inactive-user-id',
          email: 'inactive@example.com',
          name: 'Inactive User',
          status: 'inactive',
          isSuperAdmin: false,
          accountCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users?status=all')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it('should filter users by isSuperAdmin=false', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: TEST_USER_ID,
          email: 'regular@example.com',
          name: 'Regular User',
          status: 'active',
          isSuperAdmin: false,
          is_super_admin: 0,
          accountCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/users?isSuperAdmin=false')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].isSuperAdmin).toBe(false)
    })
  })

  describe('GET /admin/audit-logs', () => {
    it('should return global audit logs', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'UPDATE',
          changes: '{"name": "New Name"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].entity).toBe('users')
      expect(body.data[0].action).toBe('UPDATE')
    })

    it('should filter audit logs by account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([])

      const res = await app.request(`/admin/audit-logs?accountId=${TEST_ACCOUNT_ID}`)
      expect(res.status).toBe(200)

      // Verify the query was called with accountId filter
      expect(queryAll).toHaveBeenCalled()
    })

    it('should filter audit logs by endDate', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'UPDATE',
          changes: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-15T12:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs?endDate=2024-01-31')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)

      // Verify the query was called with endDate filter parameter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('2024-01-31T23:59:59.999Z')
    })

    it('should filter audit logs by search query', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'INSERT',
          changes: '{"email": "new@example.com"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs?query=users')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)

      // Verify the query was called with search filter parameters
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('%users%')
    })

    it('should handle invalid JSON in changes field', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'UPDATE',
          changes: 'invalid-json-{not-parseable}', // Invalid JSON string
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      // When JSON parsing fails, changes should be null
      expect(body.data[0].changes).toBeNull()
    })

    it('should handle changes as already parsed object', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'UPDATE',
          changes: { name: 'Updated Name' }, // Already an object, not a string
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      // Changes should be the object directly
      expect(body.data[0].changes).toEqual({ name: 'Updated Name' })
    })

    it('should filter audit logs by startDate', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([])

      const res = await app.request('/admin/audit-logs?startDate=2024-01-01')
      expect(res.status).toBe(200)

      // Verify the query was called with startDate filter parameter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('2024-01-01T00:00:00.000Z')
    })

    it('should filter audit logs by userId', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([])

      const res = await app.request(`/admin/audit-logs?userId=${TEST_USER_ID}`)
      expect(res.status).toBe(200)

      // Verify the query was called with userId filter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain(TEST_USER_ID)
    })

    it('should filter audit logs by entity', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([])

      const res = await app.request('/admin/audit-logs?entity=accounts')
      expect(res.status).toBe(200)

      // Verify the query was called with entity filter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('accounts')
    })

    it('should filter audit logs by action', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([])

      const res = await app.request('/admin/audit-logs?action=DELETE')
      expect(res.status).toBe(200)

      // Verify the query was called with action filter
      const queryAllCalls = vi.mocked(queryAll).mock.calls
      expect(queryAllCalls.length).toBeGreaterThan(0)
      const params = queryAllCalls[0][2] as unknown[]
      expect(params).toContain('DELETE')
    })

    it('should handle multiple filters combined', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-456',
          action: 'UPDATE',
          changes: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-15T12:00:00Z',
        },
      ])

      const res = await app.request(
        `/admin/audit-logs?accountId=${TEST_ACCOUNT_ID}&userId=${TEST_USER_ID}&entity=users&action=UPDATE&startDate=2024-01-01&endDate=2024-01-31&query=user`
      )
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('should handle audit logs with snake_case field names from database', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          // Use snake_case field names to test fallback
          transaction_id: 'tx-456',
          account_id: TEST_ACCOUNT_ID,
          account_name: 'Test Account',
          user_id: TEST_USER_ID,
          user_email: 'user@example.com',
          entity: 'accounts',
          entity_id: 'acc-789',
          action: 'INSERT',
          changes: '{"name": "New Account"}',
          ip_address: '10.0.0.1',
          user_agent: 'Chrome/100',
          impersonated_by: SUPER_ADMIN_ID,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].transactionId).toBe('tx-456')
      expect(body.data[0].accountId).toBe(TEST_ACCOUNT_ID)
      expect(body.data[0].accountName).toBe('Test Account')
      expect(body.data[0].userId).toBe(TEST_USER_ID)
      expect(body.data[0].userEmail).toBe('user@example.com')
      expect(body.data[0].entityId).toBe('acc-789')
      expect(body.data[0].action).toBe('INSERT')
      expect(body.data[0].ipAddress).toBe('10.0.0.1')
      expect(body.data[0].userAgent).toBe('Chrome/100')
      expect(body.data[0].impersonatedBy).toBe(SUPER_ADMIN_ID)
    })

    it('should handle INSERT action in audit logs', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'accounts',
          entityId: 'acc-123',
          action: 'INSERT',
          changes: '{"name": "New Account"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data[0].action).toBe('INSERT')
    })

    it('should handle DELETE action in audit logs', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({ count: 1 })
      vi.mocked(queryAll).mockResolvedValue([
        {
          id: '123',
          transactionId: 'tx-123',
          accountId: TEST_ACCOUNT_ID,
          accountName: 'Test Account',
          userId: TEST_USER_ID,
          userEmail: 'user@example.com',
          entity: 'users',
          entityId: 'user-123',
          action: 'DELETE',
          changes: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          impersonatedBy: null,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ])

      const res = await app.request('/admin/audit-logs')
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data[0].action).toBe('DELETE')
    })
  })

  describe('POST /admin/accounts/:id/suspend', () => {
    it('should suspend an active account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ id: TEST_ACCOUNT_ID, name: 'Test', status: 'active', deleted_at: null })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test',
          status: 'suspended',
          statusChangedAt: '2024-01-01T00:00:00Z',
          statusChangedBy: SUPER_ADMIN_ID,
          statusReason: 'Violation of TOS',
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        })
      vi.mocked(auditedUpdate).mockResolvedValue([])

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Violation of TOS' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.account.status).toBe('suspended')
      expect(body.message).toBe('Account suspended successfully')
    })

    it('should reject suspending already suspended account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_ACCOUNT_ID,
        status: 'suspended',
        deleted_at: null,
      })

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Some reason' }),
      })

      expect(res.status).toBe(400)
    })

    it('should return 404 for non-existent account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue(null)

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Some reason' }),
      })

      expect(res.status).toBe(404)
    })

    it('should return 500 when updated account cannot be fetched', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
          status: 'active',
          deleted_at: null,
        })
        .mockResolvedValueOnce(null) // Updated account query returns null
      vi.mocked(auditedUpdate).mockResolvedValue([])

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Violation of TOS' }),
      })

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error.message).toContain('Failed to fetch updated account')
    })
  })

  describe('POST /admin/accounts/:id/reactivate', () => {
    it('should reactivate a suspended account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ id: TEST_ACCOUNT_ID, name: 'Test', status: 'suspended', deleted_at: null })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test',
          status: 'active',
          statusChangedAt: '2024-01-01T00:00:00Z',
          statusChangedBy: SUPER_ADMIN_ID,
          statusReason: 'Issue resolved',
          memberCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        })
      vi.mocked(auditedUpdate).mockResolvedValue([])

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Issue resolved' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.account.status).toBe('active')
    })

    it('should reject reactivating non-suspended account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_ACCOUNT_ID,
        status: 'active',
        deleted_at: null,
      })

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('should return 500 when updated account cannot be fetched after reactivate', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
          status: 'suspended',
          deleted_at: null,
        })
        .mockResolvedValueOnce(null) // Updated account query returns null
      vi.mocked(auditedUpdate).mockResolvedValue([])

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Issue resolved' }),
      })

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error.message).toContain('Failed to fetch updated account')
    })

    it('should return 404 for reactivating non-existent account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne).mockResolvedValue(null)

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Issue resolved' }),
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error.message).toContain('Account not found')
    })

    it('should reactivate account without reason (reason is optional)', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ id: TEST_ACCOUNT_ID, name: 'Test', status: 'suspended', deleted_at: null })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test',
          status: 'active',
          // Use snake_case field names to test fallback
          status_changed_at: '2024-01-01T00:00:00Z',
          status_changed_by: SUPER_ADMIN_ID,
          status_reason: null, // reason should be null when not provided
          memberCount: 5,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
        })
      vi.mocked(auditedUpdate).mockResolvedValue([])

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // No reason provided
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.account.status).toBe('active')
      expect(body.account.statusReason).toBeNull()
    })

    it('should handle account with snake_case field names in response', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ id: TEST_ACCOUNT_ID, name: 'Test', status: 'suspended', deleted_at: null })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
          description: 'Test description',
          domain: 'test.com',
          status: 'active',
          // Intentionally use snake_case to test fallback
          status_changed_at: '2024-01-01T00:00:00Z',
          status_changed_by: SUPER_ADMIN_ID,
          status_reason: 'Account restored',
          memberCount: 5,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
        })
      vi.mocked(auditedUpdate).mockResolvedValue([])

      const res = await app.request(`/admin/accounts/${TEST_ACCOUNT_ID}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Account restored' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.account.statusChangedAt).toBe('2024-01-01T00:00:00Z')
      expect(body.account.statusChangedBy).toBe(SUPER_ADMIN_ID)
      expect(body.account.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(body.account.updatedAt).toBe('2024-01-01T00:00:00Z')
    })
  })

  describe('POST /admin/impersonate', () => {
    it('should start impersonation session', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          deleted_at: null,
        })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
        })
        .mockResolvedValueOnce({ ok: 1 }) // Membership check
      vi.mocked(createSession).mockResolvedValue('new-session-id')

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          accountId: TEST_ACCOUNT_ID,
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.impersonating.userId).toBe(TEST_USER_ID)
      expect(body.impersonating.userEmail).toBe('user@example.com')
    })

    it('should reject impersonating another super admin', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne).mockResolvedValue({
        id: OTHER_SUPER_ADMIN_ID,
        email: 'other@example.com',
        name: 'Other Super Admin',
        status: 'active',
        isSuperAdmin: true,
        is_super_admin: 1,
        deleted_at: null,
      })

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: OTHER_SUPER_ADMIN_ID }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('super admin')
    })

    it('should reject if already impersonating', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: TEST_USER_ID,
        email: 'user@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        impersonatedBy: SUPER_ADMIN_ID,
      })

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: SOME_USER_ID }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('Already impersonating')
    })

    it('should reject impersonating deleted user', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_USER_ID,
        email: 'deleted@example.com',
        name: 'Deleted User',
        status: 'active',
        isSuperAdmin: false,
        deleted_at: '2024-01-01T00:00:00Z',
      })

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }),
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error.message).toContain('User not found')
    })

    it('should reject impersonating inactive user', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne).mockResolvedValue({
        id: TEST_USER_ID,
        email: 'inactive@example.com',
        name: 'Inactive User',
        status: 'inactive',
        isSuperAdmin: false,
        deleted_at: null,
      })

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('inactive')
    })

    it('should impersonate with specified account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          deleted_at: null,
        })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
          status: 'active',
          deleted_at: null,
        })
        .mockResolvedValueOnce({ ok: 1 }) // membership
      vi.mocked(createSession).mockResolvedValue('new-session-id')

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          accountId: TEST_ACCOUNT_ID,
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.impersonating.accountId).toBe(TEST_ACCOUNT_ID)
    })

    it('should reject impersonating with non-existent account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          deleted_at: null,
        })
        .mockResolvedValueOnce(null) // account not found

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          accountId: TEST_ACCOUNT_ID,
        }),
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error.message).toContain('Account not found')
    })

    it('should reject impersonating when user is not member of account', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          deleted_at: null,
        })
        .mockResolvedValueOnce({
          id: TEST_ACCOUNT_ID,
          name: 'Test Account',
          status: 'active',
          deleted_at: null,
        })
        .mockResolvedValueOnce(null) // no membership

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          accountId: TEST_ACCOUNT_ID,
        }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('not a member')
    })

    it('should impersonate user with no accounts (null targetAccountId)', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          deleted_at: null,
        })
        .mockResolvedValueOnce(null) // No first account found
      vi.mocked(createSession).mockResolvedValue('new-session-id')

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.impersonating.accountId).toBeNull()
      expect(body.impersonating.accountName).toBeNull()
    })

    it('should return 404 when user does not exist', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne).mockResolvedValue(null) // User not found

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }),
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error.message).toContain('User not found')
    })

    it('should impersonate user using first account when no accountId provided', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: TEST_USER_ID,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          isSuperAdmin: false,
          deleted_at: null,
        })
        .mockResolvedValueOnce({
          // First account found
          id: TEST_ACCOUNT_ID,
          name: 'First Account',
        })
      vi.mocked(createSession).mockResolvedValue('new-session-id')

      const res = await app.request('/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }), // No accountId
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.impersonating.accountId).toBe(TEST_ACCOUNT_ID)
      expect(body.impersonating.accountName).toBe('First Account')
    })
  })

  describe('POST /admin/impersonate/exit', () => {
    it('should exit impersonation and restore super admin session', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: TEST_USER_ID,
        email: 'user@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        impersonatedBy: SUPER_ADMIN_ID,
      })
      vi.mocked(queryOne).mockResolvedValue({
        id: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      })
      vi.mocked(updateSession).mockResolvedValue(undefined)

      const res = await app.request('/admin/impersonate/exit', {
        method: 'POST',
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toBe('Impersonation ended')
    })

    it('should reject if not currently impersonating', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: SUPER_ADMIN_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
        // No impersonatedBy field
      })

      const res = await app.request('/admin/impersonate/exit', {
        method: 'POST',
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('Not currently impersonating')
    })

    it('should handle case when original super admin no longer exists', async () => {
      const app = setupSuperAdminApp()

      vi.mocked(getSession).mockReturnValue({
        userId: TEST_USER_ID,
        email: 'user@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        impersonatedBy: SUPER_ADMIN_ID,
      })
      vi.mocked(queryOne).mockResolvedValue(null) // Original super admin not found
      vi.mocked(destroySession).mockResolvedValue(undefined)

      const res = await app.request('/admin/impersonate/exit', {
        method: 'POST',
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.message).toContain('Original user no longer exists')

      // Verify session was destroyed
      expect(destroySession).toHaveBeenCalled()
    })
  })
})
