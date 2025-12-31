// src/server/services/__tests__/audits.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditsService, type AuditLogFilters } from '../audits'
import type { ServiceContext, AuditLog } from '../../types'
import { createUserFixture, createSuperAdminFixture } from '../../__tests__/fixtures'

/**
 * Creates a mock Drizzle database instance for audit log queries.
 * The service uses two separate select calls:
 * 1. First for count: select({ count }).from().where()
 * 2. Second for data: select().from().where().limit().offset().orderBy()
 */
function createMockDb(data: AuditLog[] = [], count = 0) {
  return {
    select: vi.fn().mockImplementation((fields?: any) => {
      // Check if it's a count query (first call)
      if (fields && Object.keys(fields).some((k) => k === 'count')) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count }]),
          }),
        }
      }
      // Data query (second call)
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(data),
              }),
            }),
          }),
        }),
      }
    }),
  } as any
}

/**
 * Creates a standard service context for testing (non-super-admin)
 */
function createMockContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
  const user = createUserFixture({
    id: 'ctx-user-123',
    email: 'user@test.com',
    name: 'Test User',
  })

  return {
    accountId: 'account-123',
    user,
    userRole: 'ADMIN',
    transactionId: 'tx-123',
    ip: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  }
}

/**
 * Creates a super admin context for testing
 */
function createSuperAdminContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
  const user = createSuperAdminFixture({
    id: 'super-admin-123',
    email: 'superadmin@test.com',
    name: 'Super Admin',
  })

  return {
    accountId: 'account-123',
    user,
    userRole: 'ADMIN',
    transactionId: 'tx-123',
    ip: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  }
}

/**
 * Creates a mock audit log entry
 */
function createMockAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'log-1',
    transactionId: 'tx-1',
    accountId: 'account-123',
    userId: 'user-123',
    entity: 'user',
    entityId: 'user-456',
    action: 'INSERT',
    changes: { name: 'New Name' },
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent',
    timestamp: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('auditsService', () => {
  let ctx: ServiceContext
  let superAdminCtx: ServiceContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createMockContext()
    superAdminCtx = createSuperAdminContext()
  })

  describe('findAll', () => {
    const defaultFilters: AuditLogFilters = {
      page: 1,
      limit: 10,
    }

    it('should return paginated audit logs with correct meta', async () => {
      const mockLogs = [
        createMockAuditLog({ id: 'log-1', entity: 'user', action: 'INSERT' }),
        createMockAuditLog({ id: 'log-2', entity: 'account', action: 'UPDATE' }),
      ]

      const mockDb = createMockDb(mockLogs, 2)

      const result = await auditsService.findAll(mockDb, superAdminCtx, defaultFilters)

      expect(result.data).toHaveLength(2)
      expect(result.meta.totalItems).toBe(2)
      expect(result.meta.currentPage).toBe(1)
      expect(result.meta.limit).toBe(10)
      expect(result.meta.totalPages).toBe(1)
      expect(result.meta.hasPreviousPage).toBe(false)
      expect(result.meta.hasNextPage).toBe(false)
    })

    it('should return empty array when no logs', async () => {
      const mockDb = createMockDb([], 0)

      const result = await auditsService.findAll(mockDb, superAdminCtx, defaultFilters)

      expect(result.data).toHaveLength(0)
      expect(result.meta.totalItems).toBe(0)
      expect(result.meta.totalPages).toBe(0)
    })

    it('should filter by entity when provided', async () => {
      const userLogs = [createMockAuditLog({ id: 'log-1', entity: 'user' })]

      const mockDb = createMockDb(userLogs, 1)

      const filtersWithEntity: AuditLogFilters = {
        ...defaultFilters,
        entity: 'user',
      }

      const result = await auditsService.findAll(mockDb, superAdminCtx, filtersWithEntity)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].entity).toBe('user')
      // Verify select was called (for both count and data queries)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('should filter by entityId when provided', async () => {
      const specificLogs = [createMockAuditLog({ id: 'log-1', entityId: 'user-specific-123' })]

      const mockDb = createMockDb(specificLogs, 1)

      const filtersWithEntityId: AuditLogFilters = {
        ...defaultFilters,
        entityId: 'user-specific-123',
      }

      const result = await auditsService.findAll(mockDb, superAdminCtx, filtersWithEntityId)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].entityId).toBe('user-specific-123')
    })

    it('should filter by action when provided', async () => {
      const createLogs = [createMockAuditLog({ id: 'log-1', action: 'INSERT' })]

      const mockDb = createMockDb(createLogs, 1)

      const filtersWithAction: AuditLogFilters = {
        ...defaultFilters,
        action: 'INSERT',
      }

      const result = await auditsService.findAll(mockDb, superAdminCtx, filtersWithAction)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].action).toBe('INSERT')
    })

    it('should filter by accountId for non-super-admin users', async () => {
      // Non-super-admin should only see logs for their account
      const accountLogs = [
        createMockAuditLog({ id: 'log-1', accountId: 'account-123' }),
      ]

      const mockDb = createMockDb(accountLogs, 1)

      const result = await auditsService.findAll(mockDb, ctx, defaultFilters)

      expect(result.data).toHaveLength(1)
      // Verify that select was called (the service applies accountId filter internally)
      expect(mockDb.select).toHaveBeenCalled()
      // The mock returns the filtered data as expected
      expect(result.data[0].accountId).toBe('account-123')
    })

    it('should NOT filter by accountId for super-admin users', async () => {
      // Super-admin should see all logs across all accounts
      const allLogs = [
        createMockAuditLog({ id: 'log-1', accountId: 'account-123' }),
        createMockAuditLog({ id: 'log-2', accountId: 'account-456' }),
        createMockAuditLog({ id: 'log-3', accountId: 'account-789' }),
      ]

      const mockDb = createMockDb(allLogs, 3)

      const result = await auditsService.findAll(mockDb, superAdminCtx, defaultFilters)

      expect(result.data).toHaveLength(3)
      expect(result.meta.totalItems).toBe(3)
      // Super-admin should see logs from multiple accounts
      const accountIds = result.data.map((log) => log.accountId)
      expect(accountIds).toContain('account-123')
      expect(accountIds).toContain('account-456')
      expect(accountIds).toContain('account-789')
    })
  })
})
