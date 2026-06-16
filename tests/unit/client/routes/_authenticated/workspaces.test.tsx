import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoute, setupFetchMock } from '@tests/helpers/client-test-utils'

// Build a /api/me handler for the gateway account context the page reads via
// useGatewayAccounts. (The default mock returns {} → the empty state.)
function meResponse(accounts: unknown[], superAdmin = false) {
  return () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ accounts, superAdmin }),
    } as Response)
}

describe('Workspaces Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the title and description', async () => {
    setupFetchMock()
    renderRoute({ initialEntries: ['/workspaces'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Workspaces' })).toBeInTheDocument()
    })
    expect(screen.getByText(/the role you hold in each/i)).toBeInTheDocument()
  })

  it('shows the empty state when the user has no gateway workspaces', async () => {
    setupFetchMock() // default /api/me → {} → no accounts
    renderRoute({ initialEntries: ['/workspaces'] })

    await waitFor(() => {
      expect(screen.getByText(/No workspaces yet/i)).toBeInTheDocument()
    })
  })

  it('renders a card per gateway account with its role and blurb', async () => {
    setupFetchMock({
      '/api/me': meResponse([
        { id: 'gw-initech', slug: 'initech', name: 'Initech', role: 'admin' },
        { id: 'gw-acme', slug: 'acme', name: 'Acme Corporation', role: 'viewer' },
      ]),
    })
    renderRoute({ initialEntries: ['/workspaces'] })

    await waitFor(() => {
      expect(screen.getByText('Initech')).toBeInTheDocument()
    })
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    // Per-account role badges (the over-grant scenario: admin on one, viewer on another).
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
    // The blurb mirrors ACCOUNT_ROLE_MAP at the UI level.
    expect(screen.getByText(/Read-only access to resources/i)).toBeInTheDocument()
  })

  it('shows the super-admin banner when the user is a super admin', async () => {
    setupFetchMock({ '/api/me': meResponse([], true) })
    renderRoute({ initialEntries: ['/workspaces'] })

    await waitFor(() => {
      expect(screen.getByText('Super admin')).toBeInTheDocument()
    })
    expect(screen.getByText(/admin-level access across every workspace/i)).toBeInTheDocument()
  })
})
