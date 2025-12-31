// src/server/services/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '../auth'
import type { GoogleUserInfo } from '../../types/auth'
import type { AuthEventContext } from '../../lib/audit'

// Mock dependencies
vi.mock('../../lib/tokens', () => ({
  createAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  hashToken: vi.fn().mockResolvedValue('hashed-token'),
  getRefreshTokenExpiry: vi.fn().mockReturnValue(new Date('2025-01-07T00:00:00Z')),
}))

vi.mock('../../lib/audit', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}))

import { createAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from '../../lib/tokens'
import { logAuthEvent } from '../../lib/audit'

/**
 * Creates a mock Drizzle database instance with chainable methods for auth tests
 */
function createMockDb(existingUser: any = null) {
  let selectCallCount = 0
  let insertCallCount = 0

  const createSelectChain = (result: any[]) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  })

  // For new user flow, inserts are in order: users, accounts, userAccounts, refreshTokens
  const newUserRecord = {
    id: 'new-user-id',
    googleId: 'google-123',
    email: 'testuser@gmail.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    status: 'active',
    providerIds: ['google'],
    isSuperAdmin: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }

  const newAccountRecord = {
    id: 'new-account-id',
    name: "Test User's Account",
  }

  const db = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++
      // First select is for finding user by googleId
      if (selectCallCount === 1) {
        return createSelectChain(existingUser ? [existingUser] : [])
      }
      // Subsequent selects return empty
      return createSelectChain([])
    }),
    insert: vi.fn().mockImplementation(() => {
      insertCallCount++
      const currentInsert = insertCallCount

      return {
        values: vi.fn().mockImplementation((values: any) => {
          return {
            returning: vi.fn().mockImplementation(() => {
              // For new user flow: 1=users, 2=accounts, 3=userAccounts, 4=refreshTokens
              if (currentInsert === 1) {
                // Users insert - merge values with defaults
                return Promise.resolve([{
                  ...newUserRecord,
                  googleId: values.googleId || newUserRecord.googleId,
                  email: values.email || newUserRecord.email,
                  name: values.name || newUserRecord.name,
                  avatarUrl: values.avatarUrl !== undefined ? values.avatarUrl : newUserRecord.avatarUrl,
                  status: values.status || newUserRecord.status,
                }])
              }
              if (currentInsert === 2) {
                // Accounts insert
                return Promise.resolve([{
                  ...newAccountRecord,
                  name: values.name || newAccountRecord.name,
                }])
              }
              // For userAccounts and refreshTokens, just return empty/values
              return Promise.resolve([values])
            }),
          }
        }),
      }
    }),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    })),
    // Expose internals for assertions
    _selectCallCount: () => selectCallCount,
    _insertCallCount: () => insertCallCount,
  }

  return db as any
}

/**
 * Creates a mock environment
 */
function createMockEnv() {
  return {
    JWT_SECRET: 'test-jwt-secret',
    JWT_EXPIRY_MINUTES: 15,
    REFRESH_TOKEN_EXPIRY_DAYS: 30,
  }
}

/**
 * Creates an auth event context for testing
 */
function createMockAuthEventContext(overrides: Partial<AuthEventContext> = {}): AuthEventContext {
  return {
    transactionId: 'tx-123',
    ip: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  }
}

/**
 * Creates a mock Google user info
 */
function createGoogleUserInfo(overrides: Partial<GoogleUserInfo> = {}): GoogleUserInfo {
  return {
    sub: 'google-123',
    email: 'testuser@gmail.com',
    email_verified: true,
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    given_name: 'Test',
    family_name: 'User',
    ...overrides,
  }
}

/**
 * Creates a mock existing user record (as returned from DB)
 */
function createExistingUserRecord(overrides: any = {}) {
  return {
    id: 'existing-user-id',
    googleId: 'google-123',
    email: 'testuser@gmail.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    status: 'active',
    providerIds: ['google'],
    isSuperAdmin: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('authService', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let mockCtx: AuthEventContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
    mockCtx = createMockAuthEventContext()
  })

  describe('findOrCreateUser', () => {
    it('should create new user when not found (isNewUser: true)', async () => {
      // Arrange
      const mockDb = createMockDb(null) // No existing user
      const googleUser = createGoogleUserInfo()

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert
      expect(result.isNewUser).toBe(true)
      expect(result.user.email).toBe(googleUser.email)
      expect(result.user.name).toBe(googleUser.name)
      expect(result.user.id).toBe('new-user-id')

      // Verify user was inserted
      expect(mockDb.insert).toHaveBeenCalled()

      // Verify signup event was logged (for new users)
      expect(logAuthEvent).toHaveBeenCalledWith(
        mockDb,
        mockCtx,
        'SIGNUP',
        'new-user-id',
        expect.objectContaining({
          email: googleUser.email,
          provider: 'google',
          accountId: 'new-account-id',
        })
      )

      // Verify login event was logged
      expect(logAuthEvent).toHaveBeenCalledWith(
        mockDb,
        mockCtx,
        'LOGIN',
        'new-user-id',
        expect.objectContaining({
          email: googleUser.email,
          provider: 'google',
          isNewUser: true,
        })
      )
    })

    it('should return existing user when found by googleId (isNewUser: false)', async () => {
      // Arrange
      const existingUser = createExistingUserRecord()
      const mockDb = createMockDb(existingUser)
      const googleUser = createGoogleUserInfo()

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert
      expect(result.isNewUser).toBe(false)
      expect(result.user.id).toBe('existing-user-id')
      expect(result.user.email).toBe(existingUser.email)
      expect(result.user.name).toBe(existingUser.name)

      // Verify no SIGNUP event was logged (only LOGIN)
      expect(logAuthEvent).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'SIGNUP',
        expect.anything(),
        expect.anything()
      )

      // Verify login event was logged with isNewUser: false
      expect(logAuthEvent).toHaveBeenCalledWith(
        mockDb,
        mockCtx,
        'LOGIN',
        'existing-user-id',
        expect.objectContaining({
          email: existingUser.email,
          provider: 'google',
          isNewUser: false,
        })
      )
    })

    it('should update user profile when info changed (email, name, avatarUrl)', async () => {
      // Arrange - existing user has different info than google provides
      const existingUser = createExistingUserRecord({
        email: 'old-email@gmail.com',
        name: 'Old Name',
        avatarUrl: 'https://example.com/old-avatar.jpg',
      })

      const updatedUser = {
        ...existingUser,
        email: 'new-email@gmail.com',
        name: 'New Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      }

      const mockDb = createMockDb(existingUser)

      // Override update to return updated user
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedUser]),
          }),
        }),
      })

      const googleUser = createGoogleUserInfo({
        email: 'new-email@gmail.com',
        name: 'New Name',
        picture: 'https://example.com/new-avatar.jpg',
      })

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert
      expect(result.isNewUser).toBe(false)
      expect(mockDb.update).toHaveBeenCalled()
      expect(result.user.email).toBe('new-email@gmail.com')
      expect(result.user.name).toBe('New Name')
    })

    it('should not update user when profile info is unchanged', async () => {
      // Arrange - existing user has same info as google provides
      const existingUser = createExistingUserRecord()
      const mockDb = createMockDb(existingUser)

      const googleUser = createGoogleUserInfo({
        sub: existingUser.googleId,
        email: existingUser.email,
        name: existingUser.name,
        picture: existingUser.avatarUrl,
      })

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert
      expect(result.isNewUser).toBe(false)
      expect(mockDb.update).not.toHaveBeenCalled()
    })

    it('should generate access and refresh tokens', async () => {
      // Arrange
      const existingUser = createExistingUserRecord()
      const mockDb = createMockDb(existingUser)
      const googleUser = createGoogleUserInfo()

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert
      expect(result.tokens.accessToken).toBe('mock-access-token')
      expect(result.refreshToken).toBe('mock-refresh-token')
      expect(result.tokens.expiresIn).toBe(60 * 15) // 15 minutes in seconds

      // Verify token functions were called
      expect(createAccessToken).toHaveBeenCalledWith(
        mockEnv,
        existingUser.id,
        existingUser.email
      )
      expect(generateRefreshToken).toHaveBeenCalled()
      expect(hashToken).toHaveBeenCalledWith('mock-refresh-token')
      expect(getRefreshTokenExpiry).toHaveBeenCalledWith(mockEnv)
    })

    it('should store refresh token in database', async () => {
      // Arrange
      const existingUser = createExistingUserRecord()
      const mockDb = createMockDb(existingUser)
      const googleUser = createGoogleUserInfo()

      // Act
      await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert - verify refresh token insert was called
      expect(mockDb.insert).toHaveBeenCalled()
      // The last insert should be for refreshTokens
      const insertCalls = mockDb.insert.mock.calls
      expect(insertCalls.length).toBeGreaterThan(0)
    })

    it('should create personal account for new user', async () => {
      // Arrange
      const mockDb = createMockDb(null) // No existing user
      const googleUser = createGoogleUserInfo({ name: 'John Doe' })

      // Act
      await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert - verify account was created with user's name
      // Insert should be called for: users, accounts, userAccounts, refreshTokens
      expect(mockDb.insert).toHaveBeenCalledTimes(4)
    })

    it('should link new user to account with EDITOR role', async () => {
      // Arrange
      const mockDb = createMockDb(null) // No existing user
      const googleUser = createGoogleUserInfo()

      // Track userAccounts insert
      let userAccountsValues: any = null
      const originalInsert = mockDb.insert
      mockDb.insert = vi.fn().mockImplementation((table: any) => {
        const result = originalInsert(table)
        if (table?.name === 'userAccounts' || table?.toString()?.includes('user_accounts')) {
          return {
            values: vi.fn().mockImplementation((values: any) => {
              userAccountsValues = values
              return { returning: vi.fn().mockResolvedValue([values]) }
            }),
          }
        }
        return result
      })

      // Act
      await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert - verify at least 4 inserts happened (user, account, userAccount, refreshToken)
      expect(mockDb.insert).toHaveBeenCalledTimes(4)
    })

    it('should handle user with no avatar (picture undefined)', async () => {
      // Arrange
      const mockDb = createMockDb(null)
      const googleUser = createGoogleUserInfo({ picture: undefined })

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert
      expect(result.user).toBeDefined()
      expect(result.isNewUser).toBe(true)
    })

    it('should return correct user structure', async () => {
      // Arrange
      const existingUser = createExistingUserRecord()
      const mockDb = createMockDb(existingUser)
      const googleUser = createGoogleUserInfo()

      // Act
      const result = await authService.findOrCreateUser(mockDb, mockEnv, googleUser, mockCtx)

      // Assert - verify user object has expected shape
      expect(result.user).toEqual(expect.objectContaining({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
        status: expect.any(String),
        providerIds: expect.any(Array),
        isSuperAdmin: expect.any(Boolean),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }))
    })
  })
})
