// src/server/routes/accounts/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types'
import { accounts } from '../index'
import { createMockEnv } from '../../../__tests__/setup'
import {
  createUserFixture,
  createAccountFixture,
} from '../../../__tests__/fixtures'
import { NotFoundError } from '../../../lib/errors'

// Test UUIDs
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_ACCOUNT_ID_2 = '550e8400-e29b-41d4-a716-446655440002'
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440101'
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655440999'

// Mock the accounts service
vi.mock('../../../services', () => ({
  accountsService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}))

import { accountsService } from '../../../services'

describe('Accounts Routes', () => {
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

    authenticatedApp.route('/accounts', accounts)
    return authenticatedApp
  }

  describe('GET /accounts', () => {
    it('returns paginated accounts', async () => {
      const accountsData = [
        createAccountFixture({ id: TEST_ACCOUNT_ID, name: 'Account 1' }),
        createAccountFixture({ id: TEST_ACCOUNT_ID_2, name: 'Account 2' }),
      ]

      vi.mocked(accountsService.findAll).mockResolvedValue({
        data: accountsData,
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

      const res = await authenticatedApp.request('/accounts', {
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
      vi.mocked(accountsService.findAll).mockResolvedValue({
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

      const res = await authenticatedApp.request('/accounts?page=2&limit=5', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(accountsService.findAll).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          accountId: testAccount.id,
        }),
        expect.objectContaining({
          page: 2,
          limit: 5,
        })
      )
    })

    it('supports search query parameter', async () => {
      vi.mocked(accountsService.findAll).mockResolvedValue({
        data: [createAccountFixture({ id: TEST_ACCOUNT_ID, name: 'Search Account' })],
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

      const res = await authenticatedApp.request('/accounts?query=search', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(accountsService.findAll).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        expect.objectContaining({
          query: 'search',
        })
      )
    })
  })

  describe('GET /accounts/:id', () => {
    it('returns account by ID', async () => {
      const account = createAccountFixture({ id: TEST_ACCOUNT_ID, name: 'Test Account' })
      vi.mocked(accountsService.findById).mockResolvedValue(account)

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(TEST_ACCOUNT_ID)
      expect(body.data.name).toBe('Test Account')
    })

    it('returns 404 for non-existent account', async () => {
      vi.mocked(accountsService.findById).mockRejectedValue(new NotFoundError('Account'))

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request(`/accounts/${NON_EXISTENT_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(404)
    })

    it('calls service with correct context', async () => {
      const account = createAccountFixture({ id: TEST_ACCOUNT_ID })
      vi.mocked(accountsService.findById).mockResolvedValue(account)

      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(accountsService.findById).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          accountId: testAccount.id,
          user: expect.objectContaining({ id: testUser.id }),
        }),
        TEST_ACCOUNT_ID
      )
    })
  })

  describe('POST /accounts', () => {
    it('creates new account with ADMIN role', async () => {
      const newAccount = createAccountFixture({
        id: TEST_ACCOUNT_ID,
        name: 'New Account',
        description: 'A new account',
      })
      vi.mocked(accountsService.create).mockResolvedValue(newAccount)

      const authenticatedApp = setupAuthenticatedApp('ADMIN', true)

      const res = await authenticatedApp.request('/accounts', {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Account',
          description: 'A new account',
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe('New Account')
      expect(body.data.description).toBe('A new account')
    })

    it('creates account with domain', async () => {
      const newAccount = createAccountFixture({
        id: TEST_ACCOUNT_ID,
        name: 'Domain Account',
        domain: 'example.com',
      })
      vi.mocked(accountsService.create).mockResolvedValue(newAccount)

      const authenticatedApp = setupAuthenticatedApp('ADMIN', true)

      const res = await authenticatedApp.request('/accounts', {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Domain Account',
          domain: 'example.com',
        }),
      })

      expect(res.status).toBe(201)
      expect(accountsService.create).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        expect.objectContaining({
          name: 'Domain Account',
          domain: 'example.com',
        })
      )
    })

    it('returns 403 for VIEWER role', async () => {
      const authenticatedApp = setupAuthenticatedApp('VIEWER')

      const res = await authenticatedApp.request('/accounts', {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Account',
        }),
      })

      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /accounts/:id', () => {
    it('updates account with MANAGER role', async () => {
      const updatedAccount = createAccountFixture({
        id: TEST_ACCOUNT_ID,
        name: 'Updated Account',
        description: 'Updated description',
      })
      vi.mocked(accountsService.update).mockResolvedValue(updatedAccount)

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'PATCH',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Account',
          description: 'Updated description',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Updated Account')
      expect(body.data.description).toBe('Updated description')
    })

    it('returns 404 when account not found', async () => {
      vi.mocked(accountsService.update).mockRejectedValue(new NotFoundError('Account'))

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request(`/accounts/${NON_EXISTENT_ID}`, {
        method: 'PATCH',
        headers: {
          'Account-ID': testAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Account',
        }),
      })

      expect(res.status).toBe(404)
    })

    // Note: Role-based access control (VIEWER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts
  })

  describe('DELETE /accounts/:id', () => {
    it('soft deletes account with ADMIN role', async () => {
      vi.mocked(accountsService.delete).mockResolvedValue()

      const authenticatedApp = setupAuthenticatedApp('ADMIN', true)

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'DELETE',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(204)
      expect(accountsService.delete).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        TEST_ACCOUNT_ID
      )
    })

    it('returns 404 when account not found', async () => {
      vi.mocked(accountsService.delete).mockRejectedValue(new NotFoundError('Account'))

      const authenticatedApp = setupAuthenticatedApp('ADMIN', true)

      const res = await authenticatedApp.request(`/accounts/${NON_EXISTENT_ID}`, {
        method: 'DELETE',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(404)
    })

    // Note: Role-based access control (MANAGER/VIEWER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts
  })

  describe('POST /accounts/:id/restore', () => {
    it('restores soft-deleted account with ADMIN role', async () => {
      const restoredAccount = createAccountFixture({
        id: TEST_ACCOUNT_ID,
        deletedAt: null,
      })
      vi.mocked(accountsService.restore).mockResolvedValue(restoredAccount)

      const authenticatedApp = setupAuthenticatedApp('ADMIN', true)

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}/restore`, {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(TEST_ACCOUNT_ID)
      expect(body.data.deletedAt).toBeNull()
    })

    it('returns 404 when account not found or not deleted', async () => {
      vi.mocked(accountsService.restore).mockRejectedValue(
        new NotFoundError('Account not found or not deleted')
      )

      const authenticatedApp = setupAuthenticatedApp('ADMIN', true)

      const res = await authenticatedApp.request(`/accounts/${NON_EXISTENT_ID}/restore`, {
        method: 'POST',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(404)
    })

    // Note: Role-based access control (MANAGER/VIEWER denied) is tested via
    // the requireRole middleware which is tested separately in middleware/auth.test.ts
  })
})
