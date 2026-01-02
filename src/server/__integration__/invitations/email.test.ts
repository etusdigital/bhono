/**
 * Invitation Email Integration Tests
 *
 * Tests the full invitation workflow including email sending:
 * - Email structure and content
 * - Invitation creation triggers email
 * - Email contains correct invitation link
 * - Error handling when email fails
 */

import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createAccount,
  addUserToAccount,
  createUserSession,
} from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { errorHandler } from '../../middleware/error-handler'
import { sessionMiddleware } from '../../lib/session'
import { sendInvitationEmail } from '../../lib/email'

// ============================================================================
// TEST SETUP
// ============================================================================

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

describe('Invitation Email Integration Tests', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      ;(c as any).env = env

      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    app.use('*', sessionMiddleware())
    app.route('/api', api)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // EMAIL STRUCTURE TESTS
  // ============================================================================

  describe('Email structure and content', () => {
    it('should send email with correct subject format', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'recipient@example.com',
        'John Smith',
        'Acme Corporation',
        'https://app.example.com/invite/abc123'
      )

      expect(fetchSpy).toHaveBeenCalled()
      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.subject).toBe('John Smith invited you to join "Acme Corporation"')
    })

    it('should include invitation link in both text and HTML content', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const inviteLink = 'https://app.example.com/invite/unique-token-123'

      await sendInvitationEmail(
        env,
        'recipient@example.com',
        'Jane Doe',
        'Test Company',
        inviteLink
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      // Check both text and HTML content contain the link
      expect(body.content[0].type).toBe('text/plain')
      expect(body.content[0].value).toContain(inviteLink)

      expect(body.content[1].type).toBe('text/html')
      expect(body.content[1].value).toContain(inviteLink)
    })

    it('should include expiration notice in email content', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'recipient@example.com',
        'Inviter Name',
        'Account Name',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      // Text content should mention expiration
      expect(body.content[0].value).toContain('expires in 7 days')
    })

    it('should use correct SendGrid API headers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'recipient@example.com',
        'Test Inviter',
        'Test Account',
        'https://example.com/invite/test'
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should use configured from email', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'recipient@example.com',
        'Test Inviter',
        'Test Account',
        'https://example.com/invite/test'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.from.email).toBe(env.SENDGRID_FROM_EMAIL)
    })
  })

  // ============================================================================
  // INVITATION CREATION WITH EMAIL
  // ============================================================================

  describe('Invitation creation triggers email', () => {
    it('should send email when creating invitation via API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const user = await createUser({
        email: 'admin-inviter@example.com',
        name: 'Admin Inviter',
      })
      const account = await createAccount({ name: 'Email Test Account' })
      await addUserToAccount(user.id, account.id, 'ADMIN')

      const { headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'new-invitee@example.com',
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)

      // Verify SendGrid was called
      const sendGridCalls = fetchSpy.mock.calls.filter(
        (call) => String(call[0]).includes('sendgrid')
      )
      expect(sendGridCalls.length).toBe(1)

      // Verify email content
      const emailCall = sendGridCalls[0]
      const requestInit = emailCall[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.personalizations[0].to[0].email).toBe('new-invitee@example.com')
      expect(body.subject).toContain('Admin Inviter')
      expect(body.subject).toContain('Email Test Account')
    })

    it('should include correct invitation URL in email', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const user = await createUser({
        email: 'url-inviter@example.com',
        name: 'URL Inviter',
      })
      const account = await createAccount({ name: 'URL Test Account' })
      await addUserToAccount(user.id, account.id, 'ADMIN')

      const { headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'url-check@example.com',
          role: 'EDITOR',
        }),
      })

      const sendGridCalls = fetchSpy.mock.calls.filter(
        (call) => String(call[0]).includes('sendgrid')
      )
      const emailCall = sendGridCalls[0]
      const requestInit = emailCall[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      // Email should contain the APP_URL
      expect(body.content[0].value).toContain(env.APP_URL)
      expect(body.content[1].value).toContain(env.APP_URL)

      // Should contain /invite/ path
      expect(body.content[0].value).toMatch(/\/invite\//)
      expect(body.content[1].value).toMatch(/\/invite\//)
    })

    it('should store invitation in database even if email succeeds', async () => {
      const user = await createUser({
        email: 'db-check-inviter@example.com',
        name: 'DB Check Inviter',
      })
      const account = await createAccount({ name: 'DB Check Account' })
      await addUserToAccount(user.id, account.id, 'ADMIN')

      const { headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      const inviteeEmail = 'db-check-invitee@example.com'

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteeEmail,
          role: 'VIEWER',
        }),
      })

      expect(res.status).toBe(200)

      // Verify invitation is stored in database
      const sqlite = getSqlite()
      const invitation = sqlite
        .prepare('SELECT * FROM invitations WHERE email = ? AND account_id = ?')
        .get(inviteeEmail, account.id) as any

      expect(invitation).toBeDefined()
      expect(invitation.email).toBe(inviteeEmail)
      expect(invitation.role).toBe('VIEWER')
      expect(invitation.invited_by_id).toBe(user.id)
    })
  })

  // ============================================================================
  // EMAIL ERROR HANDLING
  // ============================================================================

  describe('Email error handling', () => {
    it('should throw error when SendGrid returns non-202 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Invalid API key', { status: 401 })
      )

      await expect(
        sendInvitationEmail(
          env,
          'test@example.com',
          'Inviter',
          'Account',
          'https://example.com/invite/token'
        )
      ).rejects.toThrow('Failed to send email')
    })

    it('should throw error on network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      await expect(
        sendInvitationEmail(
          env,
          'test@example.com',
          'Inviter',
          'Account',
          'https://example.com/invite/token'
        )
      ).rejects.toThrow('Network error')
    })

    it('should handle SendGrid rate limiting', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Rate limit exceeded', { status: 429 })
      )

      await expect(
        sendInvitationEmail(
          env,
          'test@example.com',
          'Inviter',
          'Account',
          'https://example.com/invite/token'
        )
      ).rejects.toThrow('Failed to send email')
    })
  })

  // ============================================================================
  // SPECIAL CHARACTERS HANDLING
  // ============================================================================

  describe('Special characters in email content', () => {
    it('should handle special characters in inviter name', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        "O'Brien & Partners",
        'Test Account',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.subject).toContain("O'Brien & Partners")
    })

    it('should handle special characters in account name', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        'John Doe',
        'Café & Co. <Test>',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.subject).toContain('Café & Co. <Test>')
    })

    it('should handle unicode characters', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        '田中太郎',
        '株式会社テスト',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.subject).toContain('田中太郎')
      expect(body.subject).toContain('株式会社テスト')
    })
  })

  // ============================================================================
  // HTML EMAIL STRUCTURE
  // ============================================================================

  describe('HTML email structure', () => {
    it('should include proper HTML structure', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        'Inviter',
        'Account',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)
      const html = body.content[1].value

      // Check essential HTML structure
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html>')
      expect(html).toContain('</html>')
      expect(html).toContain('<head>')
      expect(html).toContain('</head>')
      expect(html).toContain('<body>')
      expect(html).toContain('</body>')
    })

    it('should include call-to-action button', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        'Inviter',
        'Account',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)
      const html = body.content[1].value

      expect(html).toContain('Accept Invitation')
      expect(html).toContain('class="button"')
    })

    it('should include responsive styles', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        'Inviter',
        'Account',
        'https://example.com/invite/token'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)
      const html = body.content[1].value

      // Should have container styling
      expect(html).toContain('class="container"')
    })
  })
})
