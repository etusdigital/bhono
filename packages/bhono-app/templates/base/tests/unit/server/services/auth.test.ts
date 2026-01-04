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
        picture: null,
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
      const env = createMockEnv()

      await authService.revokeRefreshToken(db, 'refresh-token', mockAuthContext, 'user-1')

      expect(execute).toHaveBeenCalled()
      expect(logAuthEvent).toHaveBeenCalled()
    })
  })
})
