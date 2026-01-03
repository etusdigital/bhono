import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '../test-utils'

// Mock user for authenticated tests
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  isSuperAdmin: false,
  avatarUrl: null,
}

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticated navigation', () => {
    beforeEach(() => {
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

    it('should navigate from dashboard to team page', async () => {
      const user = userEvent.setup()
      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })

      // Click on Team link in sidebar
      const teamLink = screen.getByRole('link', { name: /team/i })
      await user.click(teamLink)

      // Sidebar links use clean paths (pathless layout route)
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/team')
      })
    })

    it('should navigate from dashboard to settings page', async () => {
      const user = userEvent.setup()
      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })

      // Click on Settings link in sidebar
      const settingsLink = screen.getByRole('link', { name: /settings/i })
      await user.click(settingsLink)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/settings')
      })
    })

    it('should navigate from dashboard to integrations page', async () => {
      const user = userEvent.setup()
      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })

      // Click on Integrations link in sidebar
      const integrationsLink = screen.getByRole('link', { name: /integrations/i })
      await user.click(integrationsLink)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/integrations')
      })
    })

    it('should navigate from dashboard to account page', async () => {
      const user = userEvent.setup()
      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })

      // Click on Account link in sidebar
      const accountLink = screen.getByRole('link', { name: /account/i })
      await user.click(accountLink)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/account')
      })
    })
  })

  describe('unauthenticated navigation', () => {
    beforeEach(() => {
      // Mock fetch to return unauthenticated
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

    it('should redirect unauthenticated users from dashboard to login', async () => {
      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      // Wait for redirect to complete - router needs time to process beforeLoad
      await waitFor(
        () => {
          expect(router.state.location.pathname).toBe('/login')
        },
        { timeout: 3000 }
      )
    })

    it('should redirect unauthenticated users from settings to login', async () => {
      const { router } = renderRoute({ initialEntries: ['/settings'] })

      await waitFor(
        () => {
          expect(router.state.location.pathname).toBe('/login')
        },
        { timeout: 3000 }
      )
    })

    it('should redirect unauthenticated users from team to login', async () => {
      const { router } = renderRoute({ initialEntries: ['/team'] })

      await waitFor(
        () => {
          expect(router.state.location.pathname).toBe('/login')
        },
        { timeout: 3000 }
      )
    })

    it('should allow access to home page without authentication', async () => {
      const { router } = renderRoute({ initialEntries: ['/'] })

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/')
      })

      expect(screen.getByText('Build your SaaS')).toBeInTheDocument()
    })

    it('should allow access to login page without authentication', async () => {
      const { router } = renderRoute({ initialEntries: ['/login'] })

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/login')
      })

      expect(screen.getByText('Welcome back')).toBeInTheDocument()
    })
  })

  describe('404 handling', () => {
    beforeEach(() => {
      // Mock fetch to return unauthenticated
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

    it('should render 404 page for unknown routes', async () => {
      renderRoute({ initialEntries: ['/some-nonexistent-route'] })

      await waitFor(() => {
        expect(screen.getByText('Page not found')).toBeInTheDocument()
      })
    })

    it('should display 404 text on not found page', async () => {
      renderRoute({ initialEntries: ['/unknown-path'] })

      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument()
      })
    })

    it('should have navigation options on 404 page', async () => {
      renderRoute({ initialEntries: ['/missing-page'] })

      await waitFor(() => {
        expect(screen.getByText('Page not found')).toBeInTheDocument()
      })

      // Find the navigation links by their text content
      // These are wrapped in Button with asChild, so we search by text
      expect(screen.getByText('Back to Home')).toBeInTheDocument()
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    })
  })

  describe('home page navigation', () => {
    beforeEach(() => {
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

    it('should display navigation links on home page', async () => {
      renderRoute({ initialEntries: ['/'] })

      // Wait for home page to load
      await waitFor(() => {
        expect(screen.getByText('Build your SaaS')).toBeInTheDocument()
      })

      // Verify navigation elements are present
      expect(screen.getByText('Sign in')).toBeInTheDocument()
      expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0)
    })

    it('should have correct link destinations on home page', async () => {
      renderRoute({ initialEntries: ['/'] })

      // Wait for home page to load
      await waitFor(() => {
        expect(screen.getByText('Build your SaaS')).toBeInTheDocument()
      })

      // Check that the Sign in link points to login
      const signInLink = screen.getByText('Sign in').closest('a')
      expect(signInLink).toHaveAttribute('href', '/login')
    })
  })
})
