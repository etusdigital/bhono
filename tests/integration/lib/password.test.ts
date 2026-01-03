/**
 * Password Utility Functions Integration Tests
 *
 * Tests the password generation and validation:
 * - generateStrongPassword
 * - isStrongPassword
 */

import { describe, it, expect } from 'vitest'
import { generateStrongPassword, isStrongPassword } from '../../../src/server/lib/password'

describe('Password Utility Functions', () => {
  describe('generateStrongPassword', () => {
    it('should generate a password of default length (20)', () => {
      const password = generateStrongPassword()

      expect(password.length).toBe(20)
    })

    it('should generate a password of specified length', () => {
      const password = generateStrongPassword(25)

      expect(password.length).toBe(25)
    })

    it('should enforce minimum length of 16', () => {
      const password = generateStrongPassword(10) // Less than minimum

      expect(password.length).toBe(16)
    })

    it('should generate password that passes strength validation', () => {
      const password = generateStrongPassword()

      expect(isStrongPassword(password)).toBe(true)
    })

    it('should generate unique passwords', () => {
      const passwords = new Set()
      for (let i = 0; i < 100; i++) {
        passwords.add(generateStrongPassword())
      }

      expect(passwords.size).toBe(100)
    })

    it('should generate passwords with at least 3 character types', () => {
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

    it('should not have more than 2 consecutive identical characters', () => {
      for (let i = 0; i < 10; i++) {
        const password = generateStrongPassword()

        // Check for 3+ consecutive identical characters
        expect(/(.)\1{2,}/.test(password)).toBe(false)
      }
    })

    it('should handle very long lengths', () => {
      const password = generateStrongPassword(100)

      expect(password.length).toBe(100)
      expect(isStrongPassword(password)).toBe(true)
    })
  })

  describe('isStrongPassword', () => {
    describe('length validation', () => {
      it('should reject passwords shorter than 16 characters', () => {
        expect(isStrongPassword('Short1!')).toBe(false)
        expect(isStrongPassword('Abc123!@#')).toBe(false)
        expect(isStrongPassword('Abcd1234!@#$%^')).toBe(false) // 15 chars
      })

      it('should accept passwords of exactly 16 characters', () => {
        // Meets all other requirements: lowercase, uppercase, number, special
        expect(isStrongPassword('Abcd1234!@#$efgh')).toBe(true)
      })

      it('should accept passwords longer than 16 characters', () => {
        expect(isStrongPassword('Abcd1234!@#$efghijklmnop')).toBe(true)
      })
    })

    describe('character type diversity validation', () => {
      it('should reject password with only lowercase', () => {
        expect(isStrongPassword('abcdefghijklmnop')).toBe(false)
      })

      it('should reject password with only uppercase', () => {
        expect(isStrongPassword('ABCDEFGHIJKLMNOP')).toBe(false)
      })

      it('should reject password with only numbers', () => {
        expect(isStrongPassword('1234567890123456')).toBe(false)
      })

      it('should reject password with only special characters', () => {
        expect(isStrongPassword('!@#$%^&*()_+-=[]')).toBe(false)
      })

      it('should reject password with only 2 character types', () => {
        expect(isStrongPassword('abcdefghABCDEFGH')).toBe(false) // lower + upper
        expect(isStrongPassword('abcdefgh12345678')).toBe(false) // lower + number
        expect(isStrongPassword('abcdefgh!@#$%^&*')).toBe(false) // lower + special
      })

      it('should accept password with 3 character types', () => {
        expect(isStrongPassword('Abcdefgh12345678')).toBe(true) // lower + upper + number
        expect(isStrongPassword('Abcdefgh!@#$%^&*')).toBe(true) // lower + upper + special
        expect(isStrongPassword('abcdefgh12!@#$%^')).toBe(true) // lower + number + special
      })

      it('should accept password with all 4 character types', () => {
        expect(isStrongPassword('Abcdefgh123!@#$%')).toBe(true)
      })
    })

    describe('consecutive character validation', () => {
      it('should accept password with 2 consecutive identical characters', () => {
        expect(isStrongPassword('Aabcddefgh123!@#')).toBe(true) // 'dd' is ok
      })

      it('should reject password with 3 consecutive identical characters', () => {
        expect(isStrongPassword('Xaaabcdefgh123!@#')).toBe(false) // 'aaa' is not ok
        expect(isStrongPassword('Abcdefgh1111!@#$')).toBe(false) // '1111' is not ok
      })

      it('should reject password with 4+ consecutive identical characters', () => {
        expect(isStrongPassword('Aaaabcdefg123!@#')).toBe(false)
        expect(isStrongPassword('Abcdefgh!!!!!123')).toBe(false)
      })
    })

    describe('combined validation', () => {
      it('should validate all criteria together', () => {
        // Valid passwords
        expect(isStrongPassword('MyStr0ng!Password')).toBe(true)
        expect(isStrongPassword('SecureP@ssw0rd123')).toBe(true)
        expect(isStrongPassword('C0mplex!tyRul3s!!')).toBe(true)

        // Invalid passwords
        expect(isStrongPassword('tooshort')).toBe(false) // Too short
        expect(isStrongPassword('alllowercasenospecial')).toBe(false) // Missing types
        expect(isStrongPassword('AAAbbbccc123!@#$')).toBe(false) // 3 consecutive 'AAA'
      })
    })

    describe('special character recognition', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'

      it('should recognize all special characters', () => {
        for (const char of specialChars) {
          // Password needs to be at least 16 characters and have 3+ character types
          const password = `Abcdefgh123${char}${char}ijk`
          // Should recognize the special char as part of the 3+ types
          expect(isStrongPassword(password)).toBe(true)
        }
      })
    })
  })

  describe('integration between generate and validate', () => {
    it('should always generate passwords that pass validation', () => {
      for (let i = 0; i < 50; i++) {
        const password = generateStrongPassword()
        expect(isStrongPassword(password)).toBe(true)
      }
    })

    it('should generate valid passwords for various lengths', () => {
      const lengths = [16, 20, 25, 32, 50]

      for (const length of lengths) {
        const password = generateStrongPassword(length)
        expect(isStrongPassword(password)).toBe(true)
        expect(password.length).toBe(length)
      }
    })
  })
})
