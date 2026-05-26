import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '@tests/helpers/client-test-utils'

function mockResponse(init: Pick<Response, 'ok' | 'status'>): Response {
  return {
    ...init,
    json: () => Promise.resolve({}),
  } as Response
}

function setupDefaultFetch() {
  vi.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

    if (url === '/auth/me') {
      return Promise.resolve(mockResponse({ ok: false, status: 401 }))
    }

    if (url === '/invitations/test-token-123/accept') {
      return Promise.resolve(mockResponse({ ok: true, status: 200 }))
    }

    return Promise.resolve(mockResponse({ ok: true, status: 200 }))
  })
}

describe('Invite Token Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultFetch()
  })

  describe('pending invitation state', () => {
    it('renders the public invitation acceptance page', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByText("You've been invited")).toBeInTheDocument()
      })

      expect(screen.getByText(/accept this invitation to join the workspace/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
    })

    it('shows a decline link to the homepage', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByText('Decline')).toBeInTheDocument()
      })

      const declineLink = screen.getByText('Decline').closest('a')
      expect(declineLink).toHaveAttribute('href', '/')
    })

    it('has a logo link to homepage', async () => {
      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /hono/i })).toBeInTheDocument()
      })
    })
  })

  describe('acceptance flow', () => {
    it('posts the token to @etus/auth and shows success when accepted', async () => {
      const user = userEvent.setup()

      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      const acceptButton = await screen.findByRole('button', { name: /accept invitation/i })
      await user.click(acceptButton)

      expect(global.fetch).toHaveBeenCalledWith('/invitations/test-token-123/accept', {
        method: 'POST',
        credentials: 'include',
      })
      await waitFor(() => {
        expect(screen.getByText('Invitation accepted')).toBeInTheDocument()
      })
    })

    it('shows and disables the loading button while accepting', async () => {
      const user = userEvent.setup()
      let resolveAccept: (response: Response) => void = () => {}

      vi.mocked(global.fetch).mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

        if (url === '/auth/me') {
          return Promise.resolve(mockResponse({ ok: false, status: 401 }))
        }

        if (url === '/invitations/test-token-123/accept') {
          return new Promise<Response>((resolve) => {
            resolveAccept = resolve
          })
        }

        return Promise.resolve(mockResponse({ ok: true, status: 200 }))
      })

      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      const acceptButton = await screen.findByRole('button', { name: /accept invitation/i })
      await user.click(acceptButton)

      const loadingButton = screen.getByRole('button', { name: /accepting/i })
      expect(loadingButton).toBeDisabled()

      resolveAccept(mockResponse({ ok: true, status: 200 }))
    })

    it('shows an error state when the invitation cannot be accepted', async () => {
      const user = userEvent.setup()

      vi.mocked(global.fetch).mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

        if (url === '/auth/me') {
          return Promise.resolve(mockResponse({ ok: false, status: 401 }))
        }

        if (url === '/invitations/test-token-123/accept') {
          return Promise.resolve(mockResponse({ ok: false, status: 404 }))
        }

        return Promise.resolve(mockResponse({ ok: true, status: 200 }))
      })

      renderRoute({ initialEntries: ['/invite/test-token-123'] })

      const acceptButton = await screen.findByRole('button', { name: /accept invitation/i })
      await user.click(acceptButton)

      await waitFor(() => {
        expect(screen.getByText('Invitation could not be accepted')).toBeInTheDocument()
      })
    })
  })
})
