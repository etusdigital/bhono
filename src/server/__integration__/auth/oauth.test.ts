/**
 * OAuth Authentication Integration Tests
 *
 * Tests the OAuth login flow:
 * - Login redirect (initiates OAuth with PKCE)
 * - OAuth callback (code exchange, user creation, session creation)
 * - Invite flow via OAuth
 */

import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getEnv, getDb, getKV, type TestEnv } from '../setup'
import { createUser, createUserSession } from '../fixtures'
import type { HonoEnv } from '../../types'
import { auth } from '../../routes/auth'
import { sessionMiddleware } from '../../lib/session'
import { errorHandler } from '../../middleware/error-handler'
import { createAccount, addUserToAccount } from '../fixtures'
import { users } from '../../db/schema'

// Mock ID token for testing (base64url encoded)
function createMockIdToken(payload: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT' }
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const signature = 'mock_signature'
  return `${headerB64}.${payloadB64}.${signature}`
}

/**
 * Creates a database wrapper that adds the `execute` method
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('OAuth Authentication Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      ;(c as any).env = env

      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Apply session middleware
    app.use('*', sessionMiddleware())

    // Mount auth routes
    app.route('/auth', auth)
  })

  describe('GET /auth/login', () => {
    it('should redirect to Google OAuth with PKCE parameters', async () => {
      const res = await app.request('/auth/login', {
        method: 'GET',
        redirect: 'manual',
      })

      expect(res.status).toBe(302)

      const location = res.headers.get('location')
      expect(location).toBeTruthy()
      expect(location).toContain('accounts.google.com')
      expect(location).toContain('client_id=')
      expect(location).toContain('redirect_uri=')
      expect(location).toContain('response_type=code')
      expect(location).toContain('scope=openid+email+profile')
      expect(location).toContain('state=')
      expect(location).toContain('code_challenge=')
      expect(location).toContain('code_challenge_method=S256')
    })

    it('should set oauth_state cookie with code verifier and state', async () => {
      const res = await app.request('/auth/login', {
        method: 'GET',
        redirect: 'manual',
      })

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('oauth_state=')
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('Path=/')
    })

    it('should include redirect parameter in oauth state if provided', async () => {
      const redirectUrl = 'http://localhost:3000/dashboard'
      const res = await app.request(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`, {
        method: 'GET',
        redirect: 'manual',
      })

      expect(res.status).toBe(302)

      // The redirect should be stored in the oauth_state cookie
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('oauth_state=')

      // Extract cookie value
      const match = setCookie?.match(/oauth_state=([^;]+)/)
      if (match) {
        const cookieValue = decodeURIComponent(match[1])
        const oauthData = JSON.parse(cookieValue)
        expect(oauthData.redirect).toBe(redirectUrl)
      }
    })

    it('should store null redirect when not provided', async () => {
      const res = await app.request('/auth/login', {
        method: 'GET',
        redirect: 'manual',
      })

      const setCookie = res.headers.get('set-cookie')
      const match = setCookie?.match(/oauth_state=([^;]+)/)
      if (match) {
        const cookieValue = decodeURIComponent(match[1])
        const oauthData = JSON.parse(cookieValue)
        expect(oauthData.redirect).toBeNull()
      }
    })
  })

  describe('GET /auth/callback', () => {
    it('should return 400 when oauth_state cookie is missing', async () => {
      const res = await app.request('/auth/callback?code=test_code&state=test_state', {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Missing OAuth state cookie')
    })

    it('should return 400 when state parameter does not match', async () => {
      const oauthData = JSON.stringify({
        codeVerifier: 'test_verifier',
        state: 'expected_state',
        redirect: null,
      })

      const res = await app.request('/auth/callback?code=test_code&state=wrong_state', {
        method: 'GET',
        headers: {
          Cookie: `oauth_state=${encodeURIComponent(oauthData)}`,
        },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid state parameter')
    })

    it('should return 400 when oauth_state cookie is malformed', async () => {
      const res = await app.request('/auth/callback?code=test_code&state=test_state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=not-valid-json{',
        },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid OAuth state cookie')
    })

    it('should create new user on first OAuth callback', async () => {
      // Mock the global fetch to return Google tokens and user info
      const mockIdToken = createMockIdToken({
        sub: 'new_google_user_123',
        email: 'newuser@gmail.com',
        email_verified: true,
        name: 'New OAuth User',
        picture: 'https://example.com/avatar.jpg',
        given_name: 'New',
        family_name: 'User',
      })

      // The setup.ts mocks fetch for Google OAuth endpoints
      // We need to override the mock to return our specific user
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'mock_access_token',
              refresh_token: 'mock_refresh_token',
              expires_in: 3600,
              token_type: 'Bearer',
              id_token: mockIdToken,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        return originalFetch(input, init)
      }) as typeof fetch

      const oauthData = JSON.stringify({
        codeVerifier: 'test_verifier_string_long_enough_for_pkce',
        state: 'valid_state',
        redirect: null,
      })

      const res = await app.request('/auth/callback?code=valid_code&state=valid_state', {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Cookie: `oauth_state=${encodeURIComponent(oauthData)}`,
        },
      })

      // Should redirect after successful authentication
      expect(res.status).toBe(302)
      const location = res.headers.get('location')
      expect(location).toContain('/dashboard')

      // Should set session cookie
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('sid=')

      // Restore original fetch
      globalThis.fetch = originalFetch
    })

    it('should redirect to custom path when redirect is provided in oauth state', async () => {
      const mockIdToken = createMockIdToken({
        sub: 'google_user_redirect_test',
        email: 'redirecttest@gmail.com',
        email_verified: true,
        name: 'Redirect Test User',
        picture: null,
        given_name: 'Redirect',
        family_name: 'Test',
      })

      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'mock_access_token',
              id_token: mockIdToken,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        return originalFetch(input)
      }) as typeof fetch

      const oauthData = JSON.stringify({
        codeVerifier: 'test_verifier_string_long_enough_for_pkce',
        state: 'valid_state',
        redirect: '/settings/profile',
      })

      const res = await app.request('/auth/callback?code=valid_code&state=valid_state', {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Cookie: `oauth_state=${encodeURIComponent(oauthData)}`,
        },
      })

      expect(res.status).toBe(302)
      const location = res.headers.get('location')
      expect(location).toContain('/settings/profile')

      globalThis.fetch = originalFetch
    })

    it('should update existing user info on subsequent OAuth callback', async () => {
      // Create existing user
      const existingUser = await createUser({
        googleId: 'existing_google_id_456',
        email: 'existing@gmail.com',
        name: 'Old Name',
        avatarUrl: 'https://old-avatar.jpg',
      })

      const mockIdToken = createMockIdToken({
        sub: 'existing_google_id_456',
        email: 'newemail@gmail.com', // Changed email
        email_verified: true,
        name: 'New Updated Name', // Changed name
        picture: 'https://new-avatar.jpg', // Changed avatar
        given_name: 'New',
        family_name: 'Name',
      })

      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'mock_access_token',
              id_token: mockIdToken,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        return originalFetch(input)
      }) as typeof fetch

      const oauthData = JSON.stringify({
        codeVerifier: 'test_verifier_string_long_enough_for_pkce',
        state: 'valid_state',
        redirect: null,
      })

      const res = await app.request('/auth/callback?code=valid_code&state=valid_state', {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Cookie: `oauth_state=${encodeURIComponent(oauthData)}`,
        },
      })

      expect(res.status).toBe(302)

      // Verify user was updated in database
      const db = createTestDb()
      const result = await (db as any)
        .select()
        .from(users)
        .where(eq(users.id, existingUser.id))
        .limit(1)

      expect(result[0].name).toBe('New Updated Name')
      expect(result[0].email).toBe('newemail@gmail.com')
      expect(result[0].avatarUrl).toBe('https://new-avatar.jpg')

      globalThis.fetch = originalFetch
    })
  })

  describe('GET /auth/invite/:token', () => {
    it('should return 400 for invalid invitation token', async () => {
      const res = await app.request('/auth/invite/invalid-token-123', {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid or expired invitation')
    })

    it('should set pending_invitation cookie and redirect to login', async () => {
      // Create an invitation
      const account = await createAccount({ name: 'Invite Test Account' })
      const inviter = await createUser({ email: 'inviter@example.com', name: 'Inviter' })
      await addUserToAccount(inviter.id, account.id, 'ADMIN')

      // Create invitation directly in the database
      const db = createTestDb()
      const invitationId = crypto.randomUUID()
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      ;(db as any).run(
        require('drizzle-orm').sql`
          INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
          VALUES (${invitationId}, ${account.id}, ${'invitee@example.com'}, ${'EDITOR'}, ${token}, ${inviter.id}, ${expiresAt})
        `
      )

      const res = await app.request(`/auth/invite/${token}`, {
        method: 'GET',
        redirect: 'manual',
      })

      expect(res.status).toBe(302)

      const location = res.headers.get('location')
      expect(location).toContain('/auth/login')

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('pending_invitation=')
      expect(setCookie).toContain(token)
    })
  })
})
