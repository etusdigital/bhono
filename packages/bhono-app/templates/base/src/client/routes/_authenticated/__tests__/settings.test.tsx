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

describe('Settings Page', () => {
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

  describe('page rendering', () => {
    it('should render with correct title "Settings"', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
      })
    })

    it('should display page description', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByText('Manage your account settings and preferences.')).toBeInTheDocument()
      })
    })

    it('should display all three tabs', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('tab', { name: /account/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
    })
  })

  describe('tab navigation', () => {
    it('should show Profile tab as default active tab', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        const profileTab = screen.getByRole('tab', { name: /profile/i })
        expect(profileTab).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('should switch to Account tab when clicked', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /account/i })).toBeInTheDocument()
      })

      const accountTab = screen.getByRole('tab', { name: /account/i })
      await user.click(accountTab)

      await waitFor(() => {
        expect(accountTab).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByText('Connected Accounts')).toBeInTheDocument()
      })
    })

    it('should switch to Notifications tab when clicked', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      })

      const notificationsTab = screen.getByRole('tab', { name: /notifications/i })
      await user.click(notificationsTab)

      await waitFor(() => {
        expect(notificationsTab).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByText('Email Notifications')).toBeInTheDocument()
      })
    })
  })

  describe('Profile tab', () => {
    it('should display profile picture section', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByText('Profile Picture')).toBeInTheDocument()
      })

      expect(screen.getByText('Your profile picture is visible to other team members.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument()
    })

    it('should display user initials in avatar', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        // User initials appear in both sidebar and settings page avatar
        const initialsElements = screen.getAllByText('TU')
        expect(initialsElements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('should display personal information form', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByText('Personal Information')).toBeInTheDocument()
      })

      // Labels are rendered via FormLabel and Label components
      expect(screen.getByText('Full Name')).toBeInTheDocument()
      expect(screen.getByText('Email Address')).toBeInTheDocument()
      // Input fields are present
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    })

    it('should have name input that can be edited', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Personal Information')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Name input should be editable
      const nameInput = screen.getByPlaceholderText('Enter your name')
      await user.clear(nameInput)
      await user.type(nameInput, 'New Name')
      expect(nameInput).toHaveValue('New Name')
    })

    it('should have disabled email input with user email', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Personal Information')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Email input should be disabled
      const emailInput = screen.getByPlaceholderText('Enter your email')
      expect(emailInput).toBeDisabled()
    })

    it('should display "Save Changes" button', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      })
    })
  })

  describe('Account tab', () => {
    it('should display connected accounts section with Google provider', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /account/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: /account/i }))

      await waitFor(() => {
        expect(screen.getByText('Connected Accounts')).toBeInTheDocument()
      })

      expect(screen.getByText('Manage your connected OAuth providers.')).toBeInTheDocument()
      expect(screen.getByText('Google')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('should display sessions and danger zone sections', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /account/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /account/i }))

      await waitFor(() => {
        expect(screen.getByText('Sessions')).toBeInTheDocument()
      }, { timeout: 10000 })

      expect(screen.getByText('Current Session')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Danger Zone')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
    })
  })

  describe('Notifications tab', () => {
    it('should display email notifications section', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        expect(screen.getByText('Choose what emails you want to receive.')).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should display all notification toggle options', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        expect(screen.getByText('Team Invitations')).toBeInTheDocument()
        expect(screen.getByText('Product Updates')).toBeInTheDocument()
        expect(screen.getByText('Security Alerts')).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should display toggle switches for notification options', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        const toggles = screen.getAllByRole('switch')
        expect(toggles).toHaveLength(3)
      }, { timeout: 10000 })
    })

    it('should have toggles checked by default', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        const toggles = screen.getAllByRole('switch')
        toggles.forEach((toggle) => {
          expect(toggle).toHaveAttribute('aria-checked', 'true')
        })
      }, { timeout: 10000 })
    })
  })

  describe('Profile form submission', () => {
    it('should submit form when Save Changes is clicked', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      // Button should be enabled initially
      const saveButton = screen.getByRole('button', { name: /save changes/i })
      expect(saveButton).toBeEnabled()

      // Click save changes should not throw
      await user.click(saveButton)
    })

    it('should show loading state during form submission', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Update name and submit
      const nameInput = screen.getByPlaceholderText('Enter your name')
      await user.clear(nameInput)
      await user.type(nameInput, 'New Name')

      const saveButton = screen.getByRole('button', { name: /save changes/i })
      await user.click(saveButton)

      // Button should show loading
      await waitFor(() => {
        expect(saveButton).toBeDisabled()
      })
    })
  })

  describe('NotificationToggle component', () => {
    it('should toggle off when clicked', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        expect(screen.getByText('Team Invitations')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Find the first toggle (Team Invitations)
      const toggles = screen.getAllByRole('switch')
      const teamInvitationsToggle = toggles[0]

      // Should be checked initially
      expect(teamInvitationsToggle).toHaveAttribute('aria-checked', 'true')

      // Click to toggle off
      await user.click(teamInvitationsToggle)

      // Should now be unchecked
      await waitFor(() => {
        expect(teamInvitationsToggle).toHaveAttribute('aria-checked', 'false')
      })
    })

    it('should toggle Product Updates', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        expect(screen.getByText('Product Updates')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Find the second toggle (Product Updates)
      const toggles = screen.getAllByRole('switch')
      const productUpdatesToggle = toggles[1]

      // Click to toggle
      await user.click(productUpdatesToggle)

      await waitFor(() => {
        expect(productUpdatesToggle).toHaveAttribute('aria-checked', 'false')
      })
    })

    it('should not toggle disabled Security Alerts switch', async () => {
      const user = userEvent.setup()
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
      }, { timeout: 10000 })

      await user.click(screen.getByRole('tab', { name: /notifications/i }))

      await waitFor(() => {
        expect(screen.getByText('Security Alerts')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Find the third toggle (Security Alerts - disabled)
      const toggles = screen.getAllByRole('switch')
      const securityToggle = toggles[2]

      // Should be disabled
      expect(securityToggle).toBeDisabled()

      // Should remain checked even after click attempt
      expect(securityToggle).toHaveAttribute('aria-checked', 'true')
    })
  })
})
