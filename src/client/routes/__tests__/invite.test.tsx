import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '../../__tests__/test-utils'

describe('Invite Token Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock fetch - the invite page is public, no auth needed
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    })
  })

  describe('pending invitation state', () => {
    it('should render invitation page with inviter name and workspace', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByText("You've Been Invited!")).toBeInTheDocument()
      })

      // Inviter name and workspace in the description
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      // Acme Inc appears in both the description and details
      expect(screen.getAllByText('Acme Inc').length).toBeGreaterThanOrEqual(1)
    })

    it('should display invitation details (email, workspace, role)', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByText("You've Been Invited!")).toBeInTheDocument()
      })

      // Email
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('invited@example.com')).toBeInTheDocument()

      // Workspace
      expect(screen.getByText('Workspace')).toBeInTheDocument()
      // Acme Inc appears twice (in description and details)
      expect(screen.getAllByText('Acme Inc')).toHaveLength(2)

      // Role
      expect(screen.getByText('Role')).toBeInTheDocument()
      expect(screen.getByText('member')).toBeInTheDocument()
    })

    it('should display accept invitation button', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
      })
    })

    it('should display decline button linking to homepage', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByText('Decline')).toBeInTheDocument()
      })

      // The decline text is inside a link which is inside a button (asChild pattern)
      const declineLink = screen.getByText('Decline').closest('a')
      expect(declineLink).toHaveAttribute('href', '/')
    })

    it('should show terms of service and privacy policy links', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByText('Terms of Service')).toBeInTheDocument()
      })

      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
    })

    it('should have a logo link to homepage', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /hono/i })).toBeInTheDocument()
      })
    })
  })

  describe('accepting invitation', () => {
    it('should show loading state when accepting invitation', async () => {
      const user = userEvent.setup()

      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
      })

      // Click accept button
      await user.click(screen.getByRole('button', { name: /accept invitation/i }))

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Accepting...')).toBeInTheDocument()
      })

      // Button should be disabled during loading
      expect(screen.getByRole('button', { name: /accepting/i })).toBeDisabled()
    })

    it(
      'should show accepted state after successful acceptance',
      async () => {
        const user = userEvent.setup()

        renderRoute({ initialEntries: ['/invite/test-token-123'] })

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
        })

        // Click accept button
        await user.click(screen.getByRole('button', { name: /accept invitation/i }))

        // Wait for acceptance to complete (1500ms simulated delay)
        await waitFor(
          () => {
            expect(screen.getByText('Welcome to Acme Inc!')).toBeInTheDocument()
          },
          { timeout: 5000 }
        )

        // Should show success message
        expect(
          screen.getByText("Your invitation has been accepted. You're now a member of the team.")
        ).toBeInTheDocument()

        // Should show dashboard link
        expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument()
      },
      { timeout: 10000 }
    )
  })
})
