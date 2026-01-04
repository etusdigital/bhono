import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendInvitationEmail } from '@server/lib/email'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockEnv = {
  SENDGRID_API_KEY: 'test-api-key',
  SENDGRID_FROM_EMAIL: 'noreply@test.com',
} as any

describe('email library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendInvitationEmail', () => {
    const testData = {
      to: 'recipient@example.com',
      inviterName: 'John Doe',
      accountName: 'Acme Corp',
      inviteUrl: 'https://example.com/invite/abc123',
    }

    it('should call SendGrid API with correct payload', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await sendInvitationEmail(
        mockEnv,
        testData.to,
        testData.inviterName,
        testData.accountName,
        testData.inviteUrl
      )

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      )

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.personalizations).toEqual([{ to: [{ email: testData.to }] }])
      expect(body.from).toEqual({ email: 'noreply@test.com' })
      expect(body.content).toHaveLength(2)
      expect(body.content[0].type).toBe('text/plain')
      expect(body.content[1].type).toBe('text/html')
    })

    it('should include correct subject with inviter and account name', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await sendInvitationEmail(
        mockEnv,
        testData.to,
        testData.inviterName,
        testData.accountName,
        testData.inviteUrl
      )

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.subject).toBe(`${testData.inviterName} invited you to join "${testData.accountName}"`)
    })

    it('should include invite URL in email body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await sendInvitationEmail(
        mockEnv,
        testData.to,
        testData.inviterName,
        testData.accountName,
        testData.inviteUrl
      )

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      // Check text content contains the invite URL
      const textContent = body.content.find((c: any) => c.type === 'text/plain')
      expect(textContent.value).toContain(testData.inviteUrl)

      // Check HTML content contains the invite URL
      const htmlContent = body.content.find((c: any) => c.type === 'text/html')
      expect(htmlContent.value).toContain(testData.inviteUrl)
      expect(htmlContent.value).toContain(`href="${testData.inviteUrl}"`)
    })

    it('should throw error when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Unauthorized'),
      })

      await expect(
        sendInvitationEmail(
          mockEnv,
          testData.to,
          testData.inviterName,
          testData.accountName,
          testData.inviteUrl
        )
      ).rejects.toThrow('Failed to send email: Unauthorized')
    })
  })
})
