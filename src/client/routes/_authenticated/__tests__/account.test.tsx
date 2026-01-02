import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoute } from '../../../__tests__/test-utils'

// Mock user for authenticated tests
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  isSuperAdmin: false,
  avatarUrl: null,
}

describe('Account Page', () => {
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

  it('should render page with correct title "Account"', async () => {
    renderRoute({ initialEntries: ['/account'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Account', level: 1 })).toBeInTheDocument()
    })
    expect(screen.getByText(/manage your account settings, security, and connected services/i)).toBeInTheDocument()
  })

  it('should show Connected Accounts section with Google connected', async () => {
    renderRoute({ initialEntries: ['/account'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Connected Accounts' })).toBeInTheDocument()
    })
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Primary login method')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Not connected')).toBeInTheDocument()
  })

  it('should show Security section with Two-Factor Authentication', async () => {
    renderRoute({ initialEntries: ['/account'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument()
    })
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
    expect(screen.getByText('Recommended')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
  })

  it('should render Active Sessions section with session cards', async () => {
    renderRoute({ initialEntries: ['/account'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Active Sessions' })).toBeInTheDocument()
    })
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
    expect(screen.getByText('Safari on iPhone')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out all' })).toBeInTheDocument()
  })

  it('should show Danger Zone section with delete button', async () => {
    renderRoute({ initialEntries: ['/account'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument()
    })
    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Delete Account')).toBeInTheDocument()
    expect(screen.getByText('Permanently delete your account and data.')).toBeInTheDocument()
  })

  it('should show API Access section', async () => {
    renderRoute({ initialEntries: ['/account'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'API Access' })).toBeInTheDocument()
    })
    expect(screen.getByText('No API keys created yet')).toBeInTheDocument()
  })
})
