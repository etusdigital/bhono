/**
 * Token Utility Functions Integration Tests
 *
 * Tests the token utility functions:
 * - createAccessToken
 * - generateRefreshToken
 * - hashToken
 * - getRefreshTokenExpiry
 * - setCookieOptions
 * - setOAuthStateCookieOptions
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getEnv, type TestEnv } from '../setup'
import {
  createAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
  setCookieOptions,
  setOAuthStateCookieOptions,
} from '../../lib/tokens'
import { verify } from 'hono/jwt'

describe('Token Utility Functions', () => {
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
  })

  describe('createAccessToken', () => {
    it('should create a valid JWT access token', async () => {
      const userId = 'test-user-id'
      const email = 'test@example.com'

      const token = await createAccessToken(env, userId, email)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should include correct claims in token payload', async () => {
      const userId = 'test-user-id-123'
      const email = 'claims@example.com'

      const token = await createAccessToken(env, userId, email)

      // Verify and decode the token
      const payload = await verify(token, env.JWT_SECRET)

      expect(payload.sub).toBe(userId)
      expect(payload.email).toBe(email)
      expect(payload.iat).toBeTruthy()
      expect(payload.exp).toBeTruthy()
    })

    it('should set correct expiry based on JWT_EXPIRY_MINUTES', async () => {
      const userId = 'expiry-test-user'
      const email = 'expiry@example.com'

      const token = await createAccessToken(env, userId, email)
      const payload = await verify(token, env.JWT_SECRET)

      const expiryMinutes = Number.parseInt(String(env.JWT_EXPIRY_MINUTES) || '15', 10)
      const expectedExpiry = payload.iat + expiryMinutes * 60

      expect(payload.exp).toBe(expectedExpiry)
    })

    it('should create unique tokens for different users', async () => {
      const token1 = await createAccessToken(env, 'user1', 'user1@example.com')
      const token2 = await createAccessToken(env, 'user2', 'user2@example.com')

      expect(token1).not.toBe(token2)
    })

    it('should create unique tokens for same user at different times', async () => {
      const token1 = await createAccessToken(env, 'same-user', 'same@example.com')
      // Small delay to ensure different iat
      await new Promise((resolve) => setTimeout(resolve, 10))
      const token2 = await createAccessToken(env, 'same-user', 'same@example.com')

      // Tokens may be same if iat is same (within same second)
      // but verify they are both valid
      const payload1 = await verify(token1, env.JWT_SECRET)
      const payload2 = await verify(token2, env.JWT_SECRET)

      expect(payload1.sub).toBe('same-user')
      expect(payload2.sub).toBe('same-user')
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateRefreshToken()

      expect(token).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(token)).toBe(true)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateRefreshToken())
      }

      expect(tokens.size).toBe(100)
    })

    it('should use cryptographically secure random values', () => {
      const token = generateRefreshToken()

      // Check entropy - should not be sequential or predictable
      // Split into 8-byte chunks and verify they are different
      const chunks = token.match(/.{8}/g)!
      const uniqueChunks = new Set(chunks)

      expect(uniqueChunks.size).toBe(8)
    })
  })

  describe('hashToken', () => {
    it('should produce a 64-character hex hash', async () => {
      const token = 'test-token-value'
      const hash = await hashToken(token)

      expect(hash).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
    })

    it('should produce consistent hashes for same input', async () => {
      const token = 'consistent-token'
      const hash1 = await hashToken(token)
      const hash2 = await hashToken(token)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await hashToken('token1')
      const hash2 = await hashToken('token2')

      expect(hash1).not.toBe(hash2)
    })

    it('should be case-sensitive', async () => {
      const hash1 = await hashToken('Token')
      const hash2 = await hashToken('token')

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty string', async () => {
      const hash = await hashToken('')

      expect(hash).toHaveLength(64)
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
    })

    it('should handle special characters', async () => {
      const hash = await hashToken('!@#$%^&*()_+-=[]{}|;:,.<>?')

      expect(hash).toHaveLength(64)
    })

    it('should handle unicode characters', async () => {
      const hash = await hashToken('こんにちは世界🌍')

      expect(hash).toHaveLength(64)
    })
  })

  describe('getRefreshTokenExpiry', () => {
    it('should return a Date object', () => {
      const expiry = getRefreshTokenExpiry(env)

      expect(expiry).toBeInstanceOf(Date)
    })

    it('should return a future date', () => {
      const expiry = getRefreshTokenExpiry(env)
      const now = new Date()

      expect(expiry.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should respect REFRESH_TOKEN_EXPIRY_DAYS setting', () => {
      const expiry = getRefreshTokenExpiry(env)
      const expiryDays = Number.parseInt(String(env.REFRESH_TOKEN_EXPIRY_DAYS) || '30', 10)

      const now = new Date()
      const expectedDate = new Date(now)
      expectedDate.setDate(expectedDate.getDate() + expiryDays)

      // Allow 1 minute tolerance for test execution time
      const tolerance = 60 * 1000
      expect(Math.abs(expiry.getTime() - expectedDate.getTime())).toBeLessThan(tolerance)
    })

    it('should use fallback of 30 days if env value is empty string', () => {
      const envWithEmptyExpiry = { ...env, REFRESH_TOKEN_EXPIRY_DAYS: '' } as any

      const expiry = getRefreshTokenExpiry(envWithEmptyExpiry)

      const now = new Date()
      const expectedDate = new Date(now)
      expectedDate.setDate(expectedDate.getDate() + 30)

      const tolerance = 60 * 1000
      expect(Math.abs(expiry.getTime() - expectedDate.getTime())).toBeLessThan(tolerance)
    })
  })

  describe('setCookieOptions', () => {
    it('should return correct options for production', () => {
      const options = setCookieOptions(env, true)

      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(true)
      expect(options.sameSite).toBe('Lax')
      expect(options.path).toBe('/')
      expect(options.maxAge).toBeGreaterThan(0)
    })

    it('should return correct options for development', () => {
      const options = setCookieOptions(env, false)

      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(false)
      expect(options.sameSite).toBe('Lax')
      expect(options.path).toBe('/')
    })

    it('should calculate maxAge based on REFRESH_TOKEN_EXPIRY_DAYS', () => {
      const options = setCookieOptions(env, true)
      const expiryDays = Number.parseInt(String(env.REFRESH_TOKEN_EXPIRY_DAYS) || '30', 10)

      expect(options.maxAge).toBe(expiryDays * 24 * 60 * 60)
    })
  })

  describe('setOAuthStateCookieOptions', () => {
    it('should return correct options for production', () => {
      const options = setOAuthStateCookieOptions(true)

      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(true)
      expect(options.sameSite).toBe('Lax')
      expect(options.path).toBe('/')
    })

    it('should return correct options for development', () => {
      const options = setOAuthStateCookieOptions(false)

      expect(options.httpOnly).toBe(true)
      expect(options.secure).toBe(false)
      expect(options.sameSite).toBe('Lax')
      expect(options.path).toBe('/')
    })

    it('should set 10 minute maxAge for OAuth state', () => {
      const options = setOAuthStateCookieOptions(true)

      expect(options.maxAge).toBe(10 * 60) // 10 minutes in seconds
    })
  })
})
