import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute, setupFetchMock } from '@tests/helpers/client-test-utils'

// Default waitFor options with extended timeout
const waitOptions = { timeout: 5000 }

describe('Team Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFetchMock()
  })

  it('should render page with correct title and description', async () => {
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /team members/i })).toBeInTheDocument()
    }, waitOptions)

    expect(screen.getByText(/manage your team and invite new members/i)).toBeInTheDocument()
  })

  it('should display Active Members section with member count', async () => {
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      expect(screen.getByText('Active Members')).toBeInTheDocument()
      expect(screen.getByText(/1 member in your workspace/i)).toBeInTheDocument()
    }, waitOptions)
  })

  it('should show current user with "(you)" indicator and role badge', async () => {
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      expect(screen.getByText('(you)')).toBeInTheDocument()
      expect(screen.getByText('admin')).toBeInTheDocument()
    }, waitOptions)
  })

  it('should render search input that filters team members', async () => {
    const user = userEvent.setup()
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument()
    }, waitOptions)

    const searchInput = screen.getByPlaceholderText('Search members...')
    await user.type(searchInput, 'nonexistent')

    await waitFor(() => {
      expect(screen.getByText(/no members found matching your search/i)).toBeInTheDocument()
    }, waitOptions)
  })

  it('should have invite member button that can be clicked', async () => {
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      // There are nested buttons due to DialogTrigger asChild, verify at least one exists
      const inviteButtons = screen.getAllByRole('button', { name: /invite member/i })
      expect(inviteButtons.length).toBeGreaterThanOrEqual(1)
    }, waitOptions)
  })

  it('should display Pending Invitations section with invitation details', async () => {
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument()
    }, waitOptions)

    // Check invitation count
    expect(screen.getByText(/1 pending invitation/i)).toBeInTheDocument()

    // Check pending invitation email
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()

    // Check Pending badge
    expect(screen.getByText('Pending')).toBeInTheDocument()

    // Check expiration info
    expect(screen.getByText(/expires in \d+ days?/i)).toBeInTheDocument()

    // Check action button
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
  })

  describe('Invite Dialog', () => {
    it('should open invite dialog when clicking invite button', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      const inviteButton = screen.getByRole('button', { name: /invite member/i })
      await user.click(inviteButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument()
      expect(screen.getByText(/send an invitation to join your workspace/i)).toBeInTheDocument()
    })

    it('should close dialog when clicking cancel', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /invite member/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('should show email input field in dialog', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /invite member/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Email input should be present
      expect(screen.getByPlaceholderText('colleague@example.com')).toBeInTheDocument()
    })

    it('should toggle between member and admin roles', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /invite member/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Default should show member description
      expect(screen.getByText(/members can view and collaborate on projects/i)).toBeInTheDocument()

      // Click Admin button
      await user.click(screen.getByRole('button', { name: /admin/i }))

      // Should show admin description
      await waitFor(() => {
        expect(screen.getByText(/admins can manage team settings and members/i)).toBeInTheDocument()
      })
    })

    it('should submit form with valid email', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /invite member/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Type valid email
      await user.type(screen.getByPlaceholderText('colleague@example.com'), 'newmember@example.com')

      // Submit form
      await user.click(screen.getByRole('button', { name: /send invitation/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/accounts/test-account-id/members/invite',
          expect.objectContaining({ method: 'POST' }),
        )
      })
    })
  })

  describe('InvitationRow actions', () => {
    it('should handle revoke button click', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
      }, waitOptions)

      // Click revoke
      const revokeButton = screen.getByRole('button', { name: /revoke/i })
      await user.click(revokeButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/accounts/test-account-id/invitations/test-invitation-id',
          expect.objectContaining({ method: 'DELETE' }),
        )
      })
    })
  })

  describe('TeamMemberRow', () => {
    it('should display member info and (you) indicator', async () => {
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        // "(you)" indicator should be present for current user
        expect(screen.getByText('(you)')).toBeInTheDocument()
      }, waitOptions)
    })

    it('should show role badge', async () => {
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        const adminBadge = screen.getByText('admin')
        expect(adminBadge).toBeInTheDocument()
      }, waitOptions)
    })
  })

  describe('Invite dialog form elements', () => {
    it('should show email label and description in invite dialog', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /invite member/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Check form labels are present
      expect(screen.getByText('Email Address')).toBeInTheDocument()
      expect(screen.getByText('Role')).toBeInTheDocument()
    })

    it('should display Send Invitation submit button', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      }, waitOptions)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /invite member/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Check submit button exists
      expect(screen.getByRole('button', { name: /send invitation/i })).toBeInTheDocument()
    })
  })

  describe('Search functionality edge cases', () => {
    it('should be case-insensitive when searching', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument()
      }, waitOptions)

      // Search with different case
      const searchInput = screen.getByPlaceholderText('Search members...')
      await user.type(searchInput, 'TEST')

      // Should still find the user (case-insensitive)
      await waitFor(() => {
        // The current user email is test@example.com which should match TEST
        expect(screen.queryByText(/no members found/i)).not.toBeInTheDocument()
      })
    })

    it('should clear search results when input is cleared', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument()
      }, waitOptions)

      const searchInput = screen.getByPlaceholderText('Search members...')

      // Search for something that doesn't exist
      await user.type(searchInput, 'nonexistent')

      await waitFor(() => {
        expect(screen.getByText(/no members found/i)).toBeInTheDocument()
      })

      // Clear the search
      await user.clear(searchInput)

      // Results should reappear
      await waitFor(() => {
        expect(screen.queryByText(/no members found/i)).not.toBeInTheDocument()
      })
    })
  })
})
