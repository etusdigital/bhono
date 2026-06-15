import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useGatewayAccounts } from '@/hooks/use-gateway-accounts'

const mockFetch = vi.fn()
global.fetch = mockFetch

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response

describe('useGatewayAccounts', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it("exposes the user's gateway accounts and super-admin flag from /api/me", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        accounts: [{ id: 'a', slug: 'unum', name: 'Unum', role: 'manager' }],
        superAdmin: false,
      }),
    )
    const { result } = renderHook(() => useGatewayAccounts(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.accounts).toEqual([
      { id: 'a', slug: 'unum', name: 'Unum', role: 'manager' },
    ])
    expect(result.current.superAdmin).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith('/api/me', { credentials: 'include' })
  })

  it('hasAccountRole respects the cumulative hierarchy', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        accounts: [{ id: 'a', slug: 'unum', name: 'Unum', role: 'manager' }],
        superAdmin: false,
      }),
    )
    const { result } = renderHook(() => useGatewayAccounts(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasAccountRole('unum', 'editor')).toBe(true) // manager >= editor
    expect(result.current.hasAccountRole('unum', 'admin')).toBe(false) // manager < admin
    expect(result.current.hasAccountRole('outro', 'viewer')).toBe(false) // not a member
  })

  it('super-admin passes every account-role check', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ accounts: [], superAdmin: true }))
    const { result } = renderHook(() => useGatewayAccounts(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasAccountRole('anything', 'admin')).toBe(true)
  })

  it('falls back to a safe empty shape when /api/me fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response)
    const { result } = renderHook(() => useGatewayAccounts(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.accounts).toEqual([])
    expect(result.current.superAdmin).toBe(false)
  })
})
