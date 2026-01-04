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
          google_id: `google-${user.id}`,
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
          google_id: `google-${user.id}`,
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
        google_id: `google-${user.id}`,
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
        google_id: `google-${user.id}`,
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
        google_id: `google-${user.id}`,
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
          google_id: `google-${user.id}`,
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
          google_id: `google-${user.id}`,
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
        google_id: `google-${user.id}`,
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

  describe('findAll edge cases', () => {
    const defaultPagination: PaginationQuery = { page: 1, limit: 10 }

    it('should filter by query parameter', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'search@example.com',
          name: 'Search User',
          avatar_url: null,
          status: 'active',
          provider_ids: JSON.stringify(['google']),
          is_super_admin: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, { ...defaultPagination, query: 'search' })

      expect(result.data).toHaveLength(1)
    })

    it('should filter by account for non-super-admin', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: '[]',
          is_super_admin: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      await usersService.findAll(db, ctx, defaultPagination)

      // Check that account filter was applied
      expect((queryOne as Mock).mock.calls[0][2]).toContain(ctx.accountId)
    })

    it('should handle null count result', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)
      ;(queryAll as Mock).mockResolvedValueOnce([])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data).toHaveLength(0)
      expect(result.meta.totalItems).toBe(0)
    })

    it('should parse providerIds as array', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: ['google', 'github'],
          is_super_admin: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data[0].providerIds).toEqual(['google', 'github'])
    })

    it('should handle invalid JSON in providerIds', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: 'invalid-json',
          is_super_admin: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data[0].providerIds).toEqual([])
    })

    it('should handle non-array JSON in providerIds', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: '{"key": "value"}',
          is_super_admin: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data[0].providerIds).toEqual([])
    })

    it('should handle isSuperAdmin as boolean true', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: '[]',
          is_super_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data[0].isSuperAdmin).toBe(true)
    })

    it('should handle isSuperAdmin as string "1"', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: '[]',
          is_super_admin: '1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data[0].isSuperAdmin).toBe(true)
    })

    it('should handle isSuperAdmin as string "true"', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ count: 1 })
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'user-1',
          google_id: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatar_url: null,
          status: 'active',
          provider_ids: '[]',
          is_super_admin: 'TRUE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])

      const result = await usersService.findAll(db, superAdminCtx, defaultPagination)

      expect(result.data[0].isSuperAdmin).toBe(true)
    })
  })

  describe('update edge cases', () => {
    it('should throw when auditedUpdate returns empty array', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        google_id: `google-${user.id}`,
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

      ;(auditedUpdate as Mock).mockResolvedValueOnce([])

      await expect(usersService.update(db, superAdminCtx, user.id, { name: 'New' })).rejects.toThrow('Failed to update user')
    })
  })

  describe('restore edge cases', () => {
    it('should throw NotFoundError when user not found', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(usersService.restore(db, superAdminCtx, 'missing')).rejects.toThrow(NotFoundError)
    })

    it('should throw NotFoundError when restore fails', async () => {
      const user = createUserFixture({ id: 'user-1', deletedAt: new Date().toISOString() })

      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        google_id: `google-${user.id}`,
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

      ;(auditedUpdate as Mock).mockResolvedValueOnce([])

      await expect(usersService.restore(db, superAdminCtx, user.id)).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateRole edge cases', () => {
    it('should throw NotFoundError when membership not found', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          id: user.id,
          google_id: `google-${user.id}`,
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

      await expect(usersService.updateRole(db, superAdminCtx, user.id, 'account-1', 'ADMIN')).rejects.toThrow('User not found in account')
    })
  })

  describe('createUserAccounts edge cases', () => {
    it('should update existing membership', async () => {
      const items = [{ userId: 'user-1', accountId: 'account-1', role: 'ADMIN' as const }]

      ;(queryOne as Mock).mockResolvedValueOnce({ role: 'VIEWER' })

      const result = await usersService.createUserAccounts(db, superAdminCtx, items)

      expect(result.count).toBe(1)
      expect(execute).toHaveBeenCalled()
    })
  })

  describe('listUserRoles edge cases', () => {
    it('should handle snake_case column names', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce({
          id: user.id,
          google_id: `google-${user.id}`,
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

      ;(queryAll as Mock).mockResolvedValueOnce([{ account_id: 'account-1', role: 'ADMIN' }])

      const result = await usersService.listUserRoles(db, ctx, user.id)

      expect(result[0].accountId).toBe('account-1')
    })
  })

  describe('findById edge cases', () => {
    it('should return user for super admin without membership check', async () => {
      const user = createUserFixture({ id: 'user-1' })

      ;(queryOne as Mock).mockResolvedValueOnce({
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        status: user.status,
        providerIds: user.providerIds,
        isSuperAdmin: user.isSuperAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
      })

      const result = await usersService.findById(db, superAdminCtx, user.id)

      expect(result.id).toBe(user.id)
      // queryOne should only be called once (no membership check)
      expect(queryOne).toHaveBeenCalledTimes(1)
    })
  })
})
