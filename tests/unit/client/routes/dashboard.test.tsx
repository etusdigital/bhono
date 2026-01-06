import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoute, setupFetchMock, mockUser } from '@tests/helpers/client-test-utils'

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should render dashboard when authenticated', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })
    })

    it('should display user first name in welcome message', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText(/welcome back, test/i)).toBeInTheDocument()
      })
    })

    it('should display dashboard stats cards', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument()
      })

      expect(screen.getByText('Accounts')).toBeInTheDocument()
      expect(screen.getByText('API Requests')).toBeInTheDocument()
      expect(screen.getByText('Uptime')).toBeInTheDocument()
    })

    it('should show navigation sidebar', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })

      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Integrations')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should display user information in sidebar', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText(mockUser.name)).toBeInTheDocument()
      })

      expect(screen.getByText(mockUser.email)).toBeInTheDocument()
    })

    it('should display quick action cards', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText('Invite Team Members')).toBeInTheDocument()
      })

      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
    })

    it('should display recent activity section', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })

      expect(screen.getByText('No recent activity')).toBeInTheDocument()
    })
  })

  describe('when unauthenticated', () => {
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

    it('should redirect to login when not authenticated', async () => {
      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(
        () => {
          expect(router.state.location.pathname).toBe('/login')
        },
        { timeout: 3000 }
      )
    })
  })
})
