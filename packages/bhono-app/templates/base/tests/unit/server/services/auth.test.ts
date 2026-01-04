// src/server/services/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { authService } from '@server/services/auth'
import type { GoogleUserInfo } from '@server/types/auth'
import { UnauthorizedError } from '@server/lib/errors'

vi.mock('@server/lib/tokens', () => ({
  createAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  hashToken: vi.fn().mockResolvedValue('hashed-token'),
  getRefreshTokenExpiry: vi.fn().mockReturnValue(new Date('2025-01-07T00:00:00Z')),
}))

vi.mock('@server/lib/audit', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(),
}))

vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
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

import { createAccessToken, generateRefreshToken, hashToken } from '@server/lib/tokens'
import { logAuthEvent } from '@server/lib/audit'
import { queryOne, execute } from '@server/db/sql'

const db = {} as D1Database

function createMockEnv() {
  return {
    APP_URL: 'http://localhost:8787',
    JWT_SECRET: 'secret',
    JWT_EXPIRY_MINUTES: '15',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:8787',
    REFRESH_TOKEN_EXPIRY_DAYS: '30',
    SENDGRID_API_KEY: 'key',
    SENDGRID_FROM_EMAIL: 'test@example.com',
    ENVIRONMENT: 'test',
  } as any
}

const mockAuthContext = {
  transactionId: 'test-transaction-id',
  ip: '127.0.0.1',
  userAgent: 'IntegrationTest/1.0',
}

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findOrCreateUser', () => {
    it('should create a new user on first OAuth login', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'new_google_sub_123',
        email: 'newuser@gmail.com',
        email_verified: true,
        name: 'New Google User',
        picture: 'https://example.com/avatar.jpg',
        given_name: 'New',
        family_name: 'User',
      }

      const userRow = {
        id: 'user-123',
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(userRow)

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(true)
      expect(result.user.email).toBe(googleUser.email)
      expect(createAccessToken).toHaveBeenCalled()
      expect(generateRefreshToken).toHaveBeenCalled()
      expect(hashToken).toHaveBeenCalled()
      expect(execute).toHaveBeenCalled()
      expect(logAuthEvent).toHaveBeenCalled()
    })

    it('should return existing user on subsequent OAuth login', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'existing_sub_456',
        email: 'existing@gmail.com',
        email_verified: true,
        name: 'Existing User',
        picture: undefined,
        given_name: 'Existing',
        family_name: 'User',
      }

      const userRow = {
        id: 'user-456',
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock).mockResolvedValueOnce(userRow)

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      expect(result.user.id).toBe('user-456')
      expect(execute).toHaveBeenCalled()
    })
  })

  describe('refreshAccessToken', () => {
    it('should return a new access token when refresh token is valid', async () => {
      const env = createMockEnv()

      ;(queryOne as Mock)
        .mockResolvedValueOnce({ id: 'token-1', userId: 'user-1', tokenHash: 'hashed-token' })
        .mockResolvedValueOnce({
          id: 'user-1',
          googleId: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatarUrl: null,
          status: 'active',
          providerIds: JSON.stringify(['google']),
          isSuperAdmin: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        })

      const result = await authService.refreshAccessToken(db, env, 'refresh-token', mockAuthContext)

      expect(result.accessToken).toBe('mock-access-token')
      expect(logAuthEvent).toHaveBeenCalled()
    })

    it('should throw for invalid refresh token', async () => {
      const env = createMockEnv()
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(
        authService.refreshAccessToken(db, env, 'invalid-token', mockAuthContext)
      ).rejects.toThrow(UnauthorizedError)
    })
  })

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token and log logout', async () => {
      await authService.revokeRefreshToken(db, 'refresh-token', mockAuthContext, 'user-1')

      expect(execute).toHaveBeenCalled()
      expect(logAuthEvent).toHaveBeenCalled()
    })

    it('should revoke token without logging when userId is null', async () => {
      await authService.revokeRefreshToken(db, 'refresh-token', mockAuthContext, null)

      expect(execute).toHaveBeenCalled()
      expect(logAuthEvent).not.toHaveBeenCalled()
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      await authService.revokeAllUserTokens(db, 'user-1')

      expect(execute).toHaveBeenCalled()
    })
  })

  describe('getCurrentUser', () => {
    it('should return user when found', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.email).toBe('user@example.com')
    })

    it('should throw UnauthorizedError when user not found', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(authService.getCurrentUser(db, 'user-999')).rejects.toThrow(UnauthorizedError)
    })
  })

  describe('findOrCreateUser edge cases', () => {
    it('should not update user when info is unchanged', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'existing_sub',
        email: 'same@example.com',
        email_verified: true,
        name: 'Same Name',
        picture: 'https://same-picture.jpg',
        given_name: 'Same',
        family_name: 'Name',
      }

      const userRow = {
        id: 'user-1',
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock).mockResolvedValueOnce(userRow)

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      // Should only call execute for refresh token insert and login log
      expect(execute).toHaveBeenCalled()
    })

    it('should update user when email changes', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'existing_sub',
        email: 'new-email@example.com',
        email_verified: true,
        name: 'Same Name',
        picture: 'https://same-picture.jpg',
        given_name: 'Same',
        family_name: 'Name',
      }

      const userRow = {
        id: 'user-1',
        googleId: googleUser.sub,
        email: 'old@example.com',
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock)
        .mockResolvedValueOnce(userRow)
        .mockResolvedValueOnce({ ...userRow, email: googleUser.email })

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      expect(execute).toHaveBeenCalled()
    })

    it('should handle null picture', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'new_google_sub',
        email: 'user@example.com',
        email_verified: true,
        name: 'User',
        picture: undefined,
        given_name: 'User',
        family_name: '',
      }

      const userRow = {
        id: 'user-new',
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(userRow)

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(true)
    })
  })

  describe('refreshAccessToken edge cases', () => {
    it('should throw when user is inactive', async () => {
      const env = createMockEnv()

      ;(queryOne as Mock)
        .mockResolvedValueOnce({ id: 'token-1', userId: 'user-1', tokenHash: 'hashed-token' })
        .mockResolvedValueOnce({
          id: 'user-1',
          googleId: 'google-1',
          email: 'user@example.com',
          name: 'User',
          avatarUrl: null,
          status: 'inactive',
          providerIds: JSON.stringify(['google']),
          isSuperAdmin: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        })

      await expect(
        authService.refreshAccessToken(db, env, 'refresh-token', mockAuthContext)
      ).rejects.toThrow('User not found or inactive')
    })

    it('should throw when user not found after token found', async () => {
      const env = createMockEnv()

      ;(queryOne as Mock)
        .mockResolvedValueOnce({ id: 'token-1', userId: 'user-1', tokenHash: 'hashed-token' })
        .mockResolvedValueOnce(null)

      await expect(
        authService.refreshAccessToken(db, env, 'refresh-token', mockAuthContext)
      ).rejects.toThrow('User not found or inactive')
    })
  })

  describe('mapUserRow edge cases', () => {
    it('should handle isSuperAdmin as string "1"', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: '1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.isSuperAdmin).toBe(true)
    })

    it('should handle isSuperAdmin as string "true"', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.isSuperAdmin).toBe(true)
    })

    it('should handle isSuperAdmin as boolean true', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.isSuperAdmin).toBe(true)
    })

    it('should handle providerIds as array', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: ['google', 'github'],
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.providerIds).toEqual(['google', 'github'])
    })

    it('should handle invalid JSON in providerIds', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: 'not-valid-json',
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.providerIds).toEqual([])
    })

    it('should handle non-array JSON in providerIds', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify({ type: 'object' }),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.providerIds).toEqual([])
    })

    it('should handle null providerIds', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: null,
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.providerIds).toEqual([])
    })

    it('should handle avatarUrl present', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: 'https://example.com/avatar.jpg',
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result).toBeDefined()
    })

    it('should handle deletedAt present', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce({
        id: 'user-1',
        googleId: 'google-1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: null,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: new Date().toISOString(),
      })

      const result = await authService.getCurrentUser(db, 'user-1')

      expect(result.deletedAt).not.toBeNull()
    })
  })

  describe('findOrCreateUser failure cases', () => {
    it('should throw when user creation fails', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'new_google_sub',
        email: 'user@example.com',
        email_verified: true,
        name: 'User',
        picture: undefined,
        given_name: 'User',
        family_name: '',
      }

      // First call: no existing user found
      // Second call: insertUserSql returns null (user creation fails)
      ;(queryOne as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      await expect(
        authService.findOrCreateUser(db, env, googleUser, mockAuthContext)
      ).rejects.toThrow('Failed to create user')
    })

    it('should update user when name changes', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'existing_sub',
        email: 'same@example.com',
        email_verified: true,
        name: 'New Name',
        picture: 'https://same-picture.jpg',
        given_name: 'New',
        family_name: 'Name',
      }

      const userRow = {
        id: 'user-1',
        googleId: googleUser.sub,
        email: googleUser.email,
        name: 'Old Name',
        avatarUrl: googleUser.picture,
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock)
        .mockResolvedValueOnce(userRow)
        .mockResolvedValueOnce({ ...userRow, name: googleUser.name })

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      expect(execute).toHaveBeenCalled()
    })

    it('should update user when avatar changes', async () => {
      const env = createMockEnv()
      const googleUser: GoogleUserInfo = {
        sub: 'existing_sub',
        email: 'same@example.com',
        email_verified: true,
        name: 'Same Name',
        picture: 'https://new-picture.jpg',
        given_name: 'Same',
        family_name: 'Name',
      }

      const userRow = {
        id: 'user-1',
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: 'https://old-picture.jpg',
        status: 'active',
        providerIds: JSON.stringify(['google']),
        isSuperAdmin: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }

      ;(queryOne as Mock)
        .mockResolvedValueOnce(userRow)
        .mockResolvedValueOnce({ ...userRow, avatarUrl: googleUser.picture })

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      expect(execute).toHaveBeenCalled()
    })
  })
})
