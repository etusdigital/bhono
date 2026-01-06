// src/server/routes/auth/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { auth } from '@server/routes/index'
import { createMockEnv } from '@tests/helpers/server'
import {
  createUserFixture,
  createSessionFixture,
} from '@tests/fixtures/server'

// Mock the session module
vi.mock('@server/lib/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/session')>()
  return {
    ...original,
    getSession: vi.fn(),
    createSession: vi.fn().mockResolvedValue('test-session-id'),
    destroySession: vi.fn().mockResolvedValue(),
  }
})

// Mock the oauth module
vi.mock('@server/lib/oauth', () => ({
  generateCodeVerifier: vi.fn(() => 'test-code-verifier'),
  generateCodeChallenge: vi.fn(async () => 'test-code-challenge'),
  generateState: vi.fn(() => 'test-state'),
  buildGoogleAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?test=true'),
  exchangeCodeForTokens: vi.fn(),
  decodeIdToken: vi.fn(),
}))

// Mock audit module
vi.mock('@server/lib/audit', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(),
}))

// Mock auth service
vi.mock('@server/services/auth', () => ({
  authService: {
    findOrCreateUser: vi.fn(),
    refreshAccessToken: vi.fn(),
  },
}))

// Mock invitations service
vi.mock('@server/services/invitations', () => ({
  invitationsService: {
    getByToken: vi.fn(),
    accept: vi.fn(),
  },
}))

import { getSession, destroySession } from '@server/lib/session'
import { authService } from '@server/services/auth'
import { invitationsService } from '@server/services/invitations'
import {
  exchangeCodeForTokens,
  decodeIdToken,
} from '@server/lib/oauth'

describe('Auth Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()

    // Create mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    }
  })

  // Helper to create app
  function createApp() {
    const app = new Hono<HonoEnv>()

    // Setup middleware to inject mock environment
    app.use('*', async (c, next) => {
      ;(c as any).env = mockEnv
      c.set('db', mockDb)
      c.set('transactionId', 'test-transaction-id')
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'TestAgent/1.0')
      c.set('sessionCookies', [])
      await next()
    })

    app.route('/auth', auth)
    return app
  }

  describe('GET /auth/login', () => {
    it('redirects to Google OAuth URL', async () => {
      const app = createApp()
      const res = await app.request('/auth/login', {
        method: 'GET',
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toContain('accounts.google.com')
    })

    it('sets oauth_state cookie', async () => {
      const app = createApp()
      const res = await app.request('/auth/login', {
        method: 'GET',
        redirect: 'manual',
      })

      const setCookie = res.headers.get('Set-Cookie')
      expect(setCookie).toContain('oauth_state')
    })

    it('accepts redirect query parameter', async () => {
      const app = createApp()
      // redirect must be a valid URL according to the schema
      const res = await app.request('/auth/login?redirect=http://localhost:3000/dashboard/settings', {
        method: 'GET',
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      // The redirect parameter should be stored in the cookie
      const setCookie = res.headers.get('Set-Cookie')
      expect(setCookie).toContain('oauth_state')
    })
  })

  describe('GET /auth/callback', () => {
    it('returns 500 when database is not initialized', async () => {
      // Create app without database binding
      const appWithoutDb = new Hono<HonoEnv>()
      appWithoutDb.use('*', async (c, next) => {
        // Set env without DB and don't set db in context
        ;(c as any).env = { ...mockEnv, DB: undefined }
        // Don't set c.set('db', ...) to simulate uninitialized database
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        c.set('sessionCookies', [])
        await next()
      })
      appWithoutDb.route('/auth', auth)

      const res = await appWithoutDb.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=' + encodeURIComponent(JSON.stringify({
            codeVerifier: 'test-verifier',
            state: 'test-state',
            redirect: null,
          })),
        },
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })

    it('returns 400 when missing OAuth state cookie', async () => {
      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Missing OAuth state cookie')
    })

    it('returns 400 when state mismatch', async () => {
      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=wrong-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=' + encodeURIComponent(JSON.stringify({
            codeVerifier: 'test-verifier',
            state: 'correct-state',
            redirect: null,
          })),
        },
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Invalid state parameter')
    })

    it('returns 400 when oauth_state cookie is invalid JSON', async () => {
      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=invalid-json-string',
        },
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Invalid OAuth state cookie')
    })

    it('creates session on successful callback', async () => {
      const testUser = createUserFixture({ id: 'user-123', email: 'test@example.com' })

      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        access_token: 'test-access-token',
        id_token: 'test-id-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      })

      vi.mocked(decodeIdToken).mockReturnValue({
        sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
      })

      vi.mocked(authService.findOrCreateUser).mockResolvedValue({
        user: testUser,
        isNew: false,
      })

      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=' + encodeURIComponent(JSON.stringify({
            codeVerifier: 'test-verifier',
            state: 'test-state',
            redirect: null,
          })),
        },
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toContain('/dashboard')
    })

    it('accepts pending invitation during callback', async () => {
      const testUser = createUserFixture({ id: 'user-123', email: 'test@example.com' })

      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        access_token: 'test-access-token',
        id_token: 'test-id-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      })

      vi.mocked(decodeIdToken).mockReturnValue({
        sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
      })

      vi.mocked(authService.findOrCreateUser).mockResolvedValue({
        user: testUser,
        isNew: false,
      })

      vi.mocked(invitationsService.getByToken).mockResolvedValue({
        id: 'invite-123',
        token: 'valid-invite-token',
        email: 'test@example.com',
        role: 'viewer',
        accountId: 'account-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      vi.mocked(invitationsService.accept).mockResolvedValue()

      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=' + encodeURIComponent(JSON.stringify({
            codeVerifier: 'test-verifier',
            state: 'test-state',
            redirect: null,
          })) + '; pending_invitation=valid-invite-token',
        },
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(invitationsService.getByToken).toHaveBeenCalledWith(expect.anything(), 'valid-invite-token')
      expect(invitationsService.accept).toHaveBeenCalled()
    })

    it('skips invitation acceptance when pending invitation is not found', async () => {
      const testUser = createUserFixture({ id: 'user-123', email: 'test@example.com' })

      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        access_token: 'test-access-token',
        id_token: 'test-id-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      })

      vi.mocked(decodeIdToken).mockReturnValue({
        sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
      })

      vi.mocked(authService.findOrCreateUser).mockResolvedValue({
        user: testUser,
        isNew: false,
      })

      // Invitation token exists in cookie but getByToken returns null (expired/invalid)
      vi.mocked(invitationsService.getByToken).mockResolvedValue(null)

      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=' + encodeURIComponent(JSON.stringify({
            codeVerifier: 'test-verifier',
            state: 'test-state',
            redirect: null,
          })) + '; pending_invitation=expired-invite-token',
        },
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(invitationsService.getByToken).toHaveBeenCalledWith(expect.anything(), 'expired-invite-token')
      // accept should NOT be called when invitation is not found
      expect(invitationsService.accept).not.toHaveBeenCalled()
    })

    it('uses custom redirect from oauth state', async () => {
      const testUser = createUserFixture({ id: 'user-123', email: 'test@example.com' })

      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        access_token: 'test-access-token',
        id_token: 'test-id-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      })

      vi.mocked(decodeIdToken).mockReturnValue({
        sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
      })

      vi.mocked(authService.findOrCreateUser).mockResolvedValue({
        user: testUser,
        isNew: false,
      })

      const app = createApp()
      const res = await app.request('/auth/callback?code=test-code&state=test-state', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=' + encodeURIComponent(JSON.stringify({
            codeVerifier: 'test-verifier',
            state: 'test-state',
            redirect: '/settings',
          })),
        },
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toContain('/settings')
    })
  })

  describe('POST /auth/logout', () => {
    it('returns 500 when database is not initialized', async () => {
      // Create app without database binding
      const appWithoutDb = new Hono<HonoEnv>()
      appWithoutDb.use('*', async (c, next) => {
        // Set env without DB and don't set db in context
        ;(c as any).env = { ...mockEnv, DB: undefined }
        // Don't set c.set('db', ...) to simulate uninitialized database
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        c.set('sessionCookies', [])
        await next()
      })
      appWithoutDb.route('/auth', auth)

      const res = await appWithoutDb.request('/auth/logout', {
        method: 'POST',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })

    it('logs out user and returns success message', async () => {
      const sessionData = createSessionFixture({ userId: 'user-123' })
      vi.mocked(getSession).mockReturnValue(sessionData)
      vi.mocked(destroySession).mockResolvedValue()

      const app = createApp()
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: 'sid=test-session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('Logged out successfully')
      expect(destroySession).toHaveBeenCalled()
    })

    it('succeeds even when no session exists', async () => {
      vi.mocked(getSession).mockReturnValue(null)
      vi.mocked(destroySession).mockResolvedValue()

      const app = createApp()
      const res = await app.request('/auth/logout', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('Logged out successfully')
    })
  })

  describe('GET /auth/me', () => {
    it('returns user when authenticated', async () => {
      const sessionData = createSessionFixture({
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isSuperAdmin: false,
      })
      vi.mocked(getSession).mockReturnValue(sessionData)

      const app = createApp()
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Cookie: 'sid=test-session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user).toBeDefined()
      expect(body.user.id).toBe('user-123')
      expect(body.user.email).toBe('test@example.com')
      expect(body.user.name).toBe('Test User')
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(getSession).mockReturnValue(null)

      const app = createApp()
      const res = await app.request('/auth/me', {
        method: 'GET',
      })

      expect(res.status).toBe(401)
      const body = await res.text()
      expect(body).toContain('Not authenticated')
    })

    it('includes user avatar and superAdmin status', async () => {
      const sessionData = createSessionFixture({
        userId: 'super-admin-1',
        email: 'admin@example.com',
        name: 'Super Admin',
        isSuperAdmin: true,
        avatarUrl: 'https://example.com/avatar.jpg',
      })
      vi.mocked(getSession).mockReturnValue(sessionData)

      const app = createApp()
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Cookie: 'sid=test-session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.isSuperAdmin).toBe(true)
      expect(body.user.avatarUrl).toBe('https://example.com/avatar.jpg')
    })
  })

  describe('POST /auth/refresh', () => {
    it('returns 500 when database is not initialized', async () => {
      // Create app without database binding
      const appWithoutDb = new Hono<HonoEnv>()
      appWithoutDb.use('*', async (c, next) => {
        // Set env without DB and don't set db in context
        ;(c as any).env = { ...mockEnv, DB: undefined }
        // Don't set c.set('db', ...) to simulate uninitialized database
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        c.set('sessionCookies', [])
        await next()
      })
      appWithoutDb.route('/auth', auth)

      const res = await appWithoutDb.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: 'refresh_token=valid-refresh-token',
        },
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })

    it('returns 401 when no refresh token', async () => {
      const app = createApp()
      const res = await app.request('/auth/refresh', {
        method: 'POST',
      })

      expect(res.status).toBe(401)
      const body = await res.text()
      expect(body).toContain('No refresh token')
    })

    it('returns new tokens when refresh token is valid', async () => {
      vi.mocked(authService.refreshAccessToken).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })

      const app = createApp()
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: 'refresh_token=valid-refresh-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.tokens).toBeDefined()
    })
  })

  describe('GET /auth/invite/{token}', () => {
    it('returns 500 when database is not initialized', async () => {
      // Create app without database binding
      const appWithoutDb = new Hono<HonoEnv>()
      appWithoutDb.use('*', async (c, next) => {
        // Set env without DB and don't set db in context
        ;(c as any).env = { ...mockEnv, DB: undefined }
        // Don't set c.set('db', ...) to simulate uninitialized database
        c.set('transactionId', 'test-transaction-id')
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'TestAgent/1.0')
        c.set('sessionCookies', [])
        await next()
      })
      appWithoutDb.route('/auth', auth)

      const res = await appWithoutDb.request('/auth/invite/some-token', {
        method: 'GET',
      })

      expect(res.status).toBe(500)
      const body = await res.text()
      expect(body).toContain('Database not initialized')
    })

    it('returns 400 for invalid invitation token', async () => {
      vi.mocked(invitationsService.getByToken).mockResolvedValue(null)

      const app = createApp()
      const res = await app.request('/auth/invite/invalid-token', {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toContain('Invalid or expired invitation')
    })

    it('stores invitation token and redirects to login', async () => {
      vi.mocked(invitationsService.getByToken).mockResolvedValue({
        id: 'invite-123',
        token: 'valid-token',
        email: 'invitee@example.com',
        role: 'viewer',
        accountId: 'account-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const app = createApp()
      const res = await app.request('/auth/invite/valid-token', {
        method: 'GET',
        redirect: 'manual',
      })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/auth/login')
      expect(res.headers.get('Set-Cookie')).toContain('pending_invitation')
    })
  })
})
