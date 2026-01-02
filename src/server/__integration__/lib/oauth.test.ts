/**
 * OAuth Utility Functions Integration Tests
 *
 * Tests the OAuth utility functions:
 * - generateCodeVerifier
 * - generateCodeChallenge
 * - generateState
 * - buildGoogleAuthUrl
 * - decodeIdToken
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getEnv, type TestEnv } from '../setup'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildGoogleAuthUrl,
  decodeIdToken,
} from '../../lib/oauth'

describe('OAuth Utility Functions', () => {
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
  })

  describe('generateCodeVerifier', () => {
    it('should generate a base64url-encoded string', () => {
      const verifier = generateCodeVerifier()

      expect(verifier).toBeTruthy()
      expect(typeof verifier).toBe('string')
      // Base64url characters only
      expect(/^[A-Za-z0-9_-]+$/.test(verifier)).toBe(true)
    })

    it('should generate unique verifiers', () => {
      const verifiers = new Set()
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier())
      }

      expect(verifiers.size).toBe(100)
    })

    it('should generate verifier of consistent length', () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()

      expect(verifier1.length).toBe(verifier2.length)
      expect(verifier1.length).toBeGreaterThan(30) // Should be reasonably long
    })
  })

  describe('generateCodeChallenge', () => {
    it('should generate a base64url-encoded challenge from verifier', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)

      expect(challenge).toBeTruthy()
      expect(typeof challenge).toBe('string')
      expect(/^[A-Za-z0-9_-]+$/.test(challenge)).toBe(true)
    })

    it('should produce consistent challenges for same verifier', async () => {
      const verifier = 'test-verifier-string'
      const challenge1 = await generateCodeChallenge(verifier)
      const challenge2 = await generateCodeChallenge(verifier)

      expect(challenge1).toBe(challenge2)
    })

    it('should produce different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()

      const challenge1 = await generateCodeChallenge(verifier1)
      const challenge2 = await generateCodeChallenge(verifier2)

      expect(challenge1).not.toBe(challenge2)
    })

    it('should generate challenge of expected SHA-256 length', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)

      // SHA-256 produces 32 bytes, base64url encoded is ~43 chars
      expect(challenge.length).toBeGreaterThanOrEqual(40)
      expect(challenge.length).toBeLessThanOrEqual(50)
    })
  })

  describe('generateState', () => {
    it('should generate a base64url-encoded state', () => {
      const state = generateState()

      expect(state).toBeTruthy()
      expect(typeof state).toBe('string')
      expect(/^[A-Za-z0-9_-]+$/.test(state)).toBe(true)
    })

    it('should generate unique states', () => {
      const states = new Set()
      for (let i = 0; i < 100; i++) {
        states.add(generateState())
      }

      expect(states.size).toBe(100)
    })
  })

  describe('buildGoogleAuthUrl', () => {
    it('should build a valid Google OAuth URL', () => {
      const state = 'test-state'
      const codeChallenge = 'test-code-challenge'

      const url = buildGoogleAuthUrl(env, state, codeChallenge)

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    })

    it('should include all required parameters', () => {
      const state = 'my-state'
      const codeChallenge = 'my-challenge'

      const url = buildGoogleAuthUrl(env, state, codeChallenge)

      expect(url).toContain(`client_id=${env.GOOGLE_CLIENT_ID}`)
      expect(url).toContain(`redirect_uri=${encodeURIComponent(env.GOOGLE_REDIRECT_URI)}`)
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=openid+email+profile')
      expect(url).toContain(`state=${state}`)
      expect(url).toContain(`code_challenge=${codeChallenge}`)
      expect(url).toContain('code_challenge_method=S256')
    })

    it('should include PKCE parameters', () => {
      const state = 'pkce-state'
      const codeChallenge = 'pkce-challenge'

      const url = buildGoogleAuthUrl(env, state, codeChallenge)

      expect(url).toContain(`code_challenge=${codeChallenge}`)
      expect(url).toContain('code_challenge_method=S256')
    })

    it('should include offline access parameters', () => {
      const state = 'offline-state'
      const codeChallenge = 'offline-challenge'

      const url = buildGoogleAuthUrl(env, state, codeChallenge)

      expect(url).toContain('access_type=offline')
      expect(url).toContain('prompt=consent')
    })
  })

  describe('decodeIdToken', () => {
    // Helper to encode UTF-8 strings to base64url
    function utf8ToBase64url(str: string): string {
      const bytes = new TextEncoder().encode(str)
      const binary = String.fromCharCode(...bytes)
      return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    }

    function createMockIdToken(payload: Record<string, unknown>): string {
      const header = { alg: 'RS256', typ: 'JWT' }
      const headerB64 = utf8ToBase64url(JSON.stringify(header))
      const payloadB64 = utf8ToBase64url(JSON.stringify(payload))
      const signature = 'mock_signature'
      return `${headerB64}.${payloadB64}.${signature}`
    }

    it('should decode a valid ID token', () => {
      const payload = {
        sub: 'google-user-id-123',
        email: 'user@gmail.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        given_name: 'Test',
        family_name: 'User',
      }

      const token = createMockIdToken(payload)
      const decoded = decodeIdToken(token)

      expect(decoded.sub).toBe('google-user-id-123')
      expect(decoded.email).toBe('user@gmail.com')
      expect(decoded.email_verified).toBe(true)
      expect(decoded.name).toBe('Test User')
      expect(decoded.picture).toBe('https://example.com/photo.jpg')
      expect(decoded.given_name).toBe('Test')
      expect(decoded.family_name).toBe('User')
    })

    it('should handle token with null picture', () => {
      const payload = {
        sub: 'no-picture-user',
        email: 'nopicture@gmail.com',
        email_verified: true,
        name: 'No Picture User',
        picture: null,
        given_name: 'No',
        family_name: 'Picture',
      }

      const token = createMockIdToken(payload)
      const decoded = decodeIdToken(token)

      expect(decoded.picture).toBeNull()
    })

    it('should handle token with unicode characters', () => {
      const payload = {
        sub: 'unicode-user',
        email: 'unicode@gmail.com',
        email_verified: true,
        name: '日本語ユーザー',
        picture: null,
        given_name: '日本語',
        family_name: 'ユーザー',
      }

      const token = createMockIdToken(payload)
      const decoded = decodeIdToken(token)

      expect(decoded.name).toBe('日本語ユーザー')
    })

    it('should throw error for invalid token format', () => {
      expect(() => decodeIdToken('invalid-token')).toThrow('Invalid ID token format')
      expect(() => decodeIdToken('only.two')).toThrow('Invalid ID token format')
      expect(() => decodeIdToken('')).toThrow('Invalid ID token format')
    })

    it('should handle tokens with special characters in name', () => {
      const payload = {
        sub: 'special-char-user',
        email: 'special@gmail.com',
        email_verified: true,
        name: "O'Brien-Smith",
        picture: null,
        given_name: "O'Brien",
        family_name: 'Smith',
      }

      const token = createMockIdToken(payload)
      const decoded = decodeIdToken(token)

      expect(decoded.name).toBe("O'Brien-Smith")
    })
  })
})
