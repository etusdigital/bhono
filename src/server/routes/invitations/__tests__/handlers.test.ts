// src/server/routes/invitations/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types'
import { invitationsRouter } from '../index'
import { createMockEnv } from '../../../__tests__/setup'
import { createUserFixture, createAccountFixture } from '../../../__tests__/fixtures'
import { NotFoundError, ConflictError, ForbiddenError } from '../../../lib/errors'

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440101'
const TEST_INVITATION_ID = '550e8400-e29b-41d4-a716-446655440201'
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655440999'

// Mock the invitations service
vi.mock('../../../services/invitations', () => ({
  invitationsService: {
    create: vi.fn(),
    list: vi.fn(),
    revoke: vi.fn(),
  },
}))

import { invitationsService } from '../../../services/invitations'

describe('Invitations Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let mockDb: any
  let testUser: ReturnType<typeof createUserFixture>
  let testAccount: ReturnType<typeof createAccountFixture>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()

    testUser = createUserFixture({ id: TEST_USER_ID, email: 'admin@example.com', name: 'Admin User' })
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
  function setupAuthenticatedApp(userRole: string = 'ADMIN', isSuperAdmin: boolean = false) {
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

    authenticatedApp.route('/invitations', invitationsRouter)
    return authenticatedApp
  }

  describe('POST /invitations (createInvitationHandler)', () => {
    it('should create invitation for new user', async () => {
      const invitationResult = {
        linked: false,
        invited: true,
        invitation: {
          id: TEST_INVITATION_ID,
          email: 'newuser@example.com',
          role: 'VIEWER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }

      vi.mocked(invitationsService.create).mockResolvedValue(invitationResult)

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request('/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.linked).toBe(false)
      expect(body.invited).toBe(true)
      expect(body.invitation).toBeDefined()
      expect(body.invitation.email).toBe('newuser@example.com')
      expect(body.invitation.role).toBe('VIEWER')
    })

    it('should return linked user when existing user is invited', async () => {
      const linkedResult = {
        linked: true,
        invited: false,
        user: {
          id: 'existing-user-id',
          email: 'existing@example.com',
          name: 'Existing User',
        },
      }

      vi.mocked(invitationsService.create).mockResolvedValue(linkedResult)

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request('/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'existing@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.linked).toBe(true)
      expect(body.invited).toBe(false)
      expect(body.user).toBeDefined()
      expect(body.user.email).toBe('existing@example.com')
      expect(body.user.name).toBe('Existing User')
    })

    it('should throw ForbiddenError when assigning higher role', async () => {
      vi.mocked(invitationsService.create).mockRejectedValue(
        new ForbiddenError('Cannot assign a role higher than your own')
      )

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request('/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          role: 'ADMIN',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should throw ConflictError when user already member', async () => {
      vi.mocked(invitationsService.create).mockRejectedValue(
        new ConflictError('User is already a member of this account')
      )

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request('/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'member@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(409)
    })

    it('calls service with correct parameters', async () => {
      vi.mocked(invitationsService.create).mockResolvedValue({
        linked: false,
        invited: true,
        invitation: {
          id: TEST_INVITATION_ID,
          email: 'test@example.com',
          role: 'MANAGER',
          expiresAt: new Date().toISOString(),
        },
      })

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      await authenticatedApp.request('/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          role: 'MANAGER',
        }),
      })

      expect(invitationsService.create).toHaveBeenCalledWith(
        mockDb,
        mockEnv,
        expect.objectContaining({
          accountId: testAccount.id,
          user: expect.objectContaining({ id: testUser.id }),
          userRole: 'ADMIN',
        }),
        expect.objectContaining({
          email: 'test@example.com',
          role: 'MANAGER',
        })
      )
    })
  })

  describe('GET /invitations (listInvitationsHandler)', () => {
    it('should return list of invitations', async () => {
      const invitationsList = [
        {
          id: TEST_INVITATION_ID,
          email: 'invited1@example.com',
          role: 'VIEWER',
          invitedBy: { id: TEST_USER_ID, name: 'Admin User' },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440202',
          email: 'invited2@example.com',
          role: 'MANAGER',
          invitedBy: { id: TEST_USER_ID, name: 'Admin User' },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ]

      vi.mocked(invitationsService.list).mockResolvedValue(invitationsList)

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request('/invitations', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data[0].email).toBe('invited1@example.com')
      expect(body.data[1].email).toBe('invited2@example.com')
    })

    it('should return empty list when no invitations', async () => {
      vi.mocked(invitationsService.list).mockResolvedValue([])

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request('/invitations', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
    })

    it('calls service with correct context', async () => {
      vi.mocked(invitationsService.list).mockResolvedValue([])

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      await authenticatedApp.request('/invitations', {
        method: 'GET',
      })

      expect(invitationsService.list).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          accountId: testAccount.id,
          user: expect.objectContaining({ id: testUser.id }),
          userRole: 'ADMIN',
        })
      )
    })
  })

  describe('DELETE /invitations/:id (revokeInvitationHandler)', () => {
    it('should revoke invitation successfully', async () => {
      vi.mocked(invitationsService.revoke).mockResolvedValue(undefined)

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/invitations/${TEST_INVITATION_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(invitationsService.revoke).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          accountId: testAccount.id,
          user: expect.objectContaining({ id: testUser.id }),
        }),
        TEST_INVITATION_ID
      )
    })

    it('should throw NotFoundError for non-existent invitation', async () => {
      vi.mocked(invitationsService.revoke).mockRejectedValue(new NotFoundError('Invitation'))

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/invitations/${NON_EXISTENT_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })

    it('allows MANAGER role to revoke invitations', async () => {
      vi.mocked(invitationsService.revoke).mockResolvedValue(undefined)

      const authenticatedApp = setupAuthenticatedApp('MANAGER')

      const res = await authenticatedApp.request(`/invitations/${TEST_INVITATION_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })

    it('should throw NotFoundError when revoking already accepted invitation', async () => {
      vi.mocked(invitationsService.revoke).mockRejectedValue(new NotFoundError('Invitation'))

      const authenticatedApp = setupAuthenticatedApp('ADMIN')

      const res = await authenticatedApp.request(`/invitations/${TEST_INVITATION_ID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })
})
