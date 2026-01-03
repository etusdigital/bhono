/**
 * Refresh Token Hashing Security Tests
 *
 * Tests that refresh tokens are properly hashed before storage to protect
 * against database leaks. If an attacker gains access to the database,
 * they should not be able to use the stored token hashes to impersonate users.
 *
 * Security requirements tested:
 * - Tokens are hashed with SHA-256 (cryptographically secure)
 * - Original tokens cannot be recovered from hashes
 * - Hash verification works correctly
 * - Different tokens produce different hashes (collision resistance)
 */

import { describe, it, expect } from 'vitest'
import { hashToken, verifyToken, generateRefreshToken } from '../../../src/server/lib/tokens'

describe('Refresh Token Hashing', () => {
  // ============================================================================
  // SHA-256 Hash Properties
  // ============================================================================

  describe('SHA-256 Hash Properties', () => {
    it('refresh token is hashed with SHA-256 before storage', async () => {
      const originalToken = 'my-secret-refresh-token'
      const hashedToken = await hashToken(originalToken)

      // Hash should be different from original
      expect(hashedToken).not.toBe(originalToken)

      // Hash should be 64 characters (SHA-256 hex)
      expect(hashedToken).toHaveLength(64)
    })

    it('hash is a valid hexadecimal string', async () => {
      const originalToken = 'test-token-for-hex-validation'
      const hashedToken = await hashToken(originalToken)

      // Should only contain hex characters (0-9, a-f)
      expect(hashedToken).toMatch(/^[0-9a-f]{64}$/)
    })

    it('hash length is exactly 256 bits (32 bytes = 64 hex chars)', async () => {
      const tokens = [
        'short',
        'a'.repeat(100),
        'token with spaces',
        '!@#$%^&*()',
      ]

      for (const token of tokens) {
        const hash = await hashToken(token)
        // SHA-256 always produces 256-bit (32-byte) output
        // Each byte = 2 hex characters = 64 total
        expect(hash).toHaveLength(64)
      }
    })
  })

  // ============================================================================
  // One-Way Hash Security
  // ============================================================================

  describe('One-Way Hash Security', () => {
    it('original token cannot be recovered from hash', async () => {
      const originalToken = 'my-secret-refresh-token'
      const hashedToken = await hashToken(originalToken)

      // Hash should not contain the original token
      expect(hashedToken).not.toContain(originalToken)

      // The hash is fundamentally different - it's a fixed-size digest
      // that cannot be reversed to obtain the original input
      expect(hashedToken.length).not.toBe(originalToken.length)
    })

    it('hash does not reveal token length', async () => {
      const shortToken = 'abc'
      const longToken = 'a'.repeat(1000)

      const shortHash = await hashToken(shortToken)
      const longHash = await hashToken(longToken)

      // Both hashes should be the same length (64 chars)
      // This is important: attacker can't infer token length from hash
      expect(shortHash).toHaveLength(64)
      expect(longHash).toHaveLength(64)
    })

    it('hash output appears random (high entropy)', async () => {
      const token = 'simple-test-token'
      const hash = await hashToken(token)

      // Split hash into 8-character chunks and verify they're all different
      // A good hash function distributes bits uniformly
      const chunks = hash.match(/.{8}/g)!
      const uniqueChunks = new Set(chunks)

      // All 8 chunks should be unique for a proper hash
      expect(uniqueChunks.size).toBe(8)
    })
  })

  // ============================================================================
  // Deterministic Hashing
  // ============================================================================

  describe('Deterministic Hashing', () => {
    it('same token produces same hash (consistency)', async () => {
      const token = 'consistent-token'

      const hash1 = await hashToken(token)
      const hash2 = await hashToken(token)

      expect(hash1).toBe(hash2)
    })

    it('hash is reproducible across multiple calls', async () => {
      const token = 'reproducible-token'
      const hashes: string[] = []

      // Hash the same token 10 times
      for (let i = 0; i < 10; i++) {
        hashes.push(await hashToken(token))
      }

      // All hashes should be identical
      const uniqueHashes = new Set(hashes)
      expect(uniqueHashes.size).toBe(1)
    })
  })

  // ============================================================================
  // Collision Resistance
  // ============================================================================

  describe('Collision Resistance', () => {
    it('different tokens produce different hashes', async () => {
      const token1 = 'token-one'
      const token2 = 'token-two'

      const hash1 = await hashToken(token1)
      const hash2 = await hashToken(token2)

      expect(hash1).not.toBe(hash2)
    })

    it('similar tokens produce completely different hashes (avalanche effect)', async () => {
      const token1 = 'test-token-a'
      const token2 = 'test-token-b' // Only last character different

      const hash1 = await hashToken(token1)
      const hash2 = await hashToken(token2)

      // Hashes should be completely different (avalanche effect)
      expect(hash1).not.toBe(hash2)

      // Count matching characters - should be very low due to avalanche effect
      let matchingChars = 0
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] === hash2[i]) matchingChars++
      }

      // With random distribution, expect ~4 matching chars (64 * 1/16)
      // Allow up to 16 matching chars (25%) to account for randomness
      expect(matchingChars).toBeLessThan(16)
    })

    it('generates unique hashes for many unique tokens', async () => {
      const hashes = new Set<string>()
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const token = generateRefreshToken()
        const hash = await hashToken(token)
        hashes.add(hash)
      }

      // All hashes should be unique (no collisions)
      expect(hashes.size).toBe(iterations)
    })
  })

  // ============================================================================
  // Token Verification
  // ============================================================================

  describe('Token Verification', () => {
    it('verifyToken correctly matches original token to hash', async () => {
      const originalToken = 'my-secret-token'
      const hashedToken = await hashToken(originalToken)

      const isValid = await verifyToken(originalToken, hashedToken)

      expect(isValid).toBe(true)
    })

    it('verifyToken rejects wrong token', async () => {
      const originalToken = 'my-secret-token'
      const hashedToken = await hashToken(originalToken)

      const isValid = await verifyToken('wrong-token', hashedToken)

      expect(isValid).toBe(false)
    })

    it('verifyToken rejects empty token', async () => {
      const originalToken = 'my-secret-token'
      const hashedToken = await hashToken(originalToken)

      const isValid = await verifyToken('', hashedToken)

      expect(isValid).toBe(false)
    })

    it('verifyToken rejects similar but different token', async () => {
      const originalToken = 'my-secret-token-123'
      const hashedToken = await hashToken(originalToken)

      // Try variations that are close but not exact
      const variations = [
        'my-secret-token-124',
        'my-secret-token-12',
        'My-secret-token-123', // Case difference
        ' my-secret-token-123', // Leading space
        'my-secret-token-123 ', // Trailing space
      ]

      for (const variant of variations) {
        const isValid = await verifyToken(variant, hashedToken)
        expect(isValid).toBe(false)
      }
    })

    it('verifyToken is case-sensitive', async () => {
      const originalToken = 'CaseSensitiveToken'
      const hashedToken = await hashToken(originalToken)

      expect(await verifyToken('CaseSensitiveToken', hashedToken)).toBe(true)
      expect(await verifyToken('casesensitivetoken', hashedToken)).toBe(false)
      expect(await verifyToken('CASESENSITIVETOKEN', hashedToken)).toBe(false)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty string token', async () => {
      const emptyToken = ''
      const hash = await hashToken(emptyToken)

      // Empty string should still produce valid SHA-256 hash
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)

      // Verify empty string hash is consistent
      const hash2 = await hashToken('')
      expect(hash).toBe(hash2)
    })

    it('handles special characters in token', async () => {
      const specialToken = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~'
      const hash = await hashToken(specialToken)

      expect(hash).toHaveLength(64)
      expect(await verifyToken(specialToken, hash)).toBe(true)
    })

    it('handles unicode characters in token', async () => {
      const unicodeToken = 'token-with-emoji-\u{1F600}-and-kanji-\u{65E5}\u{672C}'
      const hash = await hashToken(unicodeToken)

      expect(hash).toHaveLength(64)
      expect(await verifyToken(unicodeToken, hash)).toBe(true)
    })

    it('handles very long tokens', async () => {
      const longToken = 'x'.repeat(10000)
      const hash = await hashToken(longToken)

      expect(hash).toHaveLength(64)
      expect(await verifyToken(longToken, hash)).toBe(true)
    })

    it('handles whitespace-only tokens', async () => {
      const whitespaceToken = '   \t\n  '
      const hash = await hashToken(whitespaceToken)

      expect(hash).toHaveLength(64)
      expect(await verifyToken(whitespaceToken, hash)).toBe(true)
      // Different whitespace produces different hash
      expect(await verifyToken('   ', hash)).toBe(false)
    })
  })

  // ============================================================================
  // Integration with generateRefreshToken
  // ============================================================================

  describe('Integration with generateRefreshToken', () => {
    it('generated tokens can be hashed and verified', async () => {
      const token = generateRefreshToken()
      const hash = await hashToken(token)

      expect(await verifyToken(token, hash)).toBe(true)
    })

    it('hash of generated token is different from the token itself', async () => {
      const token = generateRefreshToken()
      const hash = await hashToken(token)

      // Both are 64-char hex strings, but should be different
      expect(token).toHaveLength(64)
      expect(hash).toHaveLength(64)
      expect(hash).not.toBe(token)
    })

    it('stored hash cannot be used directly as token', async () => {
      const originalToken = generateRefreshToken()
      const storedHash = await hashToken(originalToken)

      // Using the hash as if it were the token should fail verification
      // This simulates an attacker trying to use a leaked hash
      const attackerAttempt = await verifyToken(storedHash, storedHash)

      expect(attackerAttempt).toBe(false)
    })
  })

  // ============================================================================
  // Database Leak Protection
  // ============================================================================

  describe('Database Leak Protection', () => {
    it('attacker cannot use leaked hash to authenticate', async () => {
      // Scenario: Attacker gains access to database containing token_hash
      const legitimateToken = generateRefreshToken()
      const storedInDatabase = await hashToken(legitimateToken)

      // Attacker only has the hash, not the original token
      // They try various attacks:

      // Attack 1: Use hash directly as token
      const attack1 = await verifyToken(storedInDatabase, storedInDatabase)
      expect(attack1).toBe(false)

      // Attack 2: Use hash with original token (wrong direction)
      const attack2 = await verifyToken(storedInDatabase, legitimateToken)
      expect(attack2).toBe(false)

      // Only the original token works
      const legitimate = await verifyToken(legitimateToken, storedInDatabase)
      expect(legitimate).toBe(true)
    })

    it('each user has unique token hash even with same generator', async () => {
      // Even if two users generate tokens at the same time,
      // their hashes should be different
      const user1Token = generateRefreshToken()
      const user2Token = generateRefreshToken()

      const user1Hash = await hashToken(user1Token)
      const user2Hash = await hashToken(user2Token)

      expect(user1Token).not.toBe(user2Token)
      expect(user1Hash).not.toBe(user2Hash)
    })
  })
})
