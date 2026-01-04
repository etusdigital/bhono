// src/server/lib/providers.test.ts
import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_PROVIDERS,
  hasProvider,
  addProvider,
  removeProvider,
  parseProviderId,
} from '@server/lib/providers'

describe('providers', () => {
  describe('SUPPORTED_PROVIDERS', () => {
    it('should include google, github, microsoft, email', () => {
      expect(SUPPORTED_PROVIDERS).toContain('google')
      expect(SUPPORTED_PROVIDERS).toContain('github')
      expect(SUPPORTED_PROVIDERS).toContain('microsoft')
      expect(SUPPORTED_PROVIDERS).toContain('email')
    })
  })

  describe('hasProvider', () => {
    it('should return true when provider exists', () => {
      const providerIds = ['google|abc123', 'github|xyz789']
      expect(hasProvider(providerIds, 'google|abc123')).toBe(true)
    })

    it('should return false when provider does not exist', () => {
      const providerIds = ['google|abc123']
      expect(hasProvider(providerIds, 'github|xyz789')).toBe(false)
    })

    it('should return false for empty array', () => {
      expect(hasProvider([], 'google|abc123')).toBe(false)
    })
  })

  describe('addProvider', () => {
    it('should add provider to array', () => {
      const providerIds = ['google|abc123']
      const result = addProvider(providerIds, 'github|xyz789')
      expect(result).toEqual(['google|abc123', 'github|xyz789'])
    })

    it('should not mutate original array', () => {
      const providerIds = ['google|abc123']
      addProvider(providerIds, 'github|xyz789')
      expect(providerIds).toEqual(['google|abc123'])
    })

    it('should not add duplicate provider', () => {
      const providerIds = ['google|abc123']
      const result = addProvider(providerIds, 'google|abc123')
      expect(result).toEqual(['google|abc123'])
    })
  })

  describe('removeProvider', () => {
    it('should remove provider from array', () => {
      const providerIds = ['google|abc123', 'github|xyz789']
      const result = removeProvider(providerIds, 'github|xyz789')
      expect(result).toEqual(['google|abc123'])
    })

    it('should not mutate original array', () => {
      const providerIds = ['google|abc123', 'github|xyz789']
      removeProvider(providerIds, 'github|xyz789')
      expect(providerIds).toEqual(['google|abc123', 'github|xyz789'])
    })

    it('should return same array if provider not found', () => {
      const providerIds = ['google|abc123']
      const result = removeProvider(providerIds, 'github|xyz789')
      expect(result).toEqual(['google|abc123'])
    })
  })

  describe('parseProviderId', () => {
    it('should parse valid google provider id', () => {
      const result = parseProviderId('google|abc123')
      expect(result).toEqual({ provider: 'google', id: 'abc123' })
    })

    it('should parse valid github provider id', () => {
      const result = parseProviderId('github|xyz789')
      expect(result).toEqual({ provider: 'github', id: 'xyz789' })
    })

    it('should return null for invalid format (no separator)', () => {
      expect(parseProviderId('invalid')).toBeNull()
    })

    it('should return null for unsupported provider', () => {
      expect(parseProviderId('unknown|abc123')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseProviderId('')).toBeNull()
    })

    it('should handle provider id with multiple separators', () => {
      const result = parseProviderId('google|abc|123')
      expect(result).toEqual({ provider: 'google', id: 'abc|123' })
    })
  })
})
