import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateStrongPassword, isStrongPassword } from './password'

// Store original crypto.getRandomValues
const originalGetRandomValues = crypto.getRandomValues.bind(crypto)

describe('generateStrongPassword', () => {
  it('generates password with default length of 20', () => {
    const password = generateStrongPassword()
    expect(password.length).toBe(20)
  })

  it('generates password with custom length', () => {
    const password = generateStrongPassword(24)
    expect(password.length).toBe(24)
  })

  it('enforces minimum length of 16', () => {
    const password = generateStrongPassword(10)
    expect(password.length).toBe(16)
  })

  it('contains at least 3 of 4 character types', () => {
    // Generate multiple passwords to ensure consistency
    for (let i = 0; i < 10; i++) {
      const password = generateStrongPassword()
      let typeCount = 0

      if (/[a-z]/.test(password)) typeCount++
      if (/[A-Z]/.test(password)) typeCount++
      if (/[0-9]/.test(password)) typeCount++
      if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) typeCount++

      expect(typeCount).toBeGreaterThanOrEqual(3)
    }
  })

  it('does not have more than 2 identical consecutive characters', () => {
    for (let i = 0; i < 10; i++) {
      const password = generateStrongPassword()
      expect(password).not.toMatch(/(.)\1{2,}/)
    }
  })

  it('generates unique passwords each time', () => {
    const passwords = new Set<string>()
    for (let i = 0; i < 100; i++) {
      passwords.add(generateStrongPassword())
    }
    expect(passwords.size).toBe(100)
  })
})

describe('isStrongPassword', () => {
  it('returns true for valid strong password', () => {
    expect(isStrongPassword('Abc123!@#defGHI456')).toBe(true)
  })

  it('returns false for password shorter than 16 characters', () => {
    expect(isStrongPassword('Abc123!@#')).toBe(false)
  })

  it('returns false for password with less than 3 character types', () => {
    expect(isStrongPassword('abcdefghijklmnop')).toBe(false) // only lowercase
    expect(isStrongPassword('ABCDEFGHIJKLMNOP')).toBe(false) // only uppercase
    expect(isStrongPassword('1234567890123456')).toBe(false) // only numbers
  })

  it('returns false for password with 3+ consecutive identical characters', () => {
    expect(isStrongPassword('Abc111defGHI456!@')).toBe(false)
    expect(isStrongPassword('AAAbc123defGHI!@#')).toBe(false)
  })

  it('returns true for password with exactly 2 consecutive identical characters', () => {
    expect(isStrongPassword('Aabbcc123!@#DEFGH')).toBe(true)
  })
})

describe('generateStrongPassword fallback path', () => {
  afterEach(() => {
    // Restore original crypto.getRandomValues
    vi.restoreAllMocks()
    Object.defineProperty(crypto, 'getRandomValues', {
      value: originalGetRandomValues,
      writable: true,
      configurable: true,
    })
  })

  it('falls back to constructGuaranteedPassword when random generation fails repeatedly', () => {
    let callCount = 0

    // Mock crypto.getRandomValues to always return invalid passwords until fallback
    Object.defineProperty(crypto, 'getRandomValues', {
      value: <T extends ArrayBufferView | null>(array: T): T => {
        callCount++

        if (array instanceof Uint32Array) {
          // For the first 100 calls, produce only lowercase 'a' (invalid)
          // After that, produce varied chars for fallback
          if (callCount <= 100) {
            for (let i = 0; i < array.length; i++) {
              array[i] = 0
            }
          } else {
            // For constructGuaranteedPassword, use varied values
            for (let i = 0; i < array.length; i++) {
              array[i] = (i * 30 + callCount) % 1000000
            }
          }
        }
        return array
      },
      writable: true,
      configurable: true,
    })

    const password = generateStrongPassword()

    // The fallback should produce a valid password
    expect(password.length).toBeGreaterThanOrEqual(16)
    expect(isStrongPassword(password)).toBe(true)

    // Verify we hit the fallback (> 100 calls)
    expect(callCount).toBeGreaterThan(100)
  })
})

describe('isStrongPassword edge cases', () => {
  it('handles empty string', () => {
    expect(isStrongPassword('')).toBe(false)
  })

  it('handles string with only whitespace', () => {
    expect(isStrongPassword('                ')).toBe(false)
  })

  it('handles string with unicode characters', () => {
    // Unicode characters should not count towards special chars
    expect(isStrongPassword('Abc123üäöéñ')).toBe(false) // too short
  })

  it('correctly validates password at exact boundary (16 chars)', () => {
    // Exactly 16 characters with 3 types
    expect(isStrongPassword('Abcd1234efghijkl')).toBe(true)
  })

  it('correctly validates password just under boundary (15 chars)', () => {
    expect(isStrongPassword('Abcd1234efghijk')).toBe(false)
  })
})
