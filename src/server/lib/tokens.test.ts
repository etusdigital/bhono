import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
  setCookieOptions,
  setOAuthStateCookieOptions,
} from './tokens'

const mockEnv = {
  JWT_SECRET: 'test-secret-key',
  JWT_EXPIRY_MINUTES: '15',
  REFRESH_TOKEN_EXPIRY_DAYS: '30',
} as any

describe('tokens', () => {
  describe('createAccessToken', () => {
    it('should create valid JWT token', async () => {
      const token = await createAccessToken(mockEnv, 'user-123', 'test@example.com')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.')
      expect(parts).toHaveLength(3)
    })

    it('should include userId and email in payload', async () => {
      const userId = 'user-123'
      const email = 'test@example.com'
      const token = await createAccessToken(mockEnv, userId, email)

      // Decode the payload (second part of JWT)
      const payloadBase64 = token.split('.')[1]
      const payload = JSON.parse(atob(payloadBase64))

      expect(payload.sub).toBe(userId)
      expect(payload.email).toBe(email)
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
      // Expiry should be 15 minutes (900 seconds) after iat
      expect(payload.exp - payload.iat).toBe(15 * 60)
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate 64-character hex string', () => {
      const token = generateRefreshToken()

      expect(token).toHaveLength(64)
      // Should be valid hexadecimal
      expect(token).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        tokens.add(generateRefreshToken())
      }

      // All tokens should be unique
      expect(tokens.size).toBe(iterations)
    })
  })

  describe('hashToken', () => {
    it('should hash token using SHA-256', async () => {
      const token = 'test-token-123'
      const hash = await hashToken(token)

      // SHA-256 produces 64-character hex string (256 bits = 32 bytes = 64 hex chars)
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should produce consistent hash for same input', async () => {
      const token = 'consistent-token'

      const hash1 = await hashToken(token)
      const hash2 = await hashToken(token)

      expect(hash1).toBe(hash2)
    })
  })

  describe('getRefreshTokenExpiry', () => {
    it('should return date 30 days in future (default)', () => {
      const now = new Date()
      const expiry = getRefreshTokenExpiry(mockEnv)

      // Calculate expected date (30 days from now)
      const expectedDate = new Date(now)
      expectedDate.setDate(expectedDate.getDate() + 30)

      // Allow 1 second tolerance for test execution time
      const diffMs = Math.abs(expiry.getTime() - expectedDate.getTime())
      expect(diffMs).toBeLessThan(1000)
    })

    it('should respect custom expiry days from env', () => {
      const customEnv = { ...mockEnv, REFRESH_TOKEN_EXPIRY_DAYS: '7' }
      const now = new Date()
      const expiry = getRefreshTokenExpiry(customEnv)

      const expectedDate = new Date(now)
      expectedDate.setDate(expectedDate.getDate() + 7)

      const diffMs = Math.abs(expiry.getTime() - expectedDate.getTime())
      expect(diffMs).toBeLessThan(1000)
    })
  })

  describe('setCookieOptions', () => {
    it('should return httpOnly and secure options', () => {
      const options = setCookieOptions(mockEnv, true)

      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(true)
      expect(options.sameSite).toBe('Lax')
      expect(options.path).toBe('/')
      expect(options.maxAge).toBeDefined()
    })

    it('should set secure based on isProduction', () => {
      const prodOptions = setCookieOptions(mockEnv, true)
      const devOptions = setCookieOptions(mockEnv, false)

      expect(prodOptions.secure).toBe(true)
      expect(devOptions.secure).toBe(false)
    })

    it('should set maxAge based on REFRESH_TOKEN_EXPIRY_DAYS', () => {
      const options = setCookieOptions(mockEnv, true)

      // 30 days in seconds
      const expectedMaxAge = 30 * 24 * 60 * 60
      expect(options.maxAge).toBe(expectedMaxAge)
    })
  })

  describe('setOAuthStateCookieOptions', () => {
    it('should set 10 minute maxAge', () => {
      const options = setOAuthStateCookieOptions(true)

      // 10 minutes in seconds
      expect(options.maxAge).toBe(10 * 60)
    })

    it('should return standard cookie options', () => {
      const options = setOAuthStateCookieOptions(true)

      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(true)
      expect(options.sameSite).toBe('Lax')
      expect(options.path).toBe('/')
    })

    it('should set secure based on isProduction', () => {
      const prodOptions = setOAuthStateCookieOptions(true)
      const devOptions = setOAuthStateCookieOptions(false)

      expect(prodOptions.secure).toBe(true)
      expect(devOptions.secure).toBe(false)
    })
  })
})
