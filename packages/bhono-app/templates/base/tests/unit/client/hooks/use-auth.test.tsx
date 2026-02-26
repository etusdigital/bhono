import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useAuth } from "@/hooks/use-auth"
import type { AuthUser } from "@shared/types"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function createWrapperWithClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns loading state initially", () => {
    // Mock fetch that never resolves
    mockFetch.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it("returns null user when not authenticated", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("returns user when authenticated", async () => {
    const mockUser: AuthUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.png",
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    } as Response)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it("isAuthenticated is true when user exists", async () => {
    const mockUser: AuthUser = {
      id: "user-456",
      email: "auth@example.com",
      name: "Authenticated User",
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    } as Response)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  it("isAuthenticated is false when user is null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isAuthenticated).toBe(false)
  })

  it("logout calls the logout endpoint", async () => {
    const mockUser: AuthUser = {
      id: "user-789",
      email: "logout@example.com",
      name: "Logout User",
    }

    // First call is for fetchMe, second for logout
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
      } as Response)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.logout()
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    })
  })

  it("logout clears the user from cache", async () => {
    const mockUser: AuthUser = {
      id: "user-clear",
      email: "clear@example.com",
      name: "Clear Cache User",
    }

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })

    // First call is for fetchMe, second for logout
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
      } as Response)

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapperWithClient(queryClient),
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      result.current.logout()
    })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
    })

    // Verify the cache was updated
    const cachedData = queryClient.getQueryData(["auth", "me"])
    expect(cachedData).toBeNull()
  })

  it("isLoggingOut is true during logout", async () => {
    const mockUser: AuthUser = {
      id: "user-pending",
      email: "pending@example.com",
      name: "Pending User",
    }

    let resolveLogout: () => void
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      } as Response)
      .mockImplementationOnce(async () => {
        await logoutPromise
        return { ok: true }
      })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isLoggingOut).toBe(false)

    act(() => {
      result.current.logout()
    })

    await waitFor(() => {
      expect(result.current.isLoggingOut).toBe(true)
    })

    // Resolve the logout promise
    await act(async () => {
      resolveLogout!()
    })

    await waitFor(() => {
      expect(result.current.isLoggingOut).toBe(false)
    })
  })

  it("fetches user with correct credentials option", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/auth/me", {
        credentials: "include",
      })
    })
  })

  it("handles logout failure", async () => {
    const mockUser: AuthUser = {
      id: "user-fail",
      email: "fail@example.com",
      name: "Fail User",
    }

    // First call is for fetchMe (success), second for logout (failure)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.logout()
    })

    // Wait for the mutation to complete and error to be handled
    await waitFor(() => {
      expect(result.current.isLoggingOut).toBe(false)
    })

    // User should still be logged in since logout failed
    expect(result.current.user).toEqual(mockUser)
  })
})
