import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
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

  describe('SessionCard component', () => {
    it('should render current session with badge', async () => {
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
      })
      // Current session has the "Current" badge
      expect(screen.getByText('Current')).toBeInTheDocument()
      // Location and last active are combined in one text node
      expect(screen.getByText(/San Francisco, CA.*Active now/)).toBeInTheDocument()
    })

    it('should render non-current session with sign out button', async () => {
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Safari on iPhone')).toBeInTheDocument()
      })
      // Location and last active are combined in one text node
      expect(screen.getByText(/San Francisco, CA.*2 hours ago/)).toBeInTheDocument()
    })
  })

  describe('DeleteAccountDialog component', () => {
    it('should open delete dialog when clicking delete button', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      // Find and click the Delete button in Danger Zone
      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      // Dialog should open with warning content
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument()
      expect(screen.getByText('All your data will be permanently deleted')).toBeInTheDocument()
    })

    it('should close dialog when clicking cancel', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      // Open dialog
      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('should show validation error when email does not match', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      // Open dialog
      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Type wrong email
      const input = screen.getByPlaceholderText('Enter your email')
      await user.type(input, 'wrong@email.com')

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Delete Account/i })
      await user.click(submitButton)

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Digite seu email corretamente para confirmar')).toBeInTheDocument()
      })
    })

    it('should submit form when email matches', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      // Open dialog
      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Type correct email (from mockUser)
      const input = screen.getByPlaceholderText('Enter your email')
      await user.type(input, mockUser.email)

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Delete Account/i })
      await user.click(submitButton)

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })
    })

    it('should show validation error when submitting empty form', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      // Open dialog
      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Submit without typing anything
      const submitButton = screen.getByRole('button', { name: /Delete Account/i })
      await user.click(submitButton)

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Digite seu email corretamente para confirmar')).toBeInTheDocument()
      })
    })

    it('should show confirmation warning text in dialog', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      // Open dialog
      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Check all warning items are displayed
      expect(screen.getByText('All your data will be permanently deleted')).toBeInTheDocument()
      expect(screen.getByText('You will lose access to all workspaces')).toBeInTheDocument()
      expect(screen.getByText('This action is irreversible')).toBeInTheDocument()
    })
  })

  describe('Connect buttons', () => {
    it('should render Connect button for GitHub', async () => {
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument()
      })

      // Find Connect button near GitHub
      const connectButton = screen.getByRole('button', { name: /Connect/i })
      expect(connectButton).toBeInTheDocument()
    })

    it('should render Enable button for 2FA', async () => {
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
      })

      const enableButton = screen.getByRole('button', { name: 'Enable' })
      expect(enableButton).toBeInTheDocument()
    })

    it('should render Create Key button in API section', async () => {
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'API Access' })).toBeInTheDocument()
      })

      const createKeyButton = screen.getByRole('button', { name: /Create Key/i })
      expect(createKeyButton).toBeInTheDocument()
    })

    it('should render Export button in Danger Zone', async () => {
      renderRoute({ initialEntries: ['/account'] })

      await waitFor(() => {
        expect(screen.getByText('Export Data')).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: /Export/i })
      expect(exportButton).toBeInTheDocument()
    })
  })
})
