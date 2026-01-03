// src/server/services/__tests__/users.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { usersService } from '../users'
import { NotFoundError } from '../../lib/errors'
import type { ServiceContext, User, PaginationQuery } from '../../types'
import {
  createUserFixture,
  createSuperAdminFixture,
  createDeletedUserFixture,
  createAccountFixture,
} from '../../__tests__/fixtures'

// Mock audited-db module
vi.mock('../../lib/audited-db', () => ({
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}))

// Mock audit module
vi.mock('../../lib/audit', () => ({
  logAudit: vi.fn(),
}))

import { auditedUpdate, auditedDelete } from '../../lib/audited-db'
import { logAudit } from '../../lib/audit'

/**
 * Creates a mock Drizzle database instance with chainable methods
 */
function createMockDb() {
  const mockSelectResult: any[] = []
  const mockCountResult = [{ count: 0 }]

  const createChainable = (result: any) => {
    const chainable: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockImplementation(() => Promise.resolve(result)),
    }
    // Make where also resolve directly when called at the end
    chainable.where.mockImplementation(() => {
      const next = { ...chainable }
      next.limit = vi.fn().mockResolvedValue(result)
      return next
    })
    chainable.from.mockImplementation(() => {
      const next = { ...chainable }
      next.where.mockImplementation(() => {
        const whereNext = { ...chainable }
        whereNext.limit = vi.fn().mockResolvedValue(result)
        whereNext.offset = vi.fn().mockReturnThis()
        whereNext.orderBy = vi.fn().mockResolvedValue(result)
        return whereNext
      })
      return next
    })
    return chainable
  }

  const db = {
    select: vi.fn().mockImplementation((fields?: any) => {
      // If selecting count, return count result
      if (fields && 'count' in fields) {
        return createChainable(mockCountResult)
      }
      return createChainable(mockSelectResult)
    }),
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
      where: vi.fn().mockResolvedValue(),
    }),
    // Helper to set mock results
    _setSelectResult: (result: any[]) => {
      mockSelectResult.length = 0
      mockSelectResult.push(...result)
    },
    _setCountResult: (count: number) => {
      mockCountResult[0] = { count }
    },
    _mockSelectResult: mockSelectResult,
    _mockCountResult: mockCountResult,
  }

  return db as any
}

/**
 * Creates a standard service context for testing
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

describe('usersService', () => {
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

    it('should return paginated users for account', async () => {
      const testUsers = [
        createUserFixture({ id: 'user-1', name: 'User One' }),
        createUserFixture({ id: 'user-2', name: 'User Two' }),
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
                orderBy: vi.fn().mockResolvedValue(testUsers.map((u) => ({
                  ...u,
                  providerIds: u.providerIds,
                }))),
              }),
            }),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation((fields?: any) => {
        selectCallCount++
        // First call is count, second is data
        if (selectCallCount === 1 || (fields && 'count' in fields)) {
          return countChain
        }
        return dataChain
      })

      const result = await usersService.findAll(mockDb, ctx, defaultPagination)

      expect(result.data).toHaveLength(2)
      expect(result.meta.totalItems).toBe(2)
      expect(result.meta.currentPage).toBe(1)
      expect(result.meta.limit).toBe(10)
    })

    it('should return empty array when no users found', async () => {
      // Mock empty results
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

      const result = await usersService.findAll(mockDb, ctx, defaultPagination)

      expect(result.data).toHaveLength(0)
      expect(result.meta.totalItems).toBe(0)
    })

    it('should filter by search query', async () => {
      const searchUser = createUserFixture({ id: 'user-1', name: 'John Doe', email: 'john@example.com' })

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
                orderBy: vi.fn().mockResolvedValue([searchUser]),
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
        query: 'John',
      }

      const result = await usersService.findAll(mockDb, ctx, paginationWithQuery)

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('John Doe')
    })

    it('should allow super admin to see all users', async () => {
      const allUsers = [
        createUserFixture({ id: 'user-1', name: 'User One' }),
        createUserFixture({ id: 'user-2', name: 'User Two' }),
        createUserFixture({ id: 'user-3', name: 'User Three' }),
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
                orderBy: vi.fn().mockResolvedValue(allUsers),
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

      const result = await usersService.findAll(mockDb, superAdminCtx, defaultPagination)

      expect(result.data).toHaveLength(3)
      expect(result.meta.totalItems).toBe(3)
    })

    it('should handle pagination correctly', async () => {
      const testUsers = [createUserFixture({ id: 'user-3', name: 'User Three' })]

      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 25 }]),
        }),
      }
      const dataChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(testUsers),
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

      const pagination: PaginationQuery = { page: 3, limit: 10 }
      const result = await usersService.findAll(mockDb, ctx, pagination)

      expect(result.meta.currentPage).toBe(3)
      expect(result.meta.totalPages).toBe(3)
      expect(result.meta.hasPreviousPage).toBe(true)
      expect(result.meta.hasNextPage).toBe(false)
    })
  })

  describe('findById', () => {
    it('should return user by ID', async () => {
      const testUser = createUserFixture({ id: 'user-123', name: 'Test User' })

      // Mock finding user
      const userChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testUser]),
          }),
        }),
      }

      // Mock membership check for non-super-admin
      const membershipChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-123', accountId: 'account-123' }]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return userChain
        }
        return membershipChain
      })

      const result = await usersService.findById(mockDb, ctx, 'user-123')

      expect(result.id).toBe('user-123')
      expect(result.name).toBe('Test User')
    })

    it('should throw NotFoundError when user does not exist', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(usersService.findById(mockDb, ctx, 'nonexistent')).rejects.toThrow(
        NotFoundError
      )
    })

    it('should throw NotFoundError for soft-deleted user', async () => {
      // When user is soft-deleted, the query with isNull(deletedAt) returns empty
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(usersService.findById(mockDb, ctx, 'deleted-user')).rejects.toThrow(
        NotFoundError
      )
    })

    it('should throw NotFoundError when non-super-admin accesses user from different account', async () => {
      const testUser = createUserFixture({ id: 'user-123', name: 'Test User' })

      // Mock finding user (user exists)
      const userChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testUser]),
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
          return userChain
        }
        return emptyMembershipChain
      })

      await expect(usersService.findById(mockDb, ctx, 'user-123')).rejects.toThrow(NotFoundError)
    })

    it('should allow super admin to access any user', async () => {
      const testUser = createUserFixture({ id: 'any-user', name: 'Any User' })

      const userChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testUser]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(userChain)

      const result = await usersService.findById(mockDb, superAdminCtx, 'any-user')

      expect(result.id).toBe('any-user')
      // Super admin should not need membership check
      expect(mockDb.select).toHaveBeenCalledTimes(1)
    })
  })

  describe('update', () => {
    it('should update user fields', async () => {
      const existingUser = createUserFixture({ id: 'user-123', name: 'Old Name' })
      const updatedUser = { ...existingUser, name: 'New Name', status: 'active' as const }

      // Mock findById (first select for user, second for membership)
      const userChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      }
      const membershipChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-123', accountId: 'account-123' }]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return userChain
        }
        return membershipChain
      })

      // Mock auditedUpdate
      ;(auditedUpdate as Mock).mockResolvedValue([updatedUser])

      const result = await usersService.update(mockDb, ctx, 'user-123', { name: 'New Name' })

      expect(result.name).toBe('New Name')
      expect(auditedUpdate).toHaveBeenCalled()
    })

    it('should throw NotFoundError for non-existent user', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(
        usersService.update(mockDb, ctx, 'nonexistent', { name: 'New Name' })
      ).rejects.toThrow(NotFoundError)
    })

    it('should update user status', async () => {
      const existingUser = createUserFixture({ id: 'user-123', status: 'active' })
      const updatedUser = { ...existingUser, status: 'inactive' as const }

      const userChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      }
      const membershipChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-123', accountId: 'account-123' }]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return userChain
        }
        return membershipChain
      })

      ;(auditedUpdate as Mock).mockResolvedValue([updatedUser])

      const result = await usersService.update(mockDb, ctx, 'user-123', { status: 'inactive' })

      expect(result.status).toBe('inactive')
    })
  })

  describe('delete', () => {
    it('should soft delete user', async () => {
      const existingUser = createUserFixture({ id: 'user-123' })

      const userChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      }
      const membershipChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-123', accountId: 'account-123' }]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return userChain
        }
        return membershipChain
      })

      ;(auditedDelete as Mock).mockResolvedValue()

      await usersService.delete(mockDb, ctx, 'user-123')

      expect(auditedDelete).toHaveBeenCalled()
    })

    it('should throw NotFoundError for non-existent user', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(usersService.delete(mockDb, ctx, 'nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('restore', () => {
    it('should restore soft-deleted user', async () => {
      const deletedUser = createDeletedUserFixture({ id: 'deleted-user-123' })
      const restoredUser = { ...deletedUser, deletedAt: null }

      // Mock finding deleted user
      const deletedUserChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([deletedUser]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(deletedUserChain)

      // Mock auditedUpdate for restore (returns array)
      ;(auditedUpdate as Mock).mockResolvedValue([restoredUser])

      const result = await usersService.restore(mockDb, ctx, 'deleted-user-123')

      expect(result.id).toBe('deleted-user-123')
      expect(result.deletedAt).toBeNull()
      expect(auditedUpdate).toHaveBeenCalled()
    })

    it('should throw NotFoundError for non-deleted user', async () => {
      // When querying for deletedAt is NOT NULL, an active user won't be found
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(usersService.restore(mockDb, ctx, 'active-user')).rejects.toThrow(NotFoundError)
    })

    it('should throw NotFoundError for non-existent user', async () => {
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      await expect(usersService.restore(mockDb, ctx, 'nonexistent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('createUserAccounts', () => {
    it('should create user-account relationships', async () => {
      // Mock checking existing relationship (not found)
      const emptyChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(emptyChain)

      // Mock insert
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(),
      })

      const items = [
        { userId: 'user-1', accountId: 'account-1', role: 'VIEWER' as const },
        { userId: 'user-2', accountId: 'account-1', role: 'ADMIN' as const },
      ]

      const result = await usersService.createUserAccounts(mockDb, ctx, items)

      expect(result.success).toBe(true)
      expect(result.count).toBe(2)
    })

    it('should update existing relationship role', async () => {
      // Mock finding existing relationship
      const existingChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-1', accountId: 'account-1', role: 'VIEWER' }]),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(existingChain)

      // Mock update
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(),
        }),
      })

      const items = [{ userId: 'user-1', accountId: 'account-1', role: 'ADMIN' as const }]

      const result = await usersService.createUserAccounts(mockDb, ctx, items)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('deleteUserAccounts', () => {
    it('should delete user-account relationships', async () => {
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(),
      })

      const items = [
        { userId: 'user-1', accountId: 'account-1', role: 'VIEWER' as const },
      ]

      const result = await usersService.deleteUserAccounts(mockDb, ctx, items)

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })
})
