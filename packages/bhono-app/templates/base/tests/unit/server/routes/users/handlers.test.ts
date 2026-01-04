// src/server/routes/users/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { users } from '@server/routes/index'
import { createMockEnv } from '@tests/helpers/server'
import {
  createUserFixture,
  createAccountFixture,
  createDeletedUserFixture,
} from '@tests/fixtures/server'
import { NotFoundError } from '@server/lib/errors'

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_USER_ID_2 = '550e8400-e29b-41d4-a716-446655440002'
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440101'
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655440999'

// Mock the users service
vi.mock('@server/services', () => ({
  usersService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    createUserAccounts: vi.fn(),
    deleteUserAccounts: vi.fn(),
  },
}))

import { usersService } from '@server/services'

describe('Users Routes', () => {
  let app: Hono<HonoEnv>
  let mockEnv: ReturnType<typeof createMockEnv>
  let mockDb: any
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()

    testUser = createUserFixture({ id: TEST_USER_ID, email: 'test@example.com' })
    testAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })

    // Create mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    }

    app = new Hono<HonoEnv>()
  })

  // Helper to setup authenticated app with specific role
  function setupAuthenticatedApp(userRole = 'VIEWER', isSuperAdmin = false) {
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

    authenticatedApp.route('/users', users)
    return authenticatedApp
  }

  // Helper to setup unauthenticated app
  function setupUnauthenticatedApp() {
    const unauthApp = new Hono<HonoEnv>()

    unauthApp.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      // No user or accountId set - unauthenticated
      await next()
    })

    unauthApp.route('/users', users)
    return unauthApp
  }

  describe('GET /users', () => {
    it('returns paginated users', async () => {
      const usersData = [
        createUserFixture({ id: TEST_USER_ID, email: 'user1@example.com' }),
        createUserFixture({ id: TEST_USER_ID_2, email: 'user2@example.com' }),
      ]

      vi.mocked(usersService.findAll).mockResolvedValue({
        data: usersData,
        meta: {
          currentPage: 1,
          limit: 10,
          totalItems: 2,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request('/users', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta).toBeDefined()
      expect(body.meta.totalItems).toBe(2)
    })

    it('supports pagination query parameters', async () => {
      vi.mocked(usersService.findAll).mockResolvedValue({
        data: [],
        meta: {
          currentPage: 2,
          limit: 5,
          totalItems: 10,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request('/users?page=2&limit=5', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(usersService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          accountId: testAccount.id,
        }),
        expect.objectContaining({
          page: 2,
          limit: 5,
        })
      )
    })

    it('requires authentication (returns error without user)', async () => {
      const unauthApp = setupUnauthenticatedApp()

      // The handler checks for required context (db, accountId, user)
      // When user is not set, it throws "Missing required context"
      const res = await unauthApp.request('/users', {
        method: 'GET',
      })

      // Handler throws before reaching the service
      // Error handler catches this and returns 500
      expect(res.status).toBe(500)
      expect(usersService.findAll).not.toHaveBeenCalled()
    })

    it('supports search query parameter', async () => {
      vi.mocked(usersService.findAll).mockResolvedValue({
        data: [createUserFixture({ id: TEST_USER_ID, email: 'search@example.com' })],
        meta: {
          currentPage: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      })

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request('/users?query=search', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(usersService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.anything(),
        expect.objectContaining({
          query: 'search',
        })
      )
    })
  })

  describe('GET /users/:id', () => {
    it('returns user by ID', async () => {
      const user = createUserFixture({ id: TEST_USER_ID, email: 'test@example.com' })
      vi.mocked(usersService.findById).mockResolvedValue(user)

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(TEST_USER_ID)
      expect(body.data.email).toBe('test@example.com')
    })

    it('returns 404 for non-existent user', async () => {
      vi.mocked(usersService.findById).mockRejectedValue(new NotFoundError('User'))

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request(`/users/${NON_EXISTENT_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(404)
    })

    it('calls service with correct context', async () => {
      const user = createUserFixture({ id: TEST_USER_ID })
      vi.mocked(usersService.findById).mockResolvedValue(user)

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      await authenticatedApp.request(`/users/${TEST_USER_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(usersService.findById).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.objectContaining({
          accountId: testAccount.id,
          user: expect.objectContaining({ id: testUser.id }),
        }),
        TEST_USER_ID
      )
    })
  })

  describe('PATCH /users/:id', () => {
    it('updates user with MANAGER role', async () => {
      const updatedUser = createUserFixture({
        id: TEST_USER_ID,
        name: 'Updated Name',
      })
      vi.mocked(usersService.update).mockResolvedValue(updatedUser)

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}`, {
        method: 'PATCH',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Updated Name')
    })

    it('allows updating user status', async () => {
      const updatedUser = createUserFixture({
        id: TEST_USER_ID,
        status: 'inactive',
      })
      vi.mocked(usersService.update).mockResolvedValue(updatedUser)

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}`, {
        method: 'PATCH',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'inactive',
        }),
      })

      expect(res.status).toBe(200)
      expect(usersService.update).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.anything(),
        TEST_USER_ID,
        expect.objectContaining({ status: 'inactive' })
      )
    })

    // Note: Role-based access control is tested via the requireRole middleware
    // which is tested separately in middleware/auth.test.ts

    it('returns 404 when user not found', async () => {
      vi.mocked(usersService.update).mockRejectedValue(new NotFoundError('User'))

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request(`/users/${NON_EXISTENT_ID}`, {
        method: 'PATCH',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /users/:id', () => {
    it('soft deletes user with ADMIN role', async () => {
      vi.mocked(usersService.delete).mockResolvedValue()

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}`, {
        method: 'DELETE',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(204)
      expect(usersService.delete).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.anything(),
        TEST_USER_ID
      )
    })

    // Note: Role-based access control (MANAGER/VIEWER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts

    it('returns 404 when user not found', async () => {
      vi.mocked(usersService.delete).mockRejectedValue(new NotFoundError('User'))

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/users/${NON_EXISTENT_ID}`, {
        method: 'DELETE',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(404)
    })

    it('allows super admin to delete users', async () => {
      vi.mocked(usersService.delete).mockResolvedValue()

      const authenticatedApp = setupAuthenticatedApp('VIEWER', true)

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}`, {
        method: 'DELETE',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(204)
    })
  })

  describe('POST /users/:id/restore', () => {
    it('restores soft-deleted user with ADMIN role', async () => {
      const restoredUser = createUserFixture({
        id: TEST_USER_ID,
        deletedAt: null,
        status: 'active',
      })
      vi.mocked(usersService.restore).mockResolvedValue(restoredUser)

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}/restore`, {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(TEST_USER_ID)
      expect(body.data.deletedAt).toBeNull()
    })

    // Note: Role-based access control (MANAGER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts

    it('returns 404 when user not found or not deleted', async () => {
      vi.mocked(usersService.restore).mockRejectedValue(
        new NotFoundError('User not found or not deleted')
      )

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/users/${NON_EXISTENT_ID}/restore`, {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(404)
    })

    it('allows super admin to restore users', async () => {
      const restoredUser = createUserFixture({ id: TEST_USER_ID, deletedAt: null })
      vi.mocked(usersService.restore).mockResolvedValue(restoredUser)

      const authenticatedApp = setupAuthenticatedApp('VIEWER', true)

      const res = await authenticatedApp.request(`/users/${TEST_USER_ID}/restore`, {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
    })
  })

  describe('POST /users/accounts (bulk create)', () => {
    it('creates user-account relationships with MANAGER role', async () => {
      vi.mocked(usersService.createUserAccounts).mockResolvedValue({
        success: true,
        count: 2,
      })

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request('/users/accounts', {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { userId: TEST_USER_ID, accountId: TEST_ACCOUNT_ID, role: 'VIEWER' },
          { userId: TEST_USER_ID_2, accountId: TEST_ACCOUNT_ID, role: 'VIEWER' },
        ]),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.count).toBe(2)
    })

    it('returns 403 for VIEWER role', async () => {
      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request('/users/accounts', {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { userId: TEST_USER_ID, accountId: TEST_ACCOUNT_ID, role: 'VIEWER' },
        ]),
      })

      expect(res.status).toBe(403)
    })
  })

  // Note: DELETE /users/accounts tests are skipped because DELETE requests
  // with body may not work correctly in the Hono test environment.
  // This endpoint is tested via E2E tests instead.
  // Role-based access control is tested via the requireRole middleware.
})
