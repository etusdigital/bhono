// src/server/services/__tests__/users.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { usersService } from '@server/services/users'
import { NotFoundError } from '@server/lib/errors'
import type { ServiceContext, PaginationQuery } from '@server/types'
import { createUserFixture, createSuperAdminFixture } from '@tests/fixtures/server'

vi.mock('@server/lib/audited-db', () => ({
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}))

vi.mock('@server/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}))

import { auditedUpdate, auditedDelete } from '@server/lib/audited-db'
import { logAudit } from '@server/lib/audit'
import { queryOne, queryAll, execute } from '@server/db/sql'

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

describe('usersService', () => {
  let ctx: ServiceContext
  let superAdminCtx: ServiceContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createMockContext()
    superAdminCtx = createSuperAdminContext()
  })

  describe('findAll', () => {
    const defaultPagination: PaginationQuery = { page: 1, limit: 10 }

    it('should return paginated users for super admin', async () => {
      const user = createUserFixture({ id: 'user-1', email: 'user@example.com' })

      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: user.id,
          google_id: user.googleId,
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
          status: user.status,
          provider_ids: JSON.stringify(user.providerIds),
          is_super_admin: user.isSuperAdmin ? 1 : 0,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          deleted_at: user.deletedAt,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data).toHaveLength(1)
      expect(result.meta.totalItems).toBe(1)
    })
  })

  describe('findById', () => {
    it('should throw NotFound when user missing', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(usersService.findById(db, superAdminCtx, 'missing')).rejects.toThrow(NotFoundError)
    })

    it('should enforce membership for non-super-admin', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          id: user.id,
          google_id: user.googleId,
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
          status: user.status,
          provider_ids: JSON.stringify(user.providerIds),
          is_super_admin: user.isSuperAdmin ? 1 : 0,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          deleted_at: user.deletedAt,
        })
        .mockResolvedValueOnce(null)

      await expect(usersService.findById(db, ctx, user.id)).rejects.toThrow(NotFoundError)
    })
  })

  describe('update', () => {
    it('should update user and return record', async () => {
      const user = createUserFixture({ id: 'user-1', name: 'Old Name' })

      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        google_id: user.googleId,
        email: user.email,
        name: user.name,
        avatar_url: user.avatarUrl,
        status: user.status,
        provider_ids: JSON.stringify(user.providerIds),
        is_super_admin: user.isSuperAdmin ? 1 : 0,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        deleted_at: user.deletedAt,
      })

      const updated = { ...user, name: 'Updated Name' }
      ;(auditedUpdate as Mock).mockResolvedValueOnce([
        {
          id: updated.id,
          google_id: updated.googleId,
          email: updated.email,
          name: updated.name,
          avatar_url: updated.avatarUrl,
          status: updated.status,
          provider_ids: JSON.stringify(updated.providerIds),
          is_super_admin: updated.isSuperAdmin ? 1 : 0,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt,
          deleted_at: updated.deletedAt,
        },
      ])

      const result = await usersService.update(db, superAdminCtx, user.id, { name: 'Updated Name' })

      expect(result.name).toBe('Updated Name')
    })
  })

  describe('delete', () => {
    it('should delete user with audit', async () => {
      const user = createUserFixture({ id: 'user-1' })
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        google_id: user.googleId,
        email: user.email,
        name: user.name,
        avatar_url: user.avatarUrl,
        status: user.status,
        provider_ids: JSON.stringify(user.providerIds),
        is_super_admin: user.isSuperAdmin ? 1 : 0,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        deleted_at: user.deletedAt,
      })

      await usersService.delete(db, superAdminCtx, user.id)

      expect(auditedDelete).toHaveBeenCalled()
    })
  })

  describe('restore', () => {
    it('should restore soft-deleted user', async () => {
      const user = createUserFixture({ id: 'user-1', deletedAt: new Date().toISOString() })
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        google_id: user.googleId,
        email: user.email,
        name: user.name,
        avatar_url: user.avatarUrl,
        status: user.status,
        provider_ids: JSON.stringify(user.providerIds),
        is_super_admin: user.isSuperAdmin ? 1 : 0,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        deleted_at: user.deletedAt,
      })

      const restored = { ...user, deletedAt: null }
      ;(auditedUpdate as Mock).mockResolvedValueOnce([
        {
          id: restored.id,
          google_id: restored.googleId,
          email: restored.email,
          name: restored.name,
          avatar_url: restored.avatarUrl,
          status: restored.status,
          provider_ids: JSON.stringify(restored.providerIds),
          is_super_admin: restored.isSuperAdmin ? 1 : 0,
          created_at: restored.createdAt,
          updated_at: restored.updatedAt,
          deleted_at: restored.deletedAt,
        },
      ])

      const result = await usersService.restore(db, superAdminCtx, user.id)

      expect(result.deletedAt).toBeNull()
    })
  })

  describe('listUserRoles', () => {
    it('should list roles for user', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          id: user.id,
          google_id: user.googleId,
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
          status: user.status,
          provider_ids: JSON.stringify(user.providerIds),
          is_super_admin: user.isSuperAdmin ? 1 : 0,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          deleted_at: user.deletedAt,
        })
        .mockResolvedValueOnce({ ok: 1 })

      ;(queryAll as Mock).mockResolvedValueOnce([
        { accountId: 'account-1', role: 'ADMIN' },
        { accountId: 'account-2', role: 'VIEWER' },
      ])

      const result = await usersService.listUserRoles(db, ctx, user.id)

      expect(result).toHaveLength(2)
    })
  })

  describe('updateRole', () => {
    it('should update role and log audit', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          id: user.id,
          google_id: user.googleId,
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
          status: user.status,
          provider_ids: JSON.stringify(user.providerIds),
          is_super_admin: user.isSuperAdmin ? 1 : 0,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          deleted_at: user.deletedAt,
        })
        .mockResolvedValueOnce({ role: 'VIEWER' })

      await usersService.updateRole(db, superAdminCtx, user.id, 'account-1', 'ADMIN')

      expect(execute).toHaveBeenCalled()
      expect(logAudit).toHaveBeenCalled()
    })
  })

  describe('removeFromAccount', () => {
    it('should remove membership and log audit', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        google_id: user.googleId,
        email: user.email,
        name: user.name,
        avatar_url: user.avatarUrl,
        status: user.status,
        provider_ids: JSON.stringify(user.providerIds),
        is_super_admin: user.isSuperAdmin ? 1 : 0,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        deleted_at: user.deletedAt,
      })

      await usersService.removeFromAccount(db, superAdminCtx, user.id, 'account-1')

      expect(execute).toHaveBeenCalled()
      expect(logAudit).toHaveBeenCalled()
    })
  })

  describe('createUserAccounts', () => {
    it('should upsert memberships and return count', async () => {
      const items = [
        { userId: 'user-1', accountId: 'account-1', role: 'ADMIN' as const },
        { userId: 'user-2', accountId: 'account-1', role: 'VIEWER' as const },
      ]

      ;(queryOne as Mock).mockResolvedValue(null)

      const result = await usersService.createUserAccounts(db, superAdminCtx, items)

      expect(result.count).toBe(2)
      expect(logAudit).toHaveBeenCalled()
    })
  })

  describe('deleteUserAccounts', () => {
    it('should delete memberships and return count', async () => {
      const items = [
        { userId: 'user-1', accountId: 'account-1', role: 'ADMIN' as const },
        { userId: 'user-2', accountId: 'account-1', role: 'VIEWER' as const },
      ]

      const result = await usersService.deleteUserAccounts(db, superAdminCtx, items)

      expect(result.count).toBe(2)
      expect(logAudit).toHaveBeenCalled()
    })
  })
})
