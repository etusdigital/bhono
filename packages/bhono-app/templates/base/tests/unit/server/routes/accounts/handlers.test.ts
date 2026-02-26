// src/server/routes/accounts/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv, SessionData } from '@server/types'
import { accounts } from '@server/routes/index'
import { createMockEnv } from '@tests/helpers/server'
import {
  createUserFixture,
  createAccountFixture,
} from '@tests/fixtures/server'
import { NotFoundError } from '@server/lib/errors'
import {
  listAccountsHandler,
  getAccountHandler,
  createAccountHandler,
  updateAccountHandler,
  deleteAccountHandler,
  restoreAccountHandler,
} from '@server/routes/accounts/handlers'

// Test UUIDs
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_ACCOUNT_ID_2 = '550e8400-e29b-41d4-a716-446655440002'
const TEST_ACCOUNT_ID_3 = '550e8400-e29b-41d4-a716-446655440003'
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440101'
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655440999'

// Mock the accounts service
vi.mock('@server/services', () => ({
  accountsService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}))

// Mock queryAll from db/sql
vi.mock('@server/db/sql', async (importOriginal) => {
  const original = await importOriginal<typeof import('@server/db/sql')>()
  return {
    ...original,
    queryAll: vi.fn(),
  }
})

// Mock session functions
vi.mock('@server/lib/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@server/lib/session')>()
  return {
    ...original,
    getSession: vi.fn(),
    updateSession: vi.fn(),
  }
})

// Mock audit functions
vi.mock('@server/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { accountsService } from '@server/services'
import { queryAll } from '@server/db/sql'
import { getSession, updateSession } from '@server/lib/session'
import { logAudit } from '@server/lib/audit'

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
  function setupAuthenticatedApp(userRole = 'viewer', isSuperAdmin = false) {
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

      const authenticatedApp = setupAuthenticatedApp('viewer')

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

      const authenticatedApp = setupAuthenticatedApp('viewer')

      const res = await authenticatedApp.request('/accounts?page=2&limit=5', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(accountsService.findAll).toHaveBeenCalledWith(
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

      const authenticatedApp = setupAuthenticatedApp('viewer')

      const res = await authenticatedApp.request('/accounts?query=search', {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(200)
      expect(accountsService.findAll).toHaveBeenCalledWith(
        mockEnv.DB,
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

      const authenticatedApp = setupAuthenticatedApp('viewer')

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

      const authenticatedApp = setupAuthenticatedApp('viewer')

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

      const authenticatedApp = setupAuthenticatedApp('viewer')

      await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'GET',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(accountsService.findById).toHaveBeenCalledWith(
        mockEnv.DB,
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

      const authenticatedApp = setupAuthenticatedApp('admin', true)

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

      const authenticatedApp = setupAuthenticatedApp('admin', true)

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
        mockEnv.DB,
        expect.anything(),
        expect.objectContaining({
          name: 'Domain Account',
          domain: 'example.com',
        })
      )
    })

    it('returns 403 for VIEWER role', async () => {
      const authenticatedApp = setupAuthenticatedApp('viewer')

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

    it('returns 401 when missing user context', async () => {
      const authenticatedApp = new Hono<HonoEnv>()

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        // Missing user and accountId - middleware returns 401
        c.set('user', undefined as any)
        c.set('accountId', undefined as any)
        c.set('userRole', 'admin')
        c.set('isSystemAdminAccess', true)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request('/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Account',
        }),
      })

      // Auth middleware returns 401 before handler's context check
      expect(res.status).toBe(401)
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

      const authenticatedApp = setupAuthenticatedApp('manager')

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

      const authenticatedApp = setupAuthenticatedApp('manager')

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

    it('returns 401 when missing user context', async () => {
      const authenticatedApp = new Hono<HonoEnv>()

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        // Missing user and accountId - middleware returns 401
        c.set('user', undefined as any)
        c.set('accountId', undefined as any)
        c.set('userRole', 'manager')
        c.set('isSystemAdminAccess', false)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Account',
        }),
      })

      // Auth middleware returns 401 before handler's context check
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /accounts/:id', () => {
    it('soft deletes account with ADMIN role', async () => {
      vi.mocked(accountsService.delete).mockResolvedValue()

      const authenticatedApp = setupAuthenticatedApp('admin', true)

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'DELETE',
        headers: {
          'Account-ID': testAccount.id,
        },
      })

      expect(res.status).toBe(204)
      expect(accountsService.delete).toHaveBeenCalledWith(
        mockEnv.DB,
        expect.anything(),
        TEST_ACCOUNT_ID
      )
    })

    it('returns 404 when account not found', async () => {
      vi.mocked(accountsService.delete).mockRejectedValue(new NotFoundError('Account'))

      const authenticatedApp = setupAuthenticatedApp('admin', true)

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

    it('returns 401 when missing user context', async () => {
      const authenticatedApp = new Hono<HonoEnv>()

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        // Missing user and accountId - middleware returns 401
        c.set('user', undefined as any)
        c.set('accountId', undefined as any)
        c.set('userRole', 'admin')
        c.set('isSystemAdminAccess', true)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}`, {
        method: 'DELETE',
      })

      // Auth middleware returns 401 before handler's context check
      expect(res.status).toBe(401)
    })
  })

  describe('POST /accounts/:id/restore', () => {
    it('restores soft-deleted account with ADMIN role', async () => {
      const restoredAccount = createAccountFixture({
        id: TEST_ACCOUNT_ID,
        deletedAt: null,
      })
      vi.mocked(accountsService.restore).mockResolvedValue(restoredAccount)

      const authenticatedApp = setupAuthenticatedApp('admin', true)

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

      const authenticatedApp = setupAuthenticatedApp('admin', true)

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

    it('returns 401 when missing user context', async () => {
      const authenticatedApp = new Hono<HonoEnv>()

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        // Missing user and accountId - middleware returns 401
        c.set('user', undefined as any)
        c.set('accountId', undefined as any)
        c.set('userRole', 'admin')
        c.set('isSystemAdminAccess', true)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request(`/accounts/${TEST_ACCOUNT_ID}/restore`, {
        method: 'POST',
      })

      // Auth middleware returns 401 before handler's context check
      expect(res.status).toBe(401)
    })
  })

  describe('GET /accounts/my', () => {
    // Helper to setup app with session data for my-accounts endpoint
    function setupMyAccountsApp(
      userOverrides: { id?: string; isSuperAdmin?: boolean } = {},
      sessionData: SessionData | null = null
    ) {
      const authenticatedApp = new Hono<HonoEnv>()
      const user = createUserFixture({
        id: userOverrides.id ?? TEST_USER_ID,
        email: 'test@example.com',
        isSuperAdmin: userOverrides.isSuperAdmin ?? false,
      })

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        c.set('user', user)
        c.set('accountId', TEST_ACCOUNT_ID)
        c.set('userRole', 'viewer')
        c.set('isSystemAdminAccess', false)

        // Mock getSession to return the session data
        vi.mocked(getSession).mockReturnValue(sessionData)

        await next()
      })

      authenticatedApp.route('/accounts', accounts)
      return { app: authenticatedApp, user }
    }

    it('returns all accounts for the current user with roles and isCurrent flag', async () => {
      const mockRows = [
        {
          id: TEST_ACCOUNT_ID,
          name: 'Account 1',
          description: 'First account',
          domain: 'account1.com',
          slug: 'account-1',
          timezone: 'UTC',
          language: 'en',
          status: 'active',
          role: 'admin',
        },
        {
          id: TEST_ACCOUNT_ID_2,
          name: 'Account 2',
          description: null,
          domain: null,
          slug: null,
          timezone: null,
          language: null,
          status: 'active',
          role: 'viewer',
        },
      ]

      vi.mocked(queryAll).mockResolvedValue(mockRows)

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupMyAccountsApp({}, sessionData)

      const res = await app.request('/accounts/my', {
        method: 'GET',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data[0].id).toBe(TEST_ACCOUNT_ID)
      expect(body.data[0].role).toBe('admin')
      expect(body.data[0].isCurrent).toBe(true)
      expect(body.data[1].id).toBe(TEST_ACCOUNT_ID_2)
      expect(body.data[1].role).toBe('viewer')
      expect(body.data[1].isCurrent).toBe(false)
      expect(body.currentAccountId).toBe(TEST_ACCOUNT_ID)
    })

    it('returns accounts with suspended status properly mapped', async () => {
      const mockRows = [
        {
          id: TEST_ACCOUNT_ID,
          name: 'Suspended Account',
          description: null,
          domain: null,
          slug: null,
          timezone: null,
          language: null,
          status: 'suspended',
          role: 'admin',
        },
      ]

      vi.mocked(queryAll).mockResolvedValue(mockRows)

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupMyAccountsApp({}, sessionData)

      const res = await app.request('/accounts/my', {
        method: 'GET',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data[0].status).toBe('suspended')
    })

    it('uses accountId from context when session has no currentAccountId', async () => {
      const mockRows = [
        {
          id: TEST_ACCOUNT_ID,
          name: 'Account 1',
          description: null,
          domain: null,
          slug: null,
          timezone: null,
          language: null,
          status: 'active',
          role: 'admin',
        },
      ]

      vi.mocked(queryAll).mockResolvedValue(mockRows)

      // Session without currentAccountId
      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: null,
      }

      const { app } = setupMyAccountsApp({}, sessionData)

      const res = await app.request('/accounts/my', {
        method: 'GET',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      // Should fallback to accountId from context (TEST_ACCOUNT_ID)
      expect(body.data[0].isCurrent).toBe(true)
    })

    it('falls back to accountId from context when no session exists', async () => {
      const mockRows = [
        {
          id: TEST_ACCOUNT_ID,
          name: 'Account 1',
          description: null,
          domain: null,
          slug: null,
          timezone: null,
          language: null,
          status: 'active',
          role: 'admin',
        },
      ]

      vi.mocked(queryAll).mockResolvedValue(mockRows)

      // No session (null)
      const { app } = setupMyAccountsApp({}, null)

      const res = await app.request('/accounts/my', {
        method: 'GET',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      // Should fallback to accountId from context
      expect(body.currentAccountId).toBe(TEST_ACCOUNT_ID)
    })

    it('returns 401 when db is missing', async () => {
      const authenticatedApp = new Hono<HonoEnv>()
      const user = createUserFixture({ id: TEST_USER_ID })

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = { ...mockEnv, DB: undefined }
        c.set('db', undefined as any) // No DB
        c.set('user', user)
        vi.mocked(getSession).mockReturnValue(null)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request('/accounts/my', {
        method: 'GET',
      })

      expect(res.status).toBe(401)
    })

    it('returns 401 when user is missing', async () => {
      const authenticatedApp = new Hono<HonoEnv>()

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('user', undefined as any) // No user
        vi.mocked(getSession).mockReturnValue(null)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request('/accounts/my', {
        method: 'GET',
      })

      expect(res.status).toBe(401)
    })

    it('returns empty array when user has no accounts', async () => {
      vi.mocked(queryAll).mockResolvedValue([])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupMyAccountsApp({}, sessionData)

      const res = await app.request('/accounts/my', {
        method: 'GET',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
    })
  })

  describe('POST /accounts/switch', () => {
    // Helper to setup app with session data for switch endpoint
    function setupSwitchAccountApp(
      userOverrides: { id?: string; isSuperAdmin?: boolean } = {},
      sessionData: SessionData | null = null
    ) {
      const authenticatedApp = new Hono<HonoEnv>()
      const user = createUserFixture({
        id: userOverrides.id ?? TEST_USER_ID,
        email: 'test@example.com',
        isSuperAdmin: userOverrides.isSuperAdmin ?? false,
      })

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        c.set('user', user)
        c.set('accountId', TEST_ACCOUNT_ID)
        c.set('userRole', 'viewer')
        c.set('isSystemAdminAccess', userOverrides.isSuperAdmin ?? false)

        // Set session data in context for updateSession
        if (sessionData) {
          c.set('sessionId', 'test-session-id')
          c.set('sessionData', sessionData)
        }

        // Mock getSession to return the session data
        vi.mocked(getSession).mockReturnValue(sessionData)
        vi.mocked(updateSession).mockResolvedValue(undefined)

        await next()
      })

      authenticatedApp.route('/accounts', accounts)
      return { app: authenticatedApp, user }
    }

    it('successfully switches to another account with active membership', async () => {
      const mockAccountRow = {
        id: TEST_ACCOUNT_ID_2,
        name: 'Target Account',
        description: 'Target account description',
        domain: 'target.com',
        slug: 'target',
        timezone: 'America/New_York',
        language: 'en',
        status: 'active',
        role: 'user',
      }

      vi.mocked(queryAll).mockResolvedValue([mockAccountRow])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({}, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.currentAccountId).toBe(TEST_ACCOUNT_ID_2)
      expect(body.account.id).toBe(TEST_ACCOUNT_ID_2)
      expect(body.account.name).toBe('Target Account')
      expect(body.account.role).toBe('user')
      expect(body.account.isCurrent).toBe(true)
      expect(body.account.status).toBe('active')

      // Verify updateSession was called
      expect(updateSession).toHaveBeenCalled()
      // Verify audit was logged
      expect(logAudit).toHaveBeenCalled()
    })

    it('returns 401 when db is missing', async () => {
      const authenticatedApp = new Hono<HonoEnv>()
      const user = createUserFixture({ id: TEST_USER_ID })
      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = { ...mockEnv, DB: undefined }
        c.set('db', undefined as any) // No DB
        c.set('user', user)
        c.set('sessionId', 'test-session-id')
        c.set('sessionData', sessionData)
        vi.mocked(getSession).mockReturnValue(sessionData)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 401 when user is missing', async () => {
      const authenticatedApp = new Hono<HonoEnv>()
      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      }

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('user', undefined as any) // No user
        c.set('sessionId', 'test-session-id')
        c.set('sessionData', sessionData)
        vi.mocked(getSession).mockReturnValue(sessionData)
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 401 when session is missing', async () => {
      const authenticatedApp = new Hono<HonoEnv>()
      const user = createUserFixture({ id: TEST_USER_ID })

      authenticatedApp.use('*', async (c, next) => {
        ;(c as any).env = mockEnv
        c.set('db', mockDb)
        c.set('user', user)
        // No session data set
        vi.mocked(getSession).mockReturnValue(null) // No session
        await next()
      })

      authenticatedApp.route('/accounts', accounts)

      const res = await authenticatedApp.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 404 when account does not exist', async () => {
      // First queryAll returns empty (no membership found)
      // Second queryAll returns empty (account doesn't exist)
      vi.mocked(queryAll)
        .mockResolvedValueOnce([]) // First call: check membership
        .mockResolvedValueOnce([]) // Second call: check account exists

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({}, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: NON_EXISTENT_ID,
        }),
      })

      expect(res.status).toBe(404)
      const body = await res.text()
      expect(body).toBe('Account not found')
    })

    it('returns 403 when user has no active membership for the account', async () => {
      // First queryAll returns empty (no membership found)
      // Second queryAll returns the account (it exists)
      vi.mocked(queryAll)
        .mockResolvedValueOnce([]) // First call: check membership (none)
        .mockResolvedValueOnce([{ id: TEST_ACCOUNT_ID_2 }]) // Second call: account exists

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({}, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(403)
      const body = await res.text()
      expect(body).toBe('No active membership for this account')
    })

    it('returns 403 when account is suspended and user is not super admin', async () => {
      const mockAccountRow = {
        id: TEST_ACCOUNT_ID_2,
        name: 'Suspended Account',
        description: null,
        domain: null,
        slug: null,
        timezone: null,
        language: null,
        status: 'suspended', // Account is suspended
        role: 'admin',
      }

      vi.mocked(queryAll).mockResolvedValue([mockAccountRow])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false, // Not super admin
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({ isSuperAdmin: false }, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(403)
      const body = await res.text()
      expect(body).toBe('Account is suspended')
    })

    it('allows super admin to switch to suspended account', async () => {
      const mockAccountRow = {
        id: TEST_ACCOUNT_ID_2,
        name: 'Suspended Account',
        description: null,
        domain: null,
        slug: null,
        timezone: null,
        language: null,
        status: 'suspended', // Account is suspended
        role: 'admin',
      }

      vi.mocked(queryAll).mockResolvedValue([mockAccountRow])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'superadmin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true, // IS super admin
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({ isSuperAdmin: true }, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.account.status).toBe('suspended')
      expect(body.currentAccountId).toBe(TEST_ACCOUNT_ID_2)
    })

    it('logs audit with previous and new account IDs', async () => {
      const mockAccountRow = {
        id: TEST_ACCOUNT_ID_2,
        name: 'Target Account',
        description: null,
        domain: null,
        slug: null,
        timezone: null,
        language: null,
        status: 'active',
        role: 'viewer',
      }

      vi.mocked(queryAll).mockResolvedValue([mockAccountRow])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({}, sessionData)

      await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(), // db
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID_2,
          userId: TEST_USER_ID,
          action: 'ACCOUNT_SWITCHED',
          changes: expect.objectContaining({
            previousAccountId: TEST_ACCOUNT_ID,
            newAccountId: TEST_ACCOUNT_ID_2,
          }),
        })
      )
    })

    it('handles null previousAccountId in session', async () => {
      const mockAccountRow = {
        id: TEST_ACCOUNT_ID_2,
        name: 'Target Account',
        description: null,
        domain: null,
        slug: null,
        timezone: null,
        language: null,
        status: 'active',
        role: 'viewer',
      }

      vi.mocked(queryAll).mockResolvedValue([mockAccountRow])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: undefined, // No previous account
      }

      const { app } = setupSwitchAccountApp({}, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify audit was logged with null previousAccountId
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          changes: expect.objectContaining({
            previousAccountId: null,
            newAccountId: TEST_ACCOUNT_ID_2,
          }),
        })
      )
    })

    it('properly maps all account fields in response', async () => {
      const mockAccountRow = {
        id: TEST_ACCOUNT_ID_2,
        name: 'Full Account',
        description: 'Full description',
        domain: 'full.example.com',
        slug: 'full-account',
        timezone: 'Europe/London',
        language: 'en-GB',
        status: 'active',
        role: 'admin',
        // Branding fields
        logo_url: 'https://example.com/logo.png',
        favicon_url: 'https://example.com/favicon.ico',
        primary_color: '#10b981',
        secondary_color: '#3b82f6',
        accent_color: '#f59e0b',
      }

      vi.mocked(queryAll).mockResolvedValue([mockAccountRow])

      const sessionData: SessionData = {
        userId: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
        currentAccountId: TEST_ACCOUNT_ID,
      }

      const { app } = setupSwitchAccountApp({}, sessionData)

      const res = await app.request('/accounts/switch', {
        method: 'POST',
        headers: {
          'Account-ID': TEST_ACCOUNT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: TEST_ACCOUNT_ID_2,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.account).toEqual({
        id: TEST_ACCOUNT_ID_2,
        name: 'Full Account',
        description: 'Full description',
        domain: 'full.example.com',
        slug: 'full-account',
        timezone: 'Europe/London',
        language: 'en-GB',
        status: 'active',
        role: 'admin',
        isCurrent: true,
        // Branding fields
        logoUrl: 'https://example.com/logo.png',
        faviconUrl: 'https://example.com/favicon.ico',
        primaryColor: '#10b981',
        secondaryColor: '#3b82f6',
        accentColor: '#f59e0b',
      })
    })
  })

  // Direct handler tests to cover missing context branches
  // These bypass middleware to test the handler's own context validation
  describe('Direct handler context validation', () => {
    // Helper to create a mock Hono context
    function createMockContext(overrides: {
      db?: any
      accountId?: string | undefined
      user?: any
      envDb?: any
    }) {
      const contextData: Record<string, any> = {
        db: overrides.db,
        accountId: overrides.accountId,
        user: overrides.user,
        transactionId: 'test-transaction-id',
        ip: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      }

      return {
        get: (key: string) => contextData[key],
        set: vi.fn(),
        env: { DB: overrides.envDb ?? mockEnv.DB },
        req: {
          valid: vi.fn().mockImplementation((type: string) => {
            if (type === 'json') return { name: 'Test' }
            if (type === 'param') return { id: TEST_ACCOUNT_ID }
            return {}
          }),
        },
        json: vi.fn(),
        body: vi.fn(),
      } as any
    }

    it('listAccountsHandler throws when db is missing', async () => {
      const mockContext = createMockContext({
        db: undefined,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        envDb: undefined,
      })

      await expect(listAccountsHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('listAccountsHandler throws when accountId is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: undefined,
        user: testUser,
      })

      await expect(listAccountsHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('listAccountsHandler throws when user is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: undefined,
      })

      await expect(listAccountsHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('getAccountHandler throws when db is missing', async () => {
      const mockContext = createMockContext({
        db: undefined,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        envDb: undefined,
      })

      await expect(getAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('getAccountHandler throws when accountId is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: undefined,
        user: testUser,
      })

      await expect(getAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('getAccountHandler throws when user is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: undefined,
      })

      await expect(getAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('createAccountHandler throws when db is missing', async () => {
      const mockContext = createMockContext({
        db: undefined,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        envDb: undefined, // Also remove env.DB
      })

      await expect(createAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('createAccountHandler throws when accountId is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: undefined,
        user: testUser,
      })

      await expect(createAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('createAccountHandler throws when user is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: undefined,
      })

      await expect(createAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('updateAccountHandler throws when db is missing', async () => {
      const mockContext = createMockContext({
        db: undefined,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        envDb: undefined,
      })

      await expect(updateAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('updateAccountHandler throws when accountId is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: undefined,
        user: testUser,
      })

      await expect(updateAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('updateAccountHandler throws when user is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: undefined,
      })

      await expect(updateAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('deleteAccountHandler throws when db is missing', async () => {
      const mockContext = createMockContext({
        db: undefined,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        envDb: undefined,
      })

      await expect(deleteAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('deleteAccountHandler throws when accountId is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: undefined,
        user: testUser,
      })

      await expect(deleteAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('deleteAccountHandler throws when user is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: undefined,
      })

      await expect(deleteAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('restoreAccountHandler throws when db is missing', async () => {
      const mockContext = createMockContext({
        db: undefined,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        envDb: undefined,
      })

      await expect(restoreAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('restoreAccountHandler throws when accountId is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: undefined,
        user: testUser,
      })

      await expect(restoreAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    it('restoreAccountHandler throws when user is missing', async () => {
      const mockContext = createMockContext({
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: undefined,
      })

      await expect(restoreAccountHandler(mockContext)).rejects.toThrow('Missing required context')
    })

    // Test envDb ?? db fallback branch - when envDb is undefined, db is used
    it('deleteAccountHandler uses db when envDb is undefined', async () => {
      vi.mocked(accountsService.delete).mockResolvedValue()

      const contextData: Record<string, any> = {
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        transactionId: 'test-transaction-id',
        ip: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      }

      const mockContext = {
        get: (key: string) => contextData[key],
        set: vi.fn(),
        env: { DB: undefined }, // envDb is undefined
        req: {
          valid: vi.fn().mockImplementation((type: string) => {
            if (type === 'param') return { id: TEST_ACCOUNT_ID }
            return {}
          }),
        },
        json: vi.fn(),
        body: vi.fn().mockReturnValue(new Response(null, { status: 204 })),
      } as any

      await deleteAccountHandler(mockContext)

      // Verify service was called with db (since envDb is undefined)
      expect(accountsService.delete).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        TEST_ACCOUNT_ID
      )
    })

    it('restoreAccountHandler uses db when envDb is undefined', async () => {
      const restoredAccount = createAccountFixture({ id: TEST_ACCOUNT_ID })
      vi.mocked(accountsService.restore).mockResolvedValue(restoredAccount)

      const contextData: Record<string, any> = {
        db: mockDb,
        accountId: TEST_ACCOUNT_ID,
        user: testUser,
        transactionId: 'test-transaction-id',
        ip: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      }

      const mockContext = {
        get: (key: string) => contextData[key],
        set: vi.fn(),
        env: { DB: undefined }, // envDb is undefined
        req: {
          valid: vi.fn().mockImplementation((type: string) => {
            if (type === 'param') return { id: TEST_ACCOUNT_ID }
            return {}
          }),
        },
        json: vi.fn().mockReturnValue(new Response(JSON.stringify({ data: restoredAccount }), { status: 200 })),
        body: vi.fn(),
      } as any

      await restoreAccountHandler(mockContext)

      // Verify service was called with db (since envDb is undefined)
      expect(accountsService.restore).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        TEST_ACCOUNT_ID
      )
    })
  })
})
