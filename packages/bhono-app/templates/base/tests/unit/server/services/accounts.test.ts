// src/server/services/__tests__/accounts.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { accountsService } from '@server/services/accounts'
import { NotFoundError, ForbiddenError, ConflictError } from '@server/lib/errors'
import type { ServiceContext, PaginationQuery } from '@server/types'
import {
  createUserFixture,
  createSuperAdminFixture,
  createAccountFixture,
  createDeletedAccountFixture,
} from '@tests/fixtures/server'

vi.mock('@server/lib/audited-db', () => ({
  auditedInsert: vi.fn(),
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}))

vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}))

import { auditedInsert, auditedUpdate, auditedDelete } from '@server/lib/audited-db'
import { queryOne, queryAll } from '@server/db/sql'

const db = {} as D1Database

function createMockContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
  const user = createUserFixture({
    id: 'ctx-user-123',
    email: 'context@example.com',
    name: 'Context User',
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
    email: 'superadmin@example.com',
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

describe('accountsService', () => {
  let ctx: ServiceContext
  let superAdminCtx: ServiceContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createMockContext()
    superAdminCtx = createSuperAdminContext()
  })

  describe('findAll', () => {
    const defaultPagination: PaginationQuery = { page: 1, limit: 10 }

    it('should return paginated accounts for super admin', async () => {
      const account1 = createAccountFixture({ id: 'account-1', name: 'Account One' })
      const account2 = createAccountFixture({ id: 'account-2', name: 'Account Two' })

      ;(queryOne as Mock).mockResolvedValueOnce({ count: 2 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        { ...account1, created_at: account1.createdAt, updated_at: account1.updatedAt, deleted_at: account1.deletedAt },
        { ...account2, created_at: account2.createdAt, updated_at: account2.updatedAt, deleted_at: account2.deletedAt },
      ])

      const result = await accountsService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data).toHaveLength(2)
      expect(result.meta.totalItems).toBe(2)
    })

    it('should include user filter for non-super-admin', async () => {
      const account = createAccountFixture({ id: 'account-1', name: 'User Account' })

      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        { ...account, created_at: account.createdAt, updated_at: account.updatedAt, deleted_at: account.deletedAt },
      ])

      await accountsService.findAll(db, ctx, defaultPagination)

      expect((queryOne as Mock).mock.calls[0][2]).toContain(ctx.user.id)
    })
  })

  describe('findById', () => {
    it('should return account for super admin', async () => {
      const account = createAccountFixture({ id: 'account-1' })
      ;(queryOne as Mock).mockResolvedValueOnce({
        ...account,
        created_at: account.createdAt,
        updated_at: account.updatedAt,
        deleted_at: account.deletedAt,
      })

      const result = await accountsService.findById(db, superAdminCtx, account.id)

      expect(result.id).toBe(account.id)
    })

    it('should throw NotFound when account missing', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(accountsService.findById(db, superAdminCtx, 'missing')).rejects.toThrow(NotFoundError)
    })

    it('should enforce membership for non-super-admin', async () => {
      const account = createAccountFixture({ id: 'account-1' })
      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          ...account,
          created_at: account.createdAt,
          updated_at: account.updatedAt,
          deleted_at: account.deletedAt,
        })
        .mockResolvedValueOnce(null)

      await expect(accountsService.findById(db, ctx, account.id)).rejects.toThrow(NotFoundError)
    })
  })

  describe('create', () => {
    it('should reject non-super-admin users', async () => {
      await expect(accountsService.create(db, ctx, { name: 'New' })).rejects.toThrow(ForbiddenError)
    })

    it('should reject duplicate domain', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ ok: 1 })

      await expect(
        accountsService.create(db, superAdminCtx, { name: 'Dup', domain: 'acme.com' })
      ).rejects.toThrow(ConflictError)
    })

    it('should create account and return record', async () => {
      const account = createAccountFixture({ id: 'account-1', name: 'New Account' })
      ;(auditedInsert as Mock).mockResolvedValueOnce([
        { ...account, created_at: account.createdAt, updated_at: account.updatedAt, deleted_at: account.deletedAt },
      ])

      const result = await accountsService.create(db, superAdminCtx, { name: 'New Account' })

      expect(result.name).toBe('New Account')
      expect(auditedInsert).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('should reject non-super-admin users', async () => {
      await expect(accountsService.update(db, ctx, 'account-1', { name: 'Updated' })).rejects.toThrow(ForbiddenError)
    })

    it('should reject duplicate domain', async () => {
      const account = createAccountFixture({ id: 'account-1' })
      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          ...account,
          created_at: account.createdAt,
          updated_at: account.updatedAt,
          deleted_at: account.deletedAt,
        })
        .mockResolvedValueOnce({ ok: 1 })

      await expect(
        accountsService.update(db, superAdminCtx, account.id, { domain: 'dup.com' })
      ).rejects.toThrow(ConflictError)
    })

    it('should update account and return record', async () => {
      const account = createAccountFixture({ id: 'account-1', name: 'Original' })
      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          ...account,
          created_at: account.createdAt,
          updated_at: account.updatedAt,
          deleted_at: account.deletedAt,
        })

      const updated = { ...account, name: 'Updated' }
      ;(auditedUpdate as Mock).mockResolvedValueOnce([
        { ...updated, created_at: updated.createdAt, updated_at: updated.updatedAt, deleted_at: updated.deletedAt },
      ])

      const result = await accountsService.update(db, superAdminCtx, account.id, { name: 'Updated' })

      expect(result.name).toBe('Updated')
      expect(auditedUpdate).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should reject non-super-admin users', async () => {
      await expect(accountsService.delete(db, ctx, 'account-1')).rejects.toThrow(ForbiddenError)
    })

    it('should delete account for super admin', async () => {
      const account = createAccountFixture({ id: 'account-1' })
      ;(queryOne as Mock).mockResolvedValueOnce({
        ...account,
        created_at: account.createdAt,
        updated_at: account.updatedAt,
        deleted_at: account.deletedAt,
      })

      await accountsService.delete(db, superAdminCtx, account.id)

      expect(auditedDelete).toHaveBeenCalled()
    })
  })

  describe('restore', () => {
    it('should reject non-super-admin users', async () => {
      await expect(accountsService.restore(db, ctx, 'account-1')).rejects.toThrow(ForbiddenError)
    })

    it('should restore soft-deleted account', async () => {
      const deleted = createDeletedAccountFixture({ id: 'account-1' })
      ;(queryOne as Mock).mockResolvedValueOnce({
        ...deleted,
        created_at: deleted.createdAt,
        updated_at: deleted.updatedAt,
        deleted_at: deleted.deletedAt,
      })

      const restored = createAccountFixture({ id: 'account-1' })
      ;(auditedUpdate as Mock).mockResolvedValueOnce([
        { ...restored, created_at: restored.createdAt, updated_at: restored.updatedAt, deleted_at: restored.deletedAt },
      ])

      const result = await accountsService.restore(db, superAdminCtx, deleted.id)

      expect(result.deletedAt).toBeNull()
    })
  })
})
