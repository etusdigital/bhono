// src/server/services/__tests__/invitations.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { invitationsService } from '@server/services/invitations'
import type { ServiceContext } from '@server/types'
import { createUserFixture, createAccountFixture } from '@tests/fixtures/server'
import { ConflictError, NotFoundError } from '@server/lib/errors'

vi.mock('@server/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
}))

vi.mock('@server/lib/audit', () => ({
  logAuthEvent: vi.fn(),
}))

vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  toStringValue: (value: unknown) => {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return ''
  },
  toNullableString: (value: unknown) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return null
  },
}))

import { sendInvitationEmail } from '@server/lib/email'
import { logAuthEvent } from '@server/lib/audit'
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

function createMockEnv() {
  return {
    APP_URL: 'http://localhost:8787',
    SENDGRID_API_KEY: 'test',
    SENDGRID_FROM_EMAIL: 'test@example.com',
  } as any
}

describe('invitationsService', () => {
  let ctx: ServiceContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createMockContext()
  })

  describe('create', () => {
    it('should throw ForbiddenError when user has no role', async () => {
      const env = createMockEnv()
      const ctxWithoutRole = createMockContext({ userRole: undefined })

      await expect(
        invitationsService.create(db, env, ctxWithoutRole, {
          email: 'invite@example.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow('User must have a role in this account to invite others')
    })

    it('should throw ForbiddenError when assigning higher role than own', async () => {
      const env = createMockEnv()
      const ctxAsViewer = createMockContext({ userRole: 'VIEWER' })

      await expect(
        invitationsService.create(db, env, ctxAsViewer, {
          email: 'invite@example.com',
          role: 'ADMIN',
        })
      ).rejects.toThrow('Cannot assign a role higher than your own')
    })

    it('should throw ConflictError when user is already a member', async () => {
      const env = createMockEnv()

      ;(queryOne as Mock).mockResolvedValueOnce({ ok: 1 })

      await expect(
        invitationsService.create(db, env, ctx, {
          email: 'member@example.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow('User is already a member of this account')
    })

    it('should throw Error when account not found', async () => {
      const env = createMockEnv()

      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      await expect(
        invitationsService.create(db, env, ctx, {
          email: 'invite@example.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow('Account not found')
    })

    it('should link existing user instead of creating invitation', async () => {
      const env = createMockEnv()
      const existingUser = createUserFixture({ id: 'user-1', email: 'user@example.com' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: existingUser.id, email: existingUser.email, name: existingUser.name })

      const result = await invitationsService.create(db, env, ctx, {
        email: existingUser.email,
        role: 'VIEWER',
      })

      expect(result.linked).toBe(true)
      expect(execute).toHaveBeenCalled()
      expect(sendInvitationEmail).not.toHaveBeenCalled()
    })

    it('should create invitation when user not found', async () => {
      const env = createMockEnv()
      const account = createAccountFixture({ id: 'account-123', name: 'Account' })

      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ name: account.name })

      const result = await invitationsService.create(db, env, ctx, {
        email: 'invite@example.com',
        role: 'VIEWER',
      })

      expect(result.invited).toBe(true)
      expect(sendInvitationEmail).toHaveBeenCalled()
    })

    it('should reject when pending invitation exists', async () => {
      const env = createMockEnv()

      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'inv-1' })

      await expect(
        invitationsService.create(db, env, ctx, {
          email: 'invite@example.com',
          role: 'VIEWER',
        })
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('list', () => {
    it('should list invitations', async () => {
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'inv-1',
          email: 'invite@example.com',
          role: 'VIEWER',
          invitedById: 'user-1',
          inviterName: 'Inviter',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ])

      const result = await invitationsService.list(db, ctx)

      expect(result).toHaveLength(1)
    })
  })

  describe('revoke', () => {
    it('should revoke existing invitation', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ id: 'inv-1' })

      await invitationsService.revoke(db, ctx, 'inv-1')

      expect(execute).toHaveBeenCalled()
    })

    it('should throw if invitation not found', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(invitationsService.revoke(db, ctx, 'inv-1')).rejects.toThrow(NotFoundError)
    })
  })

  describe('accept', () => {
    it('should accept invitation and log auth event', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ id: 'inv-1', accountId: 'account-123', role: 'VIEWER' })

      await invitationsService.accept(db, 'inv-1', 'user-1', {
        transactionId: 'tx',
      })

      expect(execute).toHaveBeenCalled()
      expect(logAuthEvent).toHaveBeenCalled()
    })

    it('should throw NotFoundError when invitation not found', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(
        invitationsService.accept(db, 'inv-999', 'user-1', { transactionId: 'tx' })
      ).rejects.toThrow(NotFoundError)
    })

    it('should handle snake_case column names', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({ id: 'inv-1', account_id: 'account-456', role: 'EDITOR' })

      await invitationsService.accept(db, 'inv-1', 'user-1', { transactionId: 'tx' })

      expect(execute).toHaveBeenCalled()
    })
  })

  describe('getByToken', () => {
    it('should return null when token not found', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      const result = await invitationsService.getByToken(db, 'invalid-token')

      expect(result).toBeNull()
    })

    it('should return null when invitation already accepted', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'inv-1',
        accountId: 'account-123',
        email: 'test@example.com',
        role: 'VIEWER',
        acceptedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        accountName: 'Test Account',
      })

      const result = await invitationsService.getByToken(db, 'accepted-token')

      expect(result).toBeNull()
    })

    it('should return null when invitation expired', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'inv-1',
        accountId: 'account-123',
        email: 'test@example.com',
        role: 'VIEWER',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        accountName: 'Test Account',
      })

      const result = await invitationsService.getByToken(db, 'expired-token')

      expect(result).toBeNull()
    })

    it('should return invitation when valid', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'inv-1',
        accountId: 'account-123',
        email: 'test@example.com',
        role: 'VIEWER',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        accountName: 'Test Account',
      })

      const result = await invitationsService.getByToken(db, 'valid-token')

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
    })

    it('should handle snake_case column names from DB', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'inv-1',
        account_id: 'account-123',
        email: 'test@example.com',
        role: 'VIEWER',
        accepted_at: null,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        account_name: 'Test Account',
      })

      const result = await invitationsService.getByToken(db, 'valid-token')

      expect(result).not.toBeNull()
      expect(result?.accountId).toBe('account-123')
    })
  })

  describe('list with snake_case mapping', () => {
    it('should handle snake_case column names', async () => {
      ;(queryAll as Mock).mockResolvedValueOnce([
        {
          id: 'inv-1',
          email: 'invite@example.com',
          role: 'VIEWER',
          invited_by_id: 'user-1',
          inviter_name: 'Inviter',
          expires_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ])

      const result = await invitationsService.list(db, ctx)

      expect(result).toHaveLength(1)
      expect(result[0].invitedBy.id).toBe('user-1')
    })
  })
})
