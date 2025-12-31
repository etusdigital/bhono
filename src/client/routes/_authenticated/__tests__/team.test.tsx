import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '../../../__tests__/test-utils'

// Mock user for authenticated tests
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  isSuperAdmin: false,
  avatarUrl: null,
}

// Default waitFor options with extended timeout
const waitOptions = { timeout: 5000 }

describe('Team Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch to return authenticated user
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: mockUser }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    })
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
    }, waitOptions)

    expect(screen.getByText(/1 member in your workspace/i)).toBeInTheDocument()
  })

  it('should show current user with "(you)" indicator and role badge', async () => {
    renderRoute({ initialEntries: ['/team'] })

    await waitFor(() => {
      expect(screen.getByText('(you)')).toBeInTheDocument()
      // Check owner role badge
      expect(screen.getByText('owner')).toBeInTheDocument()
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

    // Check action buttons
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
  })
})
