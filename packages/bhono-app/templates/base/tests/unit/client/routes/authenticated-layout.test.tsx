import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderRoute, setupFetchMock, mockUser, mockAccount } from '@tests/helpers/client-test-utils'

describe('Authenticated Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AuthenticatedLayout', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should render sidebar and main content area', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        // Sidebar should be visible
        expect(screen.getByRole('navigation')).toBeInTheDocument()
      })

      // Main content should be rendered
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should render dashboard page inside layout', async () => {
      renderRoute({ initialEntries: ['/dashboard'] })

      await waitFor(() => {
        // Dashboard shows "Welcome back, {firstName}"
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      })
    })

    it('should render settings page inside layout', async () => {
      renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
      })
    })

    it('should render team page inside layout', async () => {
      renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /team/i })).toBeInTheDocument()
      })
    })
  })

  describe('AuthenticatedPendingComponent', () => {
    it('should show loading skeleton while auth is pending', async () => {
      // Create a promise that never resolves to simulate pending state
      let resolveAuth: (value: Response) => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolveAuth = resolve
      })

      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/auth/me' || url.endsWith('/auth/me')) {
          return pendingPromise
        }
        if (url === '/accounts' || url.endsWith('/accounts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ accounts: [mockAccount] }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      renderRoute({ initialEntries: ['/dashboard'] })

      // Should show skeleton loading states
      await waitFor(() => {
        const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
      }, { timeout: 1000 })

      // Clean up by resolving the pending promise
      act(() => {
        resolveAuth!({
          ok: true,
          json: () => Promise.resolve({ user: mockUser }),
        } as Response)
      })
    })

    it('should show sidebar skeleton during loading', async () => {
      let resolveAuth: (value: Response) => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolveAuth = resolve
      })

      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/auth/me' || url.endsWith('/auth/me')) {
          return pendingPromise
        }
        if (url === '/accounts' || url.endsWith('/accounts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ accounts: [mockAccount] }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      renderRoute({ initialEntries: ['/dashboard'] })

      // Should show skeleton elements
      await waitFor(() => {
        const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
      }, { timeout: 1000 })

      // Clean up
      act(() => {
        resolveAuth!({
          ok: true,
          json: () => Promise.resolve({ user: mockUser }),
        } as Response)
      })
    })
  })

  describe('Redirect to login', () => {
    it('should redirect to login when not authenticated', async () => {
      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/auth/me' || url.endsWith('/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
          } as Response)
        }
        if (url === '/accounts' || url.endsWith('/accounts')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      const { router } = renderRoute({ initialEntries: ['/dashboard'] })

      // Should redirect to login
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/login')
      }, { timeout: 3000 })
    })

    it('should redirect from settings when not authenticated', async () => {
      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/auth/me' || url.endsWith('/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
          } as Response)
        }
        if (url === '/accounts' || url.endsWith('/accounts')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      const { router } = renderRoute({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/login')
      }, { timeout: 3000 })
    })

    it('should redirect from team when not authenticated', async () => {
      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/auth/me' || url.endsWith('/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
          } as Response)
        }
        if (url === '/accounts' || url.endsWith('/accounts')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      const { router } = renderRoute({ initialEntries: ['/team'] })

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/login')
      }, { timeout: 3000 })
    })
  })

})
