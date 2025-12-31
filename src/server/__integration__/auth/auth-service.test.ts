/**
 * Auth Service Integration Tests
 *
 * Tests the auth service functions directly:
 * - findOrCreateUser
 * - refreshAccessToken
 * - revokeRefreshToken
 * - revokeAllUserTokens
 * - getCurrentUser
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import { createUser } from '../fixtures'
import { authService } from '../../services/auth'
import { generateRefreshToken, hashToken } from '../../lib/tokens'
import type { GoogleUserInfo, AuthEventContext } from '../../types/auth'
import * as schema from '../../db/schema'

/**
 * Creates a database wrapper
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  }) as any
}

describe('Auth Service Integration', () => {
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
  })

  const mockAuthContext: AuthEventContext = {
    transactionId: 'test-transaction-id',
    ip: '127.0.0.1',
    userAgent: 'IntegrationTest/1.0',
  }

  describe('findOrCreateUser', () => {
    it('should create a new user on first OAuth login', async () => {
      const db = createTestDb()

      const googleUser: GoogleUserInfo = {
        sub: 'new_google_sub_123',
        email: 'newuser@gmail.com',
        email_verified: true,
        name: 'New Google User',
        picture: 'https://example.com/avatar.jpg',
        given_name: 'New',
        family_name: 'User',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(true)
      expect(result.user.email).toBe('newuser@gmail.com')
      expect(result.user.name).toBe('New Google User')
      expect(result.tokens.accessToken).toBeTruthy()
      expect(result.refreshToken).toBeTruthy()
    })

    it('should return existing user on subsequent OAuth login', async () => {
      const db = createTestDb()

      // Create existing user first
      const existingUser = await createUser({
        googleId: 'existing_sub_456',
        email: 'existing@gmail.com',
        name: 'Existing User',
      })

      const googleUser: GoogleUserInfo = {
        sub: 'existing_sub_456',
        email: 'existing@gmail.com',
        email_verified: true,
        name: 'Existing User',
        picture: null,
        given_name: 'Existing',
        family_name: 'User',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      expect(result.user.id).toBe(existingUser.id)
      expect(result.user.email).toBe('existing@gmail.com')
    })

    it('should update user profile when Google info changes', async () => {
      const db = createTestDb()

      // Create existing user with old info
      const existingUser = await createUser({
        googleId: 'update_sub_789',
        email: 'old@gmail.com',
        name: 'Old Name',
        avatarUrl: 'https://old-avatar.jpg',
      })

      const googleUser: GoogleUserInfo = {
        sub: 'update_sub_789',
        email: 'new@gmail.com', // Changed
        email_verified: true,
        name: 'New Name', // Changed
        picture: 'https://new-avatar.jpg', // Changed
        given_name: 'New',
        family_name: 'Name',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      expect(result.isNewUser).toBe(false)
      expect(result.user.id).toBe(existingUser.id)
      expect(result.user.email).toBe('new@gmail.com')
      expect(result.user.name).toBe('New Name')
    })

    it('should create personal account for new users', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const googleUser: GoogleUserInfo = {
        sub: 'account_test_sub',
        email: 'accounttest@gmail.com',
        email_verified: true,
        name: 'Account Test User',
        picture: null,
        given_name: 'Account',
        family_name: 'Test',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      // Verify account was created
      const accounts = sqlite.prepare(`
        SELECT a.* FROM accounts a
        INNER JOIN user_accounts ua ON a.id = ua.account_id
        WHERE ua.user_id = ?
      `).all(result.user.id) as any[]

      expect(accounts.length).toBe(1)
      expect(accounts[0].name).toContain("Account Test User's Account")
    })

    it('should create refresh token for new user', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const googleUser: GoogleUserInfo = {
        sub: 'refresh_test_sub',
        email: 'refreshtest@gmail.com',
        email_verified: true,
        name: 'Refresh Test User',
        picture: null,
        given_name: 'Refresh',
        family_name: 'Test',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      // Verify refresh token was stored
      const tokens = sqlite.prepare(`
        SELECT * FROM refresh_tokens WHERE user_id = ?
      `).all(result.user.id) as any[]

      expect(tokens.length).toBe(1)
      expect(tokens[0].revoked_at).toBeNull()
    })

    it('should log SIGNUP event for new users', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const googleUser: GoogleUserInfo = {
        sub: 'signup_audit_sub',
        email: 'signupaudit@gmail.com',
        email_verified: true,
        name: 'Signup Audit User',
        picture: null,
        given_name: 'Signup',
        family_name: 'Audit',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      const auditLogs = sqlite.prepare(`
        SELECT * FROM audit_logs WHERE user_id = ? AND action = 'SIGNUP'
      `).all(result.user.id) as any[]

      expect(auditLogs.length).toBe(1)
      expect(auditLogs[0].entity).toBe('Auth')
    })

    it('should log LOGIN event for all users', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const googleUser: GoogleUserInfo = {
        sub: 'login_audit_sub',
        email: 'loginaudit@gmail.com',
        email_verified: true,
        name: 'Login Audit User',
        picture: null,
        given_name: 'Login',
        family_name: 'Audit',
      }

      const result = await authService.findOrCreateUser(db, env, googleUser, mockAuthContext)

      const auditLogs = sqlite.prepare(`
        SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LOGIN'
      `).all(result.user.id) as any[]

      expect(auditLogs.length).toBe(1)
    })
  })

  describe('revokeRefreshToken', () => {
    it('should revoke a refresh token', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const user = await createUser({ email: 'revoke@example.com', name: 'Revoke User' })

      // Create a refresh token
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      sqlite.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        tokenId,
        user.id,
        tokenHash,
        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        Math.floor(Date.now() / 1000)
      )

      await authService.revokeRefreshToken(db, refreshToken, mockAuthContext, user.id)

      // Verify token was revoked
      const token = sqlite.prepare(`
        SELECT * FROM refresh_tokens WHERE id = ?
      `).get(tokenId) as any

      expect(token.revoked_at).not.toBeNull()
    })

    it('should log LOGOUT event when userId is provided', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const user = await createUser({ email: 'revokeaudit@example.com', name: 'Revoke Audit User' })

      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()

      sqlite.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        tokenId,
        user.id,
        tokenHash,
        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        Math.floor(Date.now() / 1000)
      )

      await authService.revokeRefreshToken(db, refreshToken, mockAuthContext, user.id)

      const auditLogs = sqlite.prepare(`
        SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LOGOUT'
      `).all(user.id) as any[]

      expect(auditLogs.length).toBe(1)
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should revoke all active tokens for a user', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const user = await createUser({ email: 'revokeall@example.com', name: 'Revoke All User' })

      // Create multiple refresh tokens
      for (let i = 0; i < 3; i++) {
        const refreshToken = generateRefreshToken()
        const tokenHash = await hashToken(refreshToken)
        const tokenId = crypto.randomUUID()

        sqlite.prepare(`
          INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          tokenId,
          user.id,
          tokenHash,
          Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          Math.floor(Date.now() / 1000)
        )
      }

      await authService.revokeAllUserTokens(db, user.id)

      // Verify all tokens were revoked
      const activeTokens = sqlite.prepare(`
        SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL
      `).all(user.id) as any[]

      expect(activeTokens.length).toBe(0)
    })

    it('should not affect already revoked tokens', async () => {
      const db = createTestDb()
      const sqlite = getSqlite()

      const user = await createUser({ email: 'alreadyrevoked@example.com', name: 'Already Revoked User' })

      // Create a revoked token
      const tokenId = crypto.randomUUID()
      const refreshToken = generateRefreshToken()
      const tokenHash = await hashToken(refreshToken)
      const revokedAt = Math.floor(Date.now() / 1000) - 3600 // Revoked 1 hour ago

      sqlite.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        tokenId,
        user.id,
        tokenHash,
        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        Math.floor(Date.now() / 1000),
        revokedAt
      )

      await authService.revokeAllUserTokens(db, user.id)

      // Verify token still has original revoked_at timestamp
      const token = sqlite.prepare(`
        SELECT * FROM refresh_tokens WHERE id = ?
      `).get(tokenId) as any

      expect(token.revoked_at).toBe(revokedAt)
    })
  })

  describe('getCurrentUser', () => {
    it('should return user by ID', async () => {
      const db = createTestDb()

      const user = await createUser({
        email: 'getuser@example.com',
        name: 'Get User',
        isSuperAdmin: false,
      })

      const result = await authService.getCurrentUser(db, user.id)

      expect(result.id).toBe(user.id)
      expect(result.email).toBe('getuser@example.com')
      expect(result.name).toBe('Get User')
      expect(result.isSuperAdmin).toBe(false)
    })

    it('should return super admin flag correctly', async () => {
      const db = createTestDb()

      const user = await createUser({
        email: 'getsuperadmin@example.com',
        name: 'Get Super Admin',
        isSuperAdmin: true,
      })

      const result = await authService.getCurrentUser(db, user.id)

      expect(result.isSuperAdmin).toBe(true)
    })

    it('should throw error for non-existent user', async () => {
      const db = createTestDb()

      await expect(
        authService.getCurrentUser(db, 'non-existent-user-id')
      ).rejects.toThrow('User not found')
    })

    it('should throw error for deleted user', async () => {
      const db = createTestDb()

      const user = await createUser({
        email: 'deletedgetuser@example.com',
        name: 'Deleted Get User',
        deletedAt: new Date().toISOString(),
      })

      await expect(
        authService.getCurrentUser(db, user.id)
      ).rejects.toThrow('User not found')
    })
  })
})
