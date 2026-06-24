import type { Mock } from "vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@tests/helpers/client-test-utils"
import userEvent from "@testing-library/user-event"
import { SidebarProvider } from "@etus/seven-react"
import { AppSidebar } from "@/components/sidebar"

// Mock useAuth hook
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}))

// Mock @tanstack/react-router Link/useLocation (keep the rest)
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      "aria-current": ariaCurrent,
    }: {
      children: React.ReactNode
      to: string
      "aria-current"?: "page"
    }) => (
      <a aria-current={ariaCurrent} data-testid={`link-${to}`} href={to}>
        {children}
      </a>
    ),
    useLocation: vi.fn(),
  }
})

import { useAuth } from "@/hooks/use-auth"
import { useLocation } from "@tanstack/react-router"

const mockUser = {
  id: "1",
  email: "john@example.com",
  name: "John Doe",
  picture: null,
  role: "admin",
}

// AppSidebar reads useSidebar(), so it must render inside a SidebarProvider.
function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>,
  )
}

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as Mock).mockReturnValue({
      user: mockUser,
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })
    ;(useLocation as Mock).mockReturnValue({ pathname: "/dashboard" })
  })

  it("renders the navigation items", () => {
    renderSidebar()

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Team")).toBeInTheDocument()
    expect(screen.getByText("Workspaces")).toBeInTheDocument()
    expect(screen.getByText("Integrations")).toBeInTheDocument()
    // "Account" appears as both a group label and a nav item
    expect(screen.getAllByText("Account").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("shows the authenticated user's name and email", () => {
    renderSidebar()

    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.getByText("john@example.com")).toBeInTheDocument()
  })

  it("shows the user initials in the avatar fallback", () => {
    renderSidebar()

    expect(screen.getAllByText("JD").length).toBeGreaterThan(0)
  })

  it("marks the active route with aria-current", () => {
    ;(useLocation as Mock).mockReturnValue({ pathname: "/dashboard" })
    renderSidebar()

    // Target the nav item via its label (the logo also links to /dashboard)
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("Team").closest("a")).not.toHaveAttribute("aria-current", "page")
  })

  it("links each item to its route", () => {
    renderSidebar()

    expect(screen.getByTestId("link-/team")).toHaveAttribute("href", "/team")
    expect(screen.getByTestId("link-/settings")).toHaveAttribute("href", "/settings")
  })

  it("persists a theme change when the theme toggle is clicked", async () => {
    const user = userEvent.setup()
    renderSidebar()

    const before = localStorage.getItem("theme")
    await user.click(screen.getByText("Theme"))

    // The toggle must actually drive + persist the theme (light → dark → system → …),
    // not just render — a render-only test can't catch a broken toggle (Rule 6).
    const after = localStorage.getItem("theme")
    expect(after).toMatch(/^(light|dark|system)$/)
    expect(after).not.toBe(before)
  })

  it("logs out from the user menu", async () => {
    const user = userEvent.setup()
    const mockLogout = vi.fn()
    ;(useAuth as Mock).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    renderSidebar()

    await user.click(screen.getByRole("button", { name: /john doe/i }))
    await user.click(await screen.findByText("Sign out"))
    expect(mockLogout).toHaveBeenCalled()
  })

  it("falls back to a single initial when the user has no name", () => {
    ;(useAuth as Mock).mockReturnValue({
      user: { ...mockUser, name: null },
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    renderSidebar()

    expect(screen.getAllByText("J").length).toBeGreaterThan(0)
  })

  it("falls back to '?' when the user has no name or email", () => {
    ;(useAuth as Mock).mockReturnValue({
      user: { id: "1", email: null, name: null, picture: null, role: "admin" },
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    renderSidebar()

    expect(screen.getAllByText("?").length).toBeGreaterThan(0)
  })
})
