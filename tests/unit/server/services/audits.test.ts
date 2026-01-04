// src/server/services/__tests__/audits.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { auditsService, type AuditLogFilters } from '@server/services/audits'
import type { ServiceContext, AuditLog } from '@server/types'
import { createUserFixture, createSuperAdminFixture } from '@tests/fixtures/server'

vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
}))

import { queryOne, queryAll } from '@server/db/sql'

const db = {} as D1Database

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
    const defaultFilters: AuditLogFilters = { page: 1, limit: 10 }

    it('should return paginated audit logs with correct meta', async () => {
      const mockLogs = [
        createMockAuditLog({ id: 'log-1', entity: 'user', action: 'INSERT' }),
        createMockAuditLog({ id: 'log-2', entity: 'account', action: 'UPDATE' }),
      ]

      ;(queryOne as Mock).mockResolvedValueOnce({ count: 2 })
      ;(queryAll as Mock).mockResolvedValueOnce(mockLogs.map((log) => ({
        id: log.id,
        transactionId: log.transactionId,
        accountId: log.accountId,
        userId: log.userId,
        entity: log.entity,
        entityId: log.entityId,
        action: log.action,
        changes: JSON.stringify(log.changes),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
      })))

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data).toHaveLength(2)
      expect(result.meta.totalItems).toBe(2)
    })

    it('should include account filter for non-super-admin', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 0 })
      ;(queryAll as Mock).mockResolvedValueOnce([])

      await auditsService.findAll(db, ctx, defaultFilters)

      expect((queryOne as Mock).mock.calls[0][2]).toContain(ctx.accountId)
    })

    it('should filter by entity when provided', async () => {
      const mockLogs = [createMockAuditLog({ id: 'log-1', entity: 'user' })]

      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce(mockLogs.map((log) => ({
        id: log.id,
        transactionId: log.transactionId,
        accountId: log.accountId,
        userId: log.userId,
        entity: log.entity,
        entityId: log.entityId,
        action: log.action,
        changes: JSON.stringify(log.changes),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
      })))

      const result = await auditsService.findAll(db, superAdminCtx, { ...defaultFilters, entity: 'user' })

      expect(result.data).toHaveLength(1)
    })
  })
})
