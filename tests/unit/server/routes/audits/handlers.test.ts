// src/server/routes/audits/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { audits } from '@server/routes/index'
import { errorHandler } from '@server/middleware/error-handler'
import { createMockEnv } from '@tests/helpers/server'
import { createUserFixture, createAccountFixture } from '@tests/fixtures/server'

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440101'

// Mock the audits service
vi.mock('@server/services/audits', () => ({
  auditsService: {
    findAll: vi.fn(),
  },
}))

import { auditsService } from '@server/services/audits'

describe('Audits Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let mockDb: any
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
    testUser = createUserFixture({ id: TEST_USER_ID, email: 'admin@example.com' })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })
    mockDb = {}
  })

  // Helper to create audit log fixture
  function createAuditLogFixture(overrides: Partial<{
    id: string
    transactionId: string
    accountId: string | null
    userId: string | null
    entity: string
    entityId: string
    action: string
    changes: Record<string, unknown> | null
    ipAddress: string | null
    userAgent: string | null
    timestamp: string
  }> = {}) {
    return {
      id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440200',
      transactionId: overrides.transactionId ?? 'tx-123',
      accountId: overrides.accountId ?? TEST_ACCOUNT_ID,
      userId: overrides.userId ?? TEST_USER_ID,
      entity: overrides.entity ?? 'User',
      entityId: overrides.entityId ?? TEST_USER_ID,
      action: overrides.action ?? 'UPDATE',
      changes: overrides.changes ?? { name: 'Updated Name' },
      ipAddress: overrides.ipAddress ?? '127.0.0.1',
      userAgent: overrides.userAgent ?? 'TestAgent/1.0',
      timestamp: overrides.timestamp ?? new Date().toISOString(),
    }
  }

  // Helper to setup authenticated app with ADMIN role
  function setupAuthenticatedApp(userRole = 'admin', isSuperAdmin = false) {
    const authenticatedApp = new Hono<HonoEnv>()

    authenticatedApp.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('user', { ...testUser, isSuperAdmin })
      c.set('accountId', testAccount.id)
      c.set('userRole', userRole)
      c.set('isSystemAdminAccess', isSuperAdmin)
      await next()
    })

    authenticatedApp.route('/audits', audits)
    return authenticatedApp
  }

  describe('GET /audits (listAuditLogsHandler)', () => {
    it('should return paginated audit logs', async () => {
      const auditLogsData = [
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440201', entity: 'User', action: 'INSERT' }),
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440202', entity: 'Account', action: 'UPDATE' }),
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440203', entity: 'User', action: 'DELETE' }),
      ]

      vi.mocked(auditsService.findAll).mockResolvedValue({
        data: auditLogsData,
        meta: {
          currentPage: 1,
          limit: 50,
          totalItems: 3,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('admin')

      const res = await authenticatedApp.request('/audits', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(3)
      expect(body.meta).toBeDefined()
      expect(body.meta.totalItems).toBe(3)
      expect(body.meta.currentPage).toBe(1)
    })

    it('should filter by entity', async () => {
      const userAuditLogs = [
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440201', entity: 'User', action: 'INSERT' }),
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440202', entity: 'User', action: 'UPDATE' }),
      ]

      vi.mocked(auditsService.findAll).mockResolvedValue({
        data: userAuditLogs,
        meta: {
          currentPage: 1,
          limit: 50,
          totalItems: 2,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('admin')

      const res = await authenticatedApp.request('/audits?entity=User', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(auditsService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          accountId: testAccount.id,
        }),
        expect.objectContaining({
          entity: 'User',
        })
      )

      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data.every((log: any) => log.entity === 'User')).toBe(true)
    })

    it('should filter by action', async () => {
      const updateAuditLogs = [
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440201', entity: 'User', action: 'UPDATE' }),
        createAuditLogFixture({ id: '550e8400-e29b-41d4-a716-446655440202', entity: 'Account', action: 'UPDATE' }),
      ]

      vi.mocked(auditsService.findAll).mockResolvedValue({
        data: updateAuditLogs,
        meta: {
          currentPage: 1,
          limit: 50,
          totalItems: 2,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('admin')

      const res = await authenticatedApp.request('/audits?action=UPDATE', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(auditsService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          accountId: testAccount.id,
        }),
        expect.objectContaining({
          action: 'UPDATE',
        })
      )

      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data.every((log: any) => log.action === 'UPDATE')).toBe(true)
    })

    it('should use default pagination', async () => {
      vi.mocked(auditsService.findAll).mockResolvedValue({
        data: [],
        meta: {
          currentPage: 1,
          limit: 50,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('admin')

      const res = await authenticatedApp.request('/audits', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(auditsService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.anything(),
        expect.objectContaining({
          page: 1,
          limit: 50,
        })
      )
    })

    it('should support custom pagination parameters', async () => {
      vi.mocked(auditsService.findAll).mockResolvedValue({
        data: [],
        meta: {
          currentPage: 2,
          limit: 10,
          totalItems: 25,
          totalPages: 3,
          hasPreviousPage: true,
          hasNextPage: true,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('admin')

      const res = await authenticatedApp.request('/audits?page=2&limit=10', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(auditsService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.anything(),
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      )

      const body = await res.json()
      expect(body.meta.currentPage).toBe(2)
      expect(body.meta.limit).toBe(10)
      expect(body.meta.hasPreviousPage).toBe(true)
      expect(body.meta.hasNextPage).toBe(true)
    })

    it('should filter by entityId', async () => {
      const specificEntityLogs = [
        createAuditLogFixture({
          id: '550e8400-e29b-41d4-a716-446655440201',
          entityId: TEST_USER_ID,
          action: 'UPDATE',
        }),
      ]

      vi.mocked(auditsService.findAll).mockResolvedValue({
        data: specificEntityLogs,
        meta: {
          currentPage: 1,
          limit: 50,
          totalItems: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('admin')

      const res = await authenticatedApp.request(`/audits?entityId=${TEST_USER_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(auditsService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          accountId: testAccount.id,
        }),
        expect.objectContaining({
          entityId: TEST_USER_ID,
        })
      )
    })

    it('should deny access for non-admin roles', async () => {
      // viewer role should not have access to audit logs
      const authenticatedApp = setupAuthenticatedApp('viewer')

      const res = await authenticatedApp.request('/audits', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(403)
    })

    describe('context validation errors', () => {
      // Helper to setup app with missing context
      function setupAppWithMissingContext(options: {
        missingDb?: boolean
        missingAccountId?: boolean
        missingUser?: boolean
        envDbUndefined?: boolean
      }) {
        const app = new Hono<HonoEnv>()

        // Add error handler for proper JSON error responses
        app.onError(errorHandler)

        app.use('*', async (c, next) => {
          ;(c as any).env = options.envDbUndefined
            ? { ...mockEnv, DB: undefined }
            : mockEnv
          if (!options.missingDb) {
            c.set('db', mockDb)
          }
          c.set('transactionId', 'test-transaction-id')
          c.set('ip', '127.0.0.1')
          c.set('userAgent', 'TestAgent/1.0')
          if (!options.missingUser) {
            c.set('user', { ...testUser, isSuperAdmin: false })
          }
          if (!options.missingAccountId) {
            c.set('accountId', testAccount.id)
          }
          c.set('userRole', 'admin')
          c.set('isSystemAdminAccess', false)
          await next()
        })

        app.route('/audits', audits)
        return app
      }

      it('should throw error when db context is missing', async () => {
        const app = setupAppWithMissingContext({ missingDb: true })

        const res = await app.request('/audits', {
          method: 'GET',
          headers: {
            'Account-ID': testAccount.id,
          },
        })

        // The error should propagate and result in a 500 status
        // Error handler converts plain Error to "Internal server error" for security
        expect(res.status).toBe(500)
        const body = await res.json()
        expect(body.error.code).toBe('INTERNAL_ERROR')
        expect(body.error.status).toBe(500)
      })

      it('should throw error when accountId context is missing', async () => {
        const app = setupAppWithMissingContext({ missingAccountId: true })

        const res = await app.request('/audits', {
          method: 'GET',
          headers: {
            'Account-ID': testAccount.id,
          },
        })

        // The error should propagate and result in a 500 status
        // Error handler converts plain Error to "Internal server error" for security
        expect(res.status).toBe(500)
        const body = await res.json()
        expect(body.error.code).toBe('INTERNAL_ERROR')
        expect(body.error.status).toBe(500)
      })

      it('should return 401 when user context is missing (guard intercepts)', async () => {
        // Note: The requireRole guard middleware intercepts missing user before
        // the handler runs, returning 401 Unauthorized
        const app = setupAppWithMissingContext({ missingUser: true })

        const res = await app.request('/audits', {
          method: 'GET',
          headers: {
            'Account-ID': testAccount.id,
          },
        })

        // The requireRole guard returns 401 before the handler runs
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.error.message).toContain('Unauthorized')
      })

      it('should use db fallback when env.DB is undefined', async () => {
        // This tests line 29: const auditsDb = envDb ?? db
        // When envDb (c.env.DB) is undefined, it should fallback to db

        vi.mocked(auditsService.findAll).mockResolvedValue({
          data: [],
          meta: {
            currentPage: 1,
            limit: 50,
            totalItems: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        })

        const app = setupAppWithMissingContext({ envDbUndefined: true })

        const res = await app.request('/audits', {
          method: 'GET',
          headers: {
            'Account-ID': testAccount.id,
          },
        })

        expect(res.status).toBe(200)
        // Verify it used the fallback db (mockDb) instead of envDb
        expect(auditsService.findAll).toHaveBeenCalledWith(
          mockDb,
          expect.anything(),
          expect.anything()
        )
      })
    })
  })
})
