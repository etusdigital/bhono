// src/server/services/__tests__/invitations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invitationsService } from '../invitations'
import { ForbiddenError, ConflictError } from '../../lib/errors'
import type { ServiceContext } from '../../types'
import { createUserFixture, createAccountFixture } from '../../__tests__/fixtures'

// Mock email module
vi.mock('../../lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}))

// Mock audit module
vi.mock('../../lib/audit', () => ({
  logAuthEvent: vi.fn(),
}))

import { sendInvitationEmail } from '../../lib/email'

/**
 * Creates a mock Drizzle database instance with chainable methods
 */
function createMockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'inv-1',
            email: 'invite@test.com',
            role: 'VIEWER',
            expiresAt: '2025-01-07T00:00:00Z',
          },
        ]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as any
}

const mockEnv = {
  SENDGRID_API_KEY: 'test-key',
  SENDGRID_FROM_EMAIL: 'noreply@test.com',
  APP_URL: 'http://localhost:3000',
} as any

/**
 * Creates a standard service context for testing
 */
function createMockContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
  const user = createUserFixture({
    id: 'ctx-user-123',
    email: 'admin@test.com',
    name: 'Admin User',
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

describe('invitationsService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let ctx: ServiceContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    ctx = createMockContext()
  })

  describe('create', () => {
    it('should throw ForbiddenError when assigning higher role than own', async () => {
      // A VIEWER (level 4) cannot invite an ADMIN (level 0)
      const viewerCtx = createMockContext({ userRole: 'VIEWER' })

      await expect(
        invitationsService.create(mockDb, mockEnv, viewerCtx, {
          email: 'test@test.com',
          role: 'ADMIN',
        })
      ).rejects.toThrow(ForbiddenError)

      await expect(
        invitationsService.create(mockDb, mockEnv, viewerCtx, {
          email: 'test@test.com',
          role: 'ADMIN',
        })
      ).rejects.toThrow('Cannot assign a role higher than your own')
    })

    it('should throw ConflictError when user already in account', async () => {
      const existingUser = createUserFixture({
        id: 'existing-user-1',
        email: 'existing@test.com',
        name: 'Existing User',
      })

      // Mock finding existing membership
      const membershipChain = {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  users: existingUser,
                  userAccounts: {
                    userId: existingUser.id,
                    accountId: ctx.accountId,
                    role: 'VIEWER',
                  },
                },
              ]),
            }),
          }),
        }),
      }

      mockDb.select = vi.fn().mockReturnValue(membershipChain)

      await expect(
        invitationsService.create(mockDb, mockEnv, ctx, {
          email: 'existing@test.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow(ConflictError)

      await expect(
        invitationsService.create(mockDb, mockEnv, ctx, {
          email: 'existing@test.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow('User is already a member of this account')
    })

    it('should link existing user directly if they exist (without sending email)', async () => {
      const existingUser = createUserFixture({
        id: 'existing-user-2',
        email: 'newmember@test.com',
        name: 'New Member',
      })

      // First call: check membership (empty - user not in account)
      const emptyMembershipChain = {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }

      // Second call: check if user exists in system
      const existingUserChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return emptyMembershipChain
        }
        return existingUserChain
      })

      // Mock insert for creating user-account relationship
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })

      const result = await invitationsService.create(mockDb, mockEnv, ctx, {
        email: 'newmember@test.com',
        role: 'EDITOR',
      })

      expect(result.linked).toBe(true)
      expect(result.invited).toBe(false)
      expect(result.user).toEqual({
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
      })
      expect(result.invitation).toBeUndefined()

      // Verify email was NOT sent
      expect(sendInvitationEmail).not.toHaveBeenCalled()

      // Verify insert was called to link user to account
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should create invitation and send email when user does not exist', async () => {
      const testAccount = createAccountFixture({
        id: ctx.accountId,
        name: 'Test Account',
      })

      // Call 1: check membership (empty)
      const emptyMembershipChain = {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }

      // Call 2: check if user exists (empty - user doesn't exist)
      const emptyUserChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      // Call 3: check for existing pending invitation (empty)
      const emptyInvitationChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      // Call 4: get account name
      const accountChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testAccount]),
          }),
        }),
      }

      let selectCallCount = 0
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return emptyMembershipChain
        }
        if (selectCallCount === 2) {
          return emptyUserChain
        }
        if (selectCallCount === 3) {
          return emptyInvitationChain
        }
        return accountChain
      })

      // Mock insert for creating invitation
      const createdInvitation = {
        id: 'inv-new-1',
        email: 'newinvite@test.com',
        role: 'VIEWER',
        expiresAt: '2025-01-07T00:00:00Z',
      }

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdInvitation]),
        }),
      })

      const result = await invitationsService.create(mockDb, mockEnv, ctx, {
        email: 'newinvite@test.com',
        role: 'VIEWER',
      })

      expect(result.linked).toBe(false)
      expect(result.invited).toBe(true)
      expect(result.invitation).toEqual({
        id: createdInvitation.id,
        email: createdInvitation.email,
        role: createdInvitation.role,
        expiresAt: createdInvitation.expiresAt,
      })
      expect(result.user).toBeUndefined()

      // Verify email WAS sent
      expect(sendInvitationEmail).toHaveBeenCalledTimes(1)
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        mockEnv,
        'newinvite@test.com',
        ctx.user.name,
        testAccount.name,
        expect.stringContaining(`${mockEnv.APP_URL}/auth/invite/`)
      )

      // Verify insert was called to create invitation
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })
})
