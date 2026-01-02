/**
 * Email Utility Functions Integration Tests
 *
 * Tests the email sending functionality with mocked SendGrid API.
 * The fetch mock is set up in setup.ts and returns 202 for SendGrid requests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEnv, type TestEnv } from '../setup'
import { sendInvitationEmail } from '../../lib/email'

describe('Email Utility Functions', () => {
  let env: TestEnv

  beforeEach(() => {
    env = getEnv()
    vi.clearAllMocks()
  })

  describe('sendInvitationEmail', () => {
    it('should send an invitation email successfully', async () => {
      await expect(
        sendInvitationEmail(
          env,
          'invitee@example.com',
          'John Doe',
          'Acme Corp',
          'https://app.example.com/invite/abc123'
        )
      ).resolves.toBeUndefined()
    })

    it('should call SendGrid API with correct payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'test@example.com',
        'Jane Smith',
        'Test Account',
        'https://app.example.com/invite/xyz789'
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should include correct email content', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'recipient@test.com',
        'Alice Johnson',
        'My Team',
        'https://example.com/invite/token123'
      )

      // Get the body from the call
      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      // Check personalizations (recipient)
      expect(body.personalizations[0].to[0].email).toBe('recipient@test.com')

      // Check from email
      expect(body.from.email).toBe(env.SENDGRID_FROM_EMAIL)

      // Check subject
      expect(body.subject).toBe('Alice Johnson invited you to join "My Team"')

      // Check content includes both text and html
      expect(body.content).toHaveLength(2)
      expect(body.content[0].type).toBe('text/plain')
      expect(body.content[1].type).toBe('text/html')

      // Check text content includes key information
      expect(body.content[0].value).toContain('Alice Johnson')
      expect(body.content[0].value).toContain('My Team')
      expect(body.content[0].value).toContain('https://example.com/invite/token123')
      expect(body.content[0].value).toContain('expires in 7 days')

      // Check HTML content includes key information
      expect(body.content[1].value).toContain('Alice Johnson')
      expect(body.content[1].value).toContain('My Team')
      expect(body.content[1].value).toContain('https://example.com/invite/token123')
      expect(body.content[1].value).toContain('Accept Invitation')
    })

    it('should handle special characters in names', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'user@example.com',
        "O'Brien",
        'Café & Co',
        'https://example.com/invite/abc'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)

      expect(body.subject).toBe("O'Brien invited you to join \"Café & Co\"")
    })

    it('should throw error when SendGrid returns non-202 status', async () => {
      // Override the mock for this test to return an error
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Invalid API key', { status: 401 })
      )

      await expect(
        sendInvitationEmail(
          env,
          'test@example.com',
          'John',
          'Account',
          'https://example.com/invite/test'
        )
      ).rejects.toThrow('Failed to send email: Invalid API key')
    })

    it('should throw error on network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      await expect(
        sendInvitationEmail(
          env,
          'test@example.com',
          'John',
          'Account',
          'https://example.com/invite/test'
        )
      ).rejects.toThrow('Network error')
    })

    it('should include proper HTML structure', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await sendInvitationEmail(
        env,
        'user@test.com',
        'Inviter',
        'Team',
        'https://example.com/invite/html-test'
      )

      const callArgs = fetchSpy.mock.calls[0]
      const requestInit = callArgs[1] as RequestInit
      const body = JSON.parse(requestInit.body as string)
      const html = body.content[1].value

      // Check HTML structure
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html>')
      expect(html).toContain('<head>')
      expect(html).toContain('<body>')
      expect(html).toContain('class="container"')
      expect(html).toContain('class="button"')
      expect(html).toContain('class="footer"')
    })
  })
})
