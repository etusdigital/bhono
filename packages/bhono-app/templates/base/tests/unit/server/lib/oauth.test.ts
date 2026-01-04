import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  decodeIdToken,
} from '@server/lib/oauth'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockEnv = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
} as any

// Create a valid JWT-like token for testing
function createMockIdToken(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const encodedPayload = btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
  const signature = 'mock-signature'
  return `${header}.${encodedPayload}.${signature}`
}

describe('generateState', () => {
  it('should generate random state string', () => {
    const state = generateState()
    expect(state).toBeDefined()
    expect(typeof state).toBe('string')
    expect(state.length).toBeGreaterThan(0)
  })

  it('should generate unique states each time', () => {
    const states = new Set<string>()
    for (let i = 0; i < 100; i++) {
      states.add(generateState())
    }
    expect(states.size).toBe(100)
  })
})

describe('generateCodeVerifier', () => {
  it('should generate random verifier string', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toBeDefined()
    expect(typeof verifier).toBe('string')
    expect(verifier.length).toBeGreaterThan(0)
  })

  it('should generate unique verifiers each time', () => {
    const verifiers = new Set<string>()
    for (let i = 0; i < 100; i++) {
      verifiers.add(generateCodeVerifier())
    }
    expect(verifiers.size).toBe(100)
  })
})

describe('generateCodeChallenge', () => {
  it('should generate SHA-256 hash of verifier', async () => {
    const verifier = 'test-verifier-string'
    const challenge = await generateCodeChallenge(verifier)

    expect(challenge).toBeDefined()
    expect(typeof challenge).toBe('string')
    expect(challenge.length).toBeGreaterThan(0)

    // Same input should produce same output
    const challenge2 = await generateCodeChallenge(verifier)
    expect(challenge).toBe(challenge2)

    // Different input should produce different output
    const challenge3 = await generateCodeChallenge('different-verifier')
    expect(challenge).not.toBe(challenge3)
  })
})

describe('buildGoogleAuthUrl', () => {
  it('should build valid Google OAuth URL with all parameters', () => {
    const state = 'test-state'
    const codeChallenge = 'test-code-challenge'

    const url = buildGoogleAuthUrl(mockEnv, state, codeChallenge)

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback')
    expect(url).toContain('response_type=code')
    expect(url).toContain('scope=openid+email+profile')
    expect(url).toContain('code_challenge_method=S256')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
  })

  it('should include state and code_challenge', () => {
    const state = 'my-state-123'
    const codeChallenge = 'my-challenge-456'

    const url = buildGoogleAuthUrl(mockEnv, state, codeChallenge)

    expect(url).toContain(`state=${state}`)
    expect(url).toContain(`code_challenge=${codeChallenge}`)
  })
})

describe('exchangeCodeForTokens', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    mockFetch.mockReset()
  })

  it('should return tokens on success', async () => {
    const mockTokenResponse = {
      access_token: 'mock-access-token',
      expires_in: 3600,
      id_token: 'mock-id-token',
      scope: 'openid email profile',
      token_type: 'Bearer',
      refresh_token: 'mock-refresh-token',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    })

    const result = await exchangeCodeForTokens(mockEnv, 'auth-code', 'code-verifier')

    expect(result).toEqual(mockTokenResponse)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    )
  })

  it('should throw error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Invalid grant',
    })

    await expect(
      exchangeCodeForTokens(mockEnv, 'invalid-code', 'code-verifier')
    ).rejects.toThrow('Failed to exchange code: Invalid grant')
  })
})

describe('getGoogleUserInfo', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    mockFetch.mockReset()
  })

  it('should return user info on success', async () => {
    const mockUserInfo = {
      sub: 'google-123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
      given_name: 'Test',
      family_name: 'User',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUserInfo,
    })

    const result = await getGoogleUserInfo('mock-access-token')

    expect(result).toEqual(mockUserInfo)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: 'Bearer mock-access-token' },
      }
    )
  })

  it('should throw error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    })

    await expect(getGoogleUserInfo('invalid-token')).rejects.toThrow(
      'Failed to get user info from Google'
    )
  })
})

describe('decodeIdToken', () => {
  it('should decode valid JWT payload', () => {
    const payload = {
      sub: 'google-123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
      given_name: 'Test',
      family_name: 'User',
    }
    const token = createMockIdToken(payload)

    const result = decodeIdToken(token)

    expect(result.sub).toBe('google-123')
    expect(result.email).toBe('test@example.com')
    expect(result.email_verified).toBe(true)
    expect(result.name).toBe('Test User')
    expect(result.picture).toBe('https://example.com/photo.jpg')
    expect(result.given_name).toBe('Test')
    expect(result.family_name).toBe('User')
  })

  it('should throw error for invalid token format', () => {
    expect(() => decodeIdToken('invalid-token')).toThrow('Invalid ID token format')
    expect(() => decodeIdToken('only.two')).toThrow('Invalid ID token format')
    expect(() => decodeIdToken('')).toThrow('Invalid ID token format')
  })
})
