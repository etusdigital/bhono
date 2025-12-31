// src/server/services/__tests__/invitations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invitationsService } from '../invitations'
import { ForbiddenError, ConflictError, NotFoundError } from '../../lib/errors'
import type { AuthEventContext } from '../../lib/audit'
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
import { logAuthEvent } from '../../lib/audit'

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
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
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

    it('should throw ConflictError when pending invitation already exists', async () => {
      // Helper to create mocked select chains
      const createSelectMock = () => {
        let selectCallCount = 0

        // Call 1: check membership (empty - user not in account)
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

        // Call 3: check for existing pending invitation (returns existing invitation)
        const existingInvitationChain = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'existing-inv-1',
                  accountId: ctx.accountId,
                  email: 'pending@test.com',
                  role: 'VIEWER',
                  expiresAt: '2025-12-31T00:00:00Z',
                  acceptedAt: null,
                },
              ]),
            }),
          }),
        }

        return vi.fn().mockImplementation(() => {
          selectCallCount++
          if (selectCallCount === 1) {
            return emptyMembershipChain
          }
          if (selectCallCount === 2) {
            return emptyUserChain
          }
          return existingInvitationChain
        })
      }

      mockDb.select = createSelectMock()
      await expect(
        invitationsService.create(mockDb, mockEnv, ctx, {
          email: 'pending@test.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow(ConflictError)

      // Reset mock for second assertion
      mockDb.select = createSelectMock()
      await expect(
        invitationsService.create(mockDb, mockEnv, ctx, {
          email: 'pending@test.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow('Pending invitation already exists for this email')
    })
  })

  describe('list', () => {
    it('should return pending invitations for account', async () => {
      const mockInvitations = [
        {
          id: 'inv-1',
          email: 'invited1@test.com',
          role: 'EDITOR',
          expiresAt: '2025-12-31T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          invitedById: 'user-inviter-1',
          inviterName: 'John Inviter',
        },
        {
          id: 'inv-2',
          email: 'invited2@test.com',
          role: 'VIEWER',
          expiresAt: '2025-12-31T00:00:00Z',
          createdAt: '2025-01-02T00:00:00Z',
          invitedById: 'user-inviter-2',
          inviterName: 'Jane Inviter',
        },
      ]

      // Mock the select chain with innerJoin and orderBy
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockInvitations),
            }),
          }),
        }),
      })

      const result = await invitationsService.list(mockDb, ctx)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'inv-1',
        email: 'invited1@test.com',
        role: 'EDITOR',
        invitedBy: { id: 'user-inviter-1', name: 'John Inviter' },
        expiresAt: '2025-12-31T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
      })
      expect(result[1]).toEqual({
        id: 'inv-2',
        email: 'invited2@test.com',
        role: 'VIEWER',
        invitedBy: { id: 'user-inviter-2', name: 'Jane Inviter' },
        expiresAt: '2025-12-31T00:00:00Z',
        createdAt: '2025-01-02T00:00:00Z',
      })
    })

    it('should return empty array when no pending invitations', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })

      const result = await invitationsService.list(mockDb, ctx)

      expect(result).toEqual([])
    })
  })

  describe('revoke', () => {
    it('should throw NotFoundError when invitation not found', async () => {
      // Mock select returning empty array (invitation not found)
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        invitationsService.revoke(mockDb, ctx, 'non-existent-inv')
      ).rejects.toThrow(NotFoundError)

      await expect(
        invitationsService.revoke(mockDb, ctx, 'non-existent-inv')
      ).rejects.toThrow('Invitation not found')
    })

    it('should delete invitation successfully', async () => {
      const existingInvitation = {
        id: 'inv-to-delete',
        accountId: ctx.accountId,
        email: 'delete@test.com',
        role: 'VIEWER',
        acceptedAt: null,
      }

      // Mock select returning the invitation
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingInvitation]),
          }),
        }),
      })

      // Mock delete
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      })

      await invitationsService.revoke(mockDb, ctx, 'inv-to-delete')

      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('getByToken', () => {
    it('should return null when invitation not found', async () => {
      // Mock select returning empty array
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })

      const result = await invitationsService.getByToken(mockDb, 'invalid-token')

      expect(result).toBeNull()
    })

    it('should return null when invitation already accepted', async () => {
      const acceptedInvitation = {
        id: 'inv-accepted',
        accountId: 'account-123',
        email: 'accepted@test.com',
        role: 'VIEWER',
        expiresAt: '2025-12-31T00:00:00Z',
        acceptedAt: '2025-01-01T00:00:00Z', // Already accepted
        accountName: 'Test Account',
      }

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([acceptedInvitation]),
            }),
          }),
        }),
      })

      const result = await invitationsService.getByToken(mockDb, 'some-token')

      expect(result).toBeNull()
    })

    it('should return null when invitation expired', async () => {
      const expiredInvitation = {
        id: 'inv-expired',
        accountId: 'account-123',
        email: 'expired@test.com',
        role: 'VIEWER',
        expiresAt: '2020-01-01T00:00:00Z', // Expired in the past
        acceptedAt: null,
        accountName: 'Test Account',
      }

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([expiredInvitation]),
            }),
          }),
        }),
      })

      const result = await invitationsService.getByToken(mockDb, 'expired-token')

      expect(result).toBeNull()
    })

    it('should return invitation when token valid', async () => {
      const validInvitation = {
        id: 'inv-valid',
        accountId: 'account-123',
        email: 'valid@test.com',
        role: 'EDITOR',
        expiresAt: '2099-12-31T00:00:00Z', // Far in the future
        acceptedAt: null,
        accountName: 'Valid Account',
      }

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([validInvitation]),
            }),
          }),
        }),
      })

      const result = await invitationsService.getByToken(mockDb, 'valid-token')

      expect(result).toEqual({
        id: 'inv-valid',
        accountId: 'account-123',
        email: 'valid@test.com',
        role: 'EDITOR',
        accountName: 'Valid Account',
      })
    })
  })

  describe('accept', () => {
    const authCtx: AuthEventContext = {
      transactionId: 'tx-accept-123',
      ip: '192.168.1.1',
      userAgent: 'TestAgent/2.0',
    }

    it('should throw NotFoundError when invitation not found', async () => {
      // Mock select returning empty array (invitation not found)
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        invitationsService.accept(mockDb, 'non-existent-inv', 'user-123', authCtx)
      ).rejects.toThrow(NotFoundError)

      await expect(
        invitationsService.accept(mockDb, 'non-existent-inv', 'user-123', authCtx)
      ).rejects.toThrow('Invitation not found')
    })

    it('should add user to account and mark invitation as accepted', async () => {
      const invitation = {
        id: 'inv-to-accept',
        accountId: 'account-456',
        email: 'newuser@test.com',
        role: 'EDITOR',
        token: 'accept-token',
        acceptedAt: null,
      }

      // Mock select returning the invitation
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([invitation]),
          }),
        }),
      })

      // Mock insert for userAccounts
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })

      // Mock update for marking accepted
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      await invitationsService.accept(mockDb, 'inv-to-accept', 'new-user-123', authCtx)

      // Verify insert was called to create user-account relationship
      expect(mockDb.insert).toHaveBeenCalled()

      // Verify update was called to mark invitation as accepted
      expect(mockDb.update).toHaveBeenCalled()

      // Verify logAuthEvent was called
      expect(logAuthEvent).toHaveBeenCalledWith(
        mockDb,
        authCtx,
        'LOGIN',
        'new-user-123',
        {
          invitationAccepted: true,
          accountId: 'account-456',
          role: 'EDITOR',
        }
      )
    })
  })
})
