import { describe, it, expect } from 'vitest'
import { generateStrongPassword, isStrongPassword } from './password'

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
