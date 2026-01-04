import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '@tests/helpers/client-test-utils'

describe('Login Page', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Mock fetch to return unauthenticated by default
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

  it('should render login page at /login route', async () => {
    renderRoute({ initialEntries: ['/login'] })

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeInTheDocument()
    })

    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument()
  })

  it('should display Google OAuth login button', async () => {
    renderRoute({ initialEntries: ['/login'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    })
  })

  it('should render login content without waiting for authentication', async () => {
    // Login page is public - should render immediately without blocking on auth
    const { container } = renderRoute({ initialEntries: ['/login'] })

    // Login page should render quickly without spinner/loading state
    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeInTheDocument()
    })

    // All interactive elements should be available immediately
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument()

    // Should not show any loading indicators
    expect(container.querySelector('[data-loading]')).not.toBeInTheDocument()
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

  it('should trigger OAuth flow when clicking login button', async () => {
    const user = userEvent.setup()

    // Mock window.location.href with try/finally for guaranteed cleanup
    const originalLocation = window.location
    const locationMock = {
      ...originalLocation,
      href: '',
    }
    Object.defineProperty(window, 'location', {
      value: locationMock,
      writable: true,
    })

    try {
      renderRoute({ initialEntries: ['/login'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /continue with google/i }))

      expect(window.location.href).toBe('/auth/login')
    } finally {
      // Restore original location even if test fails
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      })
    }
  })

  it('should show Terms of Service and Privacy Policy links', async () => {
    renderRoute({ initialEntries: ['/login'] })

    await waitFor(() => {
      expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    })

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('should have a link back to home page', async () => {
    renderRoute({ initialEntries: ['/login'] })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /hono/i })).toBeInTheDocument()
    })
  })
})
