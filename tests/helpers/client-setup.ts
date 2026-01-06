import "@testing-library/jest-dom/vitest"
import "../../src/test/vitest-zod-matcher"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

// Mock user and account for tests
const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  isSuperAdmin: false,
  avatarUrl: null,
}

const mockAccount = {
  id: "test-account-id",
  name: "Test Account",
  description: null,
  domain: null,
  status: "active" as const,
  role: "admin" as const,
  isCurrent: true,
}

// Setup global fetch mock for common API endpoints
beforeEach(() => {
  const originalFetch = global.fetch
  vi.spyOn(global, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input.toString()

    // Mock /auth/me
    if (url === "/auth/me" || url.endsWith("/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      } as Response)
    }

    // Mock /api/accounts/my
    if (url === "/api/accounts/my" || url.endsWith("/api/accounts/my")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [mockAccount],
            currentAccountId: mockAccount.id,
          }),
      } as Response)
    }

    // Default mock for other URLs
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response)
  })
})

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Mock window.matchMedia (needed for some components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(window, "localStorage", { value: localStorageMock })
