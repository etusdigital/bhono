// src/server/services/__tests__/audits.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { auditsService, type AuditLogFilters } from '@server/services/audits'
import type { ServiceContext, AuditLog } from '@server/types'
import { createUserFixture, createSuperAdminFixture } from '@tests/fixtures/server'

vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  toStringValue: (value: unknown) => {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return ''
  },
  toNullableString: (value: unknown) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return null
  },
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
    userRole: 'admin',
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
    userRole: 'admin',
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

    it('should filter by entityId when provided', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'specific-entity-id',
        action: 'INSERT',
        changes: null,
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, { ...defaultFilters, entityId: 'specific-entity-id' })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].entityId).toBe('specific-entity-id')
    })

    it('should filter by action when provided', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'user-456',
        action: 'DELETE',
        changes: null,
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, { ...defaultFilters, action: 'DELETE' })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].action).toBe('DELETE')
    })

    it('should handle null count result', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)
      ;(queryAll as Mock).mockResolvedValueOnce([])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data).toHaveLength(0)
      expect(result.meta.totalItems).toBe(0)
    })

    it('should handle snake_case column names', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transaction_id: 'tx-snake',
        account_id: 'account-snake',
        user_id: 'user-snake',
        entity: 'user',
        entity_id: 'entity-snake',
        action: 'UPDATE',
        changes: '{"field": "value"}',
        ip_address: '192.168.1.1',
        user_agent: 'SnakeAgent',
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data[0].transactionId).toBe('tx-snake')
      expect(result.data[0].accountId).toBe('account-snake')
      expect(result.data[0].userId).toBe('user-snake')
      expect(result.data[0].entityId).toBe('entity-snake')
      expect(result.data[0].ipAddress).toBe('192.168.1.1')
      expect(result.data[0].userAgent).toBe('SnakeAgent')
    })

    it('should parse changes as JSON string', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'user-456',
        action: 'UPDATE',
        changes: '{"old": "value", "new": "changed"}',
        ipAddress: null,
        userAgent: null,
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data[0].changes).toEqual({ old: 'value', new: 'changed' })
    })

    it('should parse changes as object', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'user-456',
        action: 'UPDATE',
        changes: { already: 'object' },
        ipAddress: null,
        userAgent: null,
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data[0].changes).toEqual({ already: 'object' })
    })

    it('should handle invalid JSON in changes', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'user-456',
        action: 'UPDATE',
        changes: 'not-valid-json',
        ipAddress: null,
        userAgent: null,
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data[0].changes).toBeNull()
    })

    it('should handle null/undefined changes', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'user-456',
        action: 'DELETE',
        changes: null,
        ipAddress: null,
        userAgent: null,
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data[0].changes).toBeNull()
    })

    it('should handle null accountId and userId', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: null,
        userId: null,
        entity: 'system',
        entityId: 'sys-1',
        action: 'INSERT',
        changes: null,
        ipAddress: null,
        userAgent: null,
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      expect(result.data[0].accountId).toBeNull()
      expect(result.data[0].userId).toBeNull()
    })

    it('should handle non-object parsed JSON in changes', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([{
        id: 'log-1',
        transactionId: 'tx-1',
        accountId: 'account-123',
        userId: 'user-123',
        entity: 'user',
        entityId: 'user-456',
        action: 'UPDATE',
        changes: '"just a string"',
        ipAddress: null,
        userAgent: null,
        timestamp: '2025-01-01T00:00:00Z',
      }])

      const result = await auditsService.findAll(db, superAdminCtx, defaultFilters)

      // A JSON string that parses to a primitive should return null
      expect(result.data[0].changes).toBeNull()
    })
  })
})
