import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import { ThemeProvider, useTheme } from "../use-theme"

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", { value: localStorageMock })

// Mock matchMedia
let mediaQueryChangeHandler: ((e: MediaQueryListEvent) => void) | null = null
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
    if (event === "change") {
      mediaQueryChangeHandler = handler
    }
  }),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))
Object.defineProperty(window, "matchMedia", { value: mockMatchMedia })

function Wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

describe("useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    mediaQueryChangeHandler = null
    document.documentElement.classList.remove("light", "dark")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("throws error when used outside ThemeProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => {
      renderHook(() => useTheme())
    }).toThrow("useTheme must be used within a ThemeProvider")

    consoleSpy.mockRestore()
  })

  it("returns theme context when used within ThemeProvider", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    expect(result.current.theme).toBe("system")
    expect(result.current.resolvedTheme).toBe("light")
    expect(typeof result.current.setTheme).toBe("function")
  })

  it("applies theme class to document on mount", () => {
    renderHook(() => useTheme(), { wrapper: Wrapper })

    expect(document.documentElement.classList.contains("light")).toBe(true)
  })

  it("reads stored theme from localStorage", () => {
    localStorageMock.getItem.mockReturnValue("dark")

    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    expect(result.current.theme).toBe("dark")
    expect(result.current.resolvedTheme).toBe("dark")
  })

  it("setTheme updates theme and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    act(() => {
      result.current.setTheme("dark")
    })

    expect(result.current.theme).toBe("dark")
    expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "dark")
  })

  it("updates resolved theme when system theme changes", () => {
    // Start with system theme preference
    localStorageMock.getItem.mockReturnValue("system")

    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    expect(result.current.theme).toBe("system")
    expect(result.current.resolvedTheme).toBe("light") // matchMedia returns false by default

    // Simulate system theme change to dark
    act(() => {
      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: true } as MediaQueryListEvent)
      }
    })

    expect(result.current.resolvedTheme).toBe("dark")

    // Simulate system theme change back to light
    act(() => {
      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: false } as MediaQueryListEvent)
      }
    })

    expect(result.current.resolvedTheme).toBe("light")
  })

  it("ignores system theme changes when explicit theme is set", () => {
    localStorageMock.getItem.mockReturnValue("light")

    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    expect(result.current.theme).toBe("light")
    expect(result.current.resolvedTheme).toBe("light")

    // Simulate system theme change to dark
    act(() => {
      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: true } as MediaQueryListEvent)
      }
    })

    // Should still be light because explicit theme is set
    expect(result.current.resolvedTheme).toBe("light")
  })

  it("applies dark class when dark theme is set", () => {
    localStorageMock.getItem.mockReturnValue("dark")

    renderHook(() => useTheme(), { wrapper: Wrapper })

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.classList.contains("light")).toBe(false)
  })

  it("handles invalid stored theme gracefully", () => {
    localStorageMock.getItem.mockReturnValue("invalid-theme")

    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    // Should default to system
    expect(result.current.theme).toBe("system")
  })

  it("removes previous theme class when switching themes", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: Wrapper })

    // Start with light (default)
    expect(document.documentElement.classList.contains("light")).toBe(true)

    act(() => {
      result.current.setTheme("dark")
    })

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.classList.contains("light")).toBe(false)
  })
})
