// src/server/services/__tests__/accounts.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { accountsService } from '../accounts'
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors'
import type { ServiceContext, Account, PaginationQuery } from '../../types'
import {
  createUserFixture,
  createSuperAdminFixture,
  createAccountFixture,
  createDeletedAccountFixture,
} from '../../__tests__/fixtures'

// Mock audited-db module
vi.mock('../../lib/audited-db', () => ({
  auditedInsert: vi.fn(),
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}))

import { auditedInsert, auditedUpdate, auditedDelete } from '../../lib/audited-db'

/**
 * Creates a mock Drizzle database instance with chainable methods
 */
function createMockDb() {
  const db = {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }

  return db as any
}

/**
 * Creates a standard service context for testing (non-super-admin)
 */
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

/**
 * Creates a super admin context for testing
 */
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
  let mockDb: ReturnType<typeof createMockDb>
  let ctx: ServiceContext
  let superAdminCtx: ServiceContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    ctx = createMockContext()
    superAdminCtx = createSuperAdminContext()
  })

  describe('findAll', () => {
    const defaultPagination: PaginationQuery = {
      page: 1,
      limit: 10,
    }

    it('should return paginated accounts', async () => {
      const testAccounts = [
        createAccountFixture({ id: 'account-1', name: 'Account One' }),
        createAccountFixture({ id: 'account-2', name: 'Account Two' }),
      ]

      // Mock count query
      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }

      // Mock data query
      const dataChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(testAccounts),
              }),
            }),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation((fields?: any) => {
        selectCallCount++
        if (selectCallCount === 1 || (fields && 'count' in fields)) {
          return countChain
        }
        return dataChain
      })

      const result = await accountsService.findAll(mockDb, superAdminCtx, defaultPagination)

      expect(result.data).toHaveLength(2)
      expect(result.meta.totalItems).toBe(2)
      expect(result.meta.currentPage).toBe(1)
    })

    it('should filter accounts for non-super-admin user', async () => {
      const userAccounts = [
        createAccountFixture({ id: 'account-1', name: 'User Account' }),
      ]

      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      }

      const dataChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(userAccounts),
              }),
            }),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation((fields?: any) => {
        selectCallCount++
        if (selectCallCount === 1 || (fields && 'count' in fields)) {
          return countChain
        }
        return dataChain
      })

      const result = await accountsService.findAll(mockDb, ctx, defaultPagination)

      // Non-super-admin should only see their associated accounts
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('User Account')
    })

    it('should allow super admin to see all accounts', async () => {
      const allAccounts = [
        createAccountFixture({ id: 'account-1', name: 'Account One' }),
        createAccountFixture({ id: 'account-2', name: 'Account Two' }),
        createAccountFixture({ id: 'account-3', name: 'Account Three' }),
      ]

      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      }

      const dataChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(allAccounts),
              }),
            }),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation((fields?: any) => {
        selectCallCount++
        if (selectCallCount === 1 || (fields && 'count' in fields)) {
          return countChain
        }
        return dataChain
      })

      const result = await accountsService.findAll(mockDb, superAdminCtx, defaultPagination)

      expect(result.data).toHaveLength(3)
      expect(result.meta.totalItems).toBe(3)
    })

    it('should return empty array when no accounts found', async () => {
      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }

      const dataChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation((fields?: any) => {
        selectCallCount++
        if (selectCallCount === 1 || (fields && 'count' in fields)) {
          return countChain
        }
        return dataChain
      })

      const result = await accountsService.findAll(mockDb, ctx, defaultPagination)

      expect(result.data).toHaveLength(0)
      expect(result.meta.totalItems).toBe(0)
    })

    it('should filter by search query', async () => {
      const searchAccount = createAccountFixture({
        id: 'account-1',
        name: 'Acme Corp',
        domain: 'acme.com'
      })

      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      }

      const dataChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([searchAccount]),
              }),
            }),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation((fields?: any) => {
        selectCallCount++
        if (selectCallCount === 1 || (fields && 'count' in fields)) {
          return countChain
        }
        return dataChain
      })

      const paginationWithQuery: PaginationQuery = {
        ...defaultPagination,
        query: 'Acme',
      }

      const result = await accountsService.findAll(mockDb, superAdminCtx, paginationWithQuery)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Acme Corp')
    })
  })

  describe('findById', () => {
    it('should return account by ID', async () => {
      const testAccount = createAccountFixture({ id: 'account-123', name: 'Test Account' })

      // Mock finding account
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testAccount]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(accountChain)

      const result = await accountsService.findById(mockDb, superAdminCtx, 'account-123')

      expect(result.id).toBe('account-123')
      expect(result.name).toBe('Test Account')
    })

    it('should throw NotFoundError when account does not exist', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(accountsService.findById(mockDb, superAdminCtx, 'nonexistent')).rejects.toThrow(
        NotFoundError
      )
    })

    it('should throw NotFoundError for soft-deleted account', async () => {
      // Soft-deleted accounts are filtered out by the isNull(deletedAt) condition
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(accountsService.findById(mockDb, superAdminCtx, 'deleted-account')).rejects.toThrow(
        NotFoundError
      )
    })

    it('should check membership for non-super-admin', async () => {
      const testAccount = createAccountFixture({ id: 'account-123', name: 'Test Account' })

      // Mock finding account
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testAccount]),
          }),
        }),
      }

      // Mock membership check
      const membershipChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: ctx.user.id, accountId: 'account-123' }]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return accountChain
        }
        return membershipChain
      })

      const result = await accountsService.findById(mockDb, ctx, 'account-123')

      expect(result.id).toBe('account-123')
      // Verify membership check was performed
      expect(mockDb.select).toHaveBeenCalledTimes(2)
    })

    it('should throw NotFoundError when non-super-admin has no access', async () => {
      const testAccount = createAccountFixture({ id: 'account-123', name: 'Test Account' })

      // Mock finding account
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testAccount]),
          }),
        }),
      }

      // Mock membership check (no membership found)
      const emptyMembershipChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return accountChain
        }
        return emptyMembershipChain
      })

      await expect(accountsService.findById(mockDb, ctx, 'account-123')).rejects.toThrow(
        NotFoundError
      )
    })
  })

  describe('create', () => {
    it('should create account for super admin', async () => {
      const newAccount = createAccountFixture({
        id: 'new-account',
        name: 'New Account',
        description: 'A new account',
      })

      // Mock domain uniqueness check
      const emptyDomainChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyDomainChain)

      // Mock auditedInsert
      ;(auditedInsert as Mock).mockResolvedValue([newAccount])

      const result = await accountsService.create(mockDb, superAdminCtx, {
        name: 'New Account',
        description: 'A new account',
      })

      expect(result.id).toBe('new-account')
      expect(result.name).toBe('New Account')
      expect(auditedInsert).toHaveBeenCalled()
    })

    it('should throw ForbiddenError for non-super-admin', async () => {
      await expect(
        accountsService.create(mockDb, ctx, {
          name: 'New Account',
        })
      ).rejects.toThrow(ForbiddenError)
    })

    it('should throw ConflictError for duplicate domain', async () => {
      // Mock domain check finding existing account
      const existingDomainChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createAccountFixture({ id: 'existing', domain: 'acme.com' }),
            ]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(existingDomainChain)

      await expect(
        accountsService.create(mockDb, superAdminCtx, {
          name: 'New Account',
          domain: 'acme.com',
        })
      ).rejects.toThrow(ConflictError)
    })

    it('should create account without domain', async () => {
      const newAccount = createAccountFixture({
        id: 'new-account',
        name: 'No Domain Account',
        domain: null,
      })

      // No domain check needed when no domain provided
      ;(auditedInsert as Mock).mockResolvedValue([newAccount])

      const result = await accountsService.create(mockDb, superAdminCtx, {
        name: 'No Domain Account',
      })

      expect(result.name).toBe('No Domain Account')
      expect(result.domain).toBeNull()
    })
  })

  describe('update', () => {
    it('should update account fields', async () => {
      const existingAccount = createAccountFixture({
        id: 'account-123',
        name: 'Old Name',
        description: 'Old description',
      })
      const updatedAccount = {
        ...existingAccount,
        name: 'New Name',
        description: 'New description',
      }

      // Mock findById
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingAccount]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(accountChain)

      // Mock auditedUpdate
      ;(auditedUpdate as Mock).mockResolvedValue([updatedAccount])

      const result = await accountsService.update(mockDb, superAdminCtx, 'account-123', {
        name: 'New Name',
        description: 'New description',
      })

      expect(result.name).toBe('New Name')
      expect(result.description).toBe('New description')
      expect(auditedUpdate).toHaveBeenCalled()
    })

    it('should throw NotFoundError for non-existent account', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(
        accountsService.update(mockDb, superAdminCtx, 'nonexistent', { name: 'New Name' })
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ConflictError when updating to duplicate domain', async () => {
      const existingAccount = createAccountFixture({
        id: 'account-123',
        name: 'Account',
        domain: 'original.com',
      })

      // Mock findById (first call)
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingAccount]),
          }),
        }),
      }

      // Mock domain conflict check (second call)
      const conflictChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createAccountFixture({ id: 'other-account', domain: 'taken.com' }),
            ]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return accountChain
        }
        return conflictChain
      })

      await expect(
        accountsService.update(mockDb, superAdminCtx, 'account-123', { domain: 'taken.com' })
      ).rejects.toThrow(ConflictError)
    })

    it('should update domain when unique', async () => {
      const existingAccount = createAccountFixture({
        id: 'account-123',
        name: 'Account',
        domain: null,
      })
      const updatedAccount = { ...existingAccount, domain: 'new-domain.com' }

      // Mock findById
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingAccount]),
          }),
        }),
      }

      // Mock domain uniqueness check (no conflict)
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return accountChain
        }
        return emptyChain
      })

      ;(auditedUpdate as Mock).mockResolvedValue([updatedAccount])

      const result = await accountsService.update(mockDb, superAdminCtx, 'account-123', {
        domain: 'new-domain.com',
      })

      expect(result.domain).toBe('new-domain.com')
    })
  })

  describe('delete', () => {
    it('should soft delete account for super admin', async () => {
      const existingAccount = createAccountFixture({ id: 'account-123' })

      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingAccount]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(accountChain)

      ;(auditedDelete as Mock).mockResolvedValue(undefined)

      await accountsService.delete(mockDb, superAdminCtx, 'account-123')

      expect(auditedDelete).toHaveBeenCalled()
    })

    it('should throw ForbiddenError for non-super-admin', async () => {
      await expect(accountsService.delete(mockDb, ctx, 'account-123')).rejects.toThrow(
        ForbiddenError
      )
    })

    it('should throw NotFoundError for non-existent account', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(accountsService.delete(mockDb, superAdminCtx, 'nonexistent')).rejects.toThrow(
        NotFoundError
      )
    })
  })

  describe('restore', () => {
    it('should restore soft-deleted account for super admin', async () => {
      const deletedAccount = createDeletedAccountFixture({ id: 'deleted-account-123' })
      const restoredAccount = { ...deletedAccount, deletedAt: null }

      // Mock finding deleted account
      const deletedAccountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([deletedAccount]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(deletedAccountChain)

      ;(auditedUpdate as Mock).mockResolvedValue(restoredAccount)

      const result = await accountsService.restore(mockDb, superAdminCtx, 'deleted-account-123')

      expect(result.id).toBe('deleted-account-123')
      expect(result.deletedAt).toBeNull()
      expect(auditedUpdate).toHaveBeenCalled()
    })

    it('should throw ForbiddenError for non-super-admin', async () => {
      await expect(accountsService.restore(mockDb, ctx, 'deleted-account')).rejects.toThrow(
        ForbiddenError
      )
    })

    it('should throw NotFoundError for non-deleted account', async () => {
      // When querying for deletedAt is NOT NULL, an active account won't be found
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(accountsService.restore(mockDb, superAdminCtx, 'active-account')).rejects.toThrow(
        NotFoundError
      )
    })

    it('should throw NotFoundError for non-existent account', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(accountsService.restore(mockDb, superAdminCtx, 'nonexistent')).rejects.toThrow(
        NotFoundError
      )
    })
  })
})
