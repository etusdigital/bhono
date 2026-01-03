/**
 * JWT Secret Validation Integration Tests
 *
 * Tests that the JWT_SECRET environment variable is properly validated
 * to ensure security requirements are met:
 * - JWT_SECRET must be at least 32 characters
 * - Application should fail to start with invalid JWT_SECRET
 */

import { describe, it, expect } from 'vitest'
import { getEnv as getTestEnv } from '../setup'
import {
  validateEnv,
  JWT_SECRET_MIN_LENGTH,
  type Env,
} from '../../../src/server/env'

describe('JWT Secret Validation', () => {
  // ============================================================================
  // Valid JWT_SECRET Tests
  // ============================================================================

  describe('Valid JWT_SECRET', () => {
    it('test environment has valid JWT_SECRET (at least 32 characters)', () => {
      const env = getTestEnv()
      expect(env.JWT_SECRET).toBeDefined()
      expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(JWT_SECRET_MIN_LENGTH)
    })

    it('accepts JWT_SECRET with exactly 32 characters', () => {
      const validSecret = 'a'.repeat(32)
      expect(validSecret.length).toBe(32)

      const mockEnv = createMockEnv({ JWT_SECRET: validSecret })

      expect(() => validateEnv(mockEnv)).not.toThrow()
    })

    it('accepts JWT_SECRET with more than 32 characters', () => {
      const longSecret = 'a'.repeat(64)
      expect(longSecret.length).toBe(64)

      const mockEnv = createMockEnv({ JWT_SECRET: longSecret })

      expect(() => validateEnv(mockEnv)).not.toThrow()
    })

    it('accepts complex JWT_SECRET with mixed characters', () => {
      const complexSecret = 'aB3$%^&*()_+-=[]{}|;:,.<>?!@#123'
      expect(complexSecret.length).toBeGreaterThanOrEqual(32)

      const mockEnv = createMockEnv({ JWT_SECRET: complexSecret })

      expect(() => validateEnv(mockEnv)).not.toThrow()
    })
  })

  // ============================================================================
  // Invalid JWT_SECRET Tests
  // ============================================================================

  describe('Invalid JWT_SECRET', () => {
    it('rejects JWT_SECRET shorter than 32 characters', () => {
      const shortSecret = 'short'
      expect(shortSecret.length).toBeLessThan(32)

      const mockEnv = createMockEnv({ JWT_SECRET: shortSecret })

      expect(() => validateEnv(mockEnv)).toThrow(
        `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`
      )
    })

    it('rejects JWT_SECRET with exactly 31 characters (boundary test)', () => {
      const almostValidSecret = 'a'.repeat(31)
      expect(almostValidSecret.length).toBe(31)

      const mockEnv = createMockEnv({ JWT_SECRET: almostValidSecret })

      expect(() => validateEnv(mockEnv)).toThrow(
        `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`
      )
    })

    it('rejects empty JWT_SECRET', () => {
      const mockEnv = createMockEnv({ JWT_SECRET: '' })

      expect(() => validateEnv(mockEnv)).toThrow(
        `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`
      )
    })

    it('rejects single character JWT_SECRET', () => {
      const mockEnv = createMockEnv({ JWT_SECRET: 'x' })

      expect(() => validateEnv(mockEnv)).toThrow(
        `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`
      )
    })
  })

  // ============================================================================
  // Missing JWT_SECRET Tests
  // ============================================================================

  describe('Missing JWT_SECRET', () => {
    it('rejects undefined JWT_SECRET', () => {
      // Create an env object without JWT_SECRET
      const mockEnv = {
        ENVIRONMENT: 'test',
        APP_URL: 'http://localhost:8787',
        JWT_EXPIRY_MINUTES: '15',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_REDIRECT_URI: 'http://localhost/callback',
        REFRESH_TOKEN_EXPIRY_DAYS: '30',
        SENDGRID_API_KEY: 'test-api-key',
        SENDGRID_FROM_EMAIL: 'test@example.com',
      } as unknown as Env

      expect(() => validateEnv(mockEnv)).toThrow(
        `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`
      )
    })
  })

  // ============================================================================
  // Minimum Length Constant Tests
  // ============================================================================

  describe('JWT_SECRET_MIN_LENGTH constant', () => {
    it('should be 32 characters', () => {
      expect(JWT_SECRET_MIN_LENGTH).toBe(32)
    })

    it('should be exported and available for use', () => {
      expect(typeof JWT_SECRET_MIN_LENGTH).toBe('number')
      expect(JWT_SECRET_MIN_LENGTH).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Security Considerations Tests
  // ============================================================================

  describe('Security Considerations', () => {
    it('32 characters provides sufficient entropy for HMAC-SHA256', () => {
      // HMAC-SHA256 can use keys of any length, but 32 bytes (256 bits)
      // provides full security for the algorithm
      expect(JWT_SECRET_MIN_LENGTH).toBeGreaterThanOrEqual(32)
    })

    it('validation function is synchronous (fails fast at startup)', () => {
      const mockEnv = createMockEnv({ JWT_SECRET: 'short' })

      // Should throw immediately (synchronously), not return a promise
      let threwSync = false
      try {
        validateEnv(mockEnv)
      } catch {
        threwSync = true
      }

      expect(threwSync).toBe(true)
    })

    it('error message is clear and actionable', () => {
      const mockEnv = createMockEnv({ JWT_SECRET: 'short' })

      let errorMessage = ''
      try {
        validateEnv(mockEnv)
      } catch (error) {
        errorMessage = (error as Error).message
      }

      // Error message should mention:
      // 1. JWT_SECRET (what's wrong)
      // 2. The minimum length requirement
      expect(errorMessage).toContain('JWT_SECRET')
      expect(errorMessage).toContain('32')
      expect(errorMessage).toContain('characters')
    })
  })
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock Env object with default values
 * Allows overriding specific fields for testing
 */
function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: 'test',
    APP_URL: 'http://localhost:8787',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-32-chars',
    JWT_EXPIRY_MINUTES: '15',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:8787/auth/google/callback',
    REFRESH_TOKEN_EXPIRY_DAYS: '30',
    SENDGRID_API_KEY: 'test-sendgrid-api-key',
    SENDGRID_FROM_EMAIL: 'test@example.com',
    ...overrides,
  }
}
