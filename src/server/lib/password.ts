// src/server/lib/password.ts

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const NUMBERS = '0123456789'
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?'
const ALL_CHARS = LOWERCASE + UPPERCASE + NUMBERS + SPECIAL

const MIN_LENGTH = 16
const DEFAULT_LENGTH = 20
const MIN_CHAR_TYPES = 3
const MAX_CONSECUTIVE_REPEATS = 2

/**
 * Generate a cryptographically strong password meeting "Excellent" policy:
 * - At least 16 characters (default: 20)
 * - Contains at least 3 of 4 character types (lowercase, uppercase, numbers, special)
 * - No more than 2 identical characters in a row
 *
 * @param length - Desired password length (minimum 16, default 20)
 * @returns A strong random password
 *
 * @example
 * const password = generateStrongPassword()
 * // Returns something like: "Kj9#mNp2$xQw7&Ls4@"
 */
export function generateStrongPassword(length: number = DEFAULT_LENGTH): string {
  const targetLength = Math.max(length, MIN_LENGTH)

  const maxAttempts = 100

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const password = generateRandomPassword(targetLength)

    if (isStrongPassword(password)) {
      return password
    }
  }

  // Fallback: construct a guaranteed valid password
  return constructGuaranteedPassword(targetLength)
}

/**
 * Check if a password meets the "Excellent" policy requirements.
 *
 * @param password - The password to validate
 * @returns true if password meets all requirements
 */
export function isStrongPassword(password: string): boolean {
  // Check minimum length
  if (password.length < MIN_LENGTH) {
    return false
  }

  // Check character type diversity (at least 3 of 4 types)
  let typeCount = 0
  if (/[a-z]/.test(password)) typeCount++
  if (/[A-Z]/.test(password)) typeCount++
  if (/[0-9]/.test(password)) typeCount++
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) typeCount++

  if (typeCount < MIN_CHAR_TYPES) {
    return false
  }

  // Check for consecutive repeating characters (max 2)
  if (new RegExp(`(.)\\1{${String(MAX_CONSECUTIVE_REPEATS)},}`).test(password)) {
    return false
  }

  return true
}

/**
 * Generate a random password using crypto.getRandomValues
 */
function generateRandomPassword(length: number): string {
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  let password = ''
  for (let i = 0; i < length; i++) {
    password += ALL_CHARS[array[i] % ALL_CHARS.length]
  }

  return password
}

/**
 * Construct a password that is guaranteed to meet all requirements.
 * Used as a fallback if random generation fails after max attempts.
 */
function constructGuaranteedPassword(length: number): string {
  const charSets = [LOWERCASE, UPPERCASE, NUMBERS, SPECIAL]
  const result: string[] = []

  // Ensure at least one character from 3 different sets
  const shuffledSets = shuffleArray([...charSets])
  for (let i = 0; i < 3; i++) {
    result.push(getRandomChar(shuffledSets[i]))
  }

  // Fill remaining with random characters, avoiding consecutive repeats
  while (result.length < length) {
    const char = getRandomChar(ALL_CHARS)

    // Check if this would create 3+ consecutive identical characters
    if (result.length >= 2) {
      const last = result[result.length - 1]
      const secondLast = result[result.length - 2]
      if (char === last && char === secondLast) {
        continue // Skip this character
      }
    }

    result.push(char)
  }

  // Shuffle the result to distribute the guaranteed characters
  return shuffleArray(result).join('')
}

/**
 * Get a random character from a string
 */
function getRandomChar(chars: string): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return chars[array[0] % chars.length]
}

/**
 * Fisher-Yates shuffle for arrays
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  const randomValues = new Uint32Array(result.length)
  crypto.getRandomValues(randomValues)

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}
