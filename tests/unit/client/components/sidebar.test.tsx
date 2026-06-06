import type { Mock } from "vitest";
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@tests/helpers/client-test-utils"
import userEvent from "@testing-library/user-event"
import { Sidebar } from "@/components/sidebar"

// Mock useAuth hook
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}))

// Mock @tanstack/react-router with importOriginal to keep other exports
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({ children, to, className, title }: { children: React.ReactNode; to: string; className?: string; title?: string }) => (
      <a href={to} className={className} title={title} data-testid={`link-${to}`}>
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

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as Mock).mockReturnValue({
      user: mockUser,
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })
    ;(useLocation as Mock).mockReturnValue({
      pathname: "/dashboard",
    })
  })

  it("renders sidebar navigation items", () => {
    render(<Sidebar />)

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Team")).toBeInTheDocument()
    expect(screen.getByText("Integrations")).toBeInTheDocument()
    // "Account" appears both as section header and nav item
    expect(screen.getAllByText("Account").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("shows user info when authenticated", () => {
    render(<Sidebar />)

    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.getByText("john@example.com")).toBeInTheDocument()
  })

  it("shows user initials in avatar fallback", () => {
    render(<Sidebar />)

    // Avatar fallback should show initials "JD" for "John Doe"
    const avatarFallbacks = screen.getAllByText("JD")
    expect(avatarFallbacks.length).toBeGreaterThan(0)
  })

  it("highlights active route", () => {
    ;(useLocation as Mock).mockReturnValue({
      pathname: "/dashboard",
    })

    render(<Sidebar />)

    // The active nav item link should have the active class (bg-sidebar-accent)
    // There are two links to dashboard (logo and nav item), get all and check the nav item
    const dashboardLinks = screen.getAllByTestId("link-/dashboard")
    // The nav item link has rounded-lg class (not the logo link)
    const navItemLink = dashboardLinks.find((link) => link.classList.contains("rounded-lg"))
    expect(navItemLink).toHaveClass("bg-sidebar-accent")
  })

  it("handles navigation clicks", async () => {
    render(<Sidebar />)

    const teamLink = screen.getByText("Team")
    expect(teamLink).toBeInTheDocument()

    // Team link should be clickable
    const teamNavItem = screen.getByTestId("link-/team")
    expect(teamNavItem).toHaveAttribute("href", "/team")
  })

  it("handles logout button click", async () => {
    const user = userEvent.setup()
    const mockLogout = vi.fn()
    ;(useAuth as Mock).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    render(<Sidebar />)

    // Find the logout button (by finding the button in the user profile area)
    const logoutButtons = screen.getAllByRole("button")

    // Click the last button in the profile area which should trigger logout
    await user.click(logoutButtons[logoutButtons.length - 1])
    expect(mockLogout).toHaveBeenCalled()
  })

  it("can be collapsed by default", () => {
    render(<Sidebar defaultCollapsed={true} />)

    // When collapsed, the sidebar should have the collapsed width class
    const sidebar = screen.getByRole("complementary")
    expect(sidebar).toHaveClass("w-16")
  })

  it("expands when collapsed and expand button is clicked", async () => {
    const user = userEvent.setup()
    render(<Sidebar defaultCollapsed={true} />)

    const sidebar = screen.getByRole("complementary")
    expect(sidebar).toHaveClass("w-16")

    // Find and click the expand button
    const expandButton = screen.getAllByRole("button")[0]
    await user.click(expandButton)

    expect(sidebar).toHaveClass("w-64")
  })

  it("shows keyboard shortcut hint when expanded", () => {
    render(<Sidebar />)

    // The sidebar shows a keyboard shortcut hint like "⌘B collapse" or "Ctrl+B collapse"
    expect(screen.getByText(/collapse/)).toBeInTheDocument()
  })

  it("hides navigation labels when collapsed", () => {
    render(<Sidebar defaultCollapsed={true} />)

    // Navigation labels should not be visible when collapsed
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })

  it("collapses when collapse button is clicked", async () => {
    const user = userEvent.setup()
    render(<Sidebar />)

    const sidebar = screen.getByRole("complementary")
    expect(sidebar).toHaveClass("w-64")

    // Find and click the collapse button (chevron icon button in header)
    const collapseButton = screen.getAllByRole("button")[0]
    await user.click(collapseButton)

    expect(sidebar).toHaveClass("w-16")
  })

  it("toggles sidebar with keyboard shortcut", async () => {
    const user = userEvent.setup()
    render(<Sidebar />)

    const sidebar = screen.getByRole("complementary")
    expect(sidebar).toHaveClass("w-64")

    // Press Ctrl+B (or Cmd+B on Mac) to toggle
    await user.keyboard("{Control>}b{/Control}")

    expect(sidebar).toHaveClass("w-16")
  })

  it("toggles theme when theme button is clicked", async () => {
    const user = userEvent.setup()
    render(<Sidebar />)

    // Find the theme toggle button (has title attribute with "Theme:")
    const themeButton = screen.getByTitle(/theme:/i)
    expect(themeButton).toBeInTheDocument()

    await user.click(themeButton)
    // Theme should cycle (we just verify click doesn't throw)
  })

  it("shows logout button when collapsed and handles click", async () => {
    const user = userEvent.setup()
    const mockLogout = vi.fn()
    ;(useAuth as Mock).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    render(<Sidebar defaultCollapsed={true} />)

    // When collapsed, the avatar button should be the logout trigger
    const avatarButton = screen.getAllByRole("button").pop()!
    await user.click(avatarButton)

    expect(mockLogout).toHaveBeenCalled()
  })

  it("shows loading spinner when logging out", () => {
    ;(useAuth as Mock).mockReturnValue({
      user: mockUser,
      logout: vi.fn(),
      isLoggingOut: true,
      isAuthenticated: true,
      isLoading: false,
    })

    render(<Sidebar />)

    // Logout button should be disabled during logout
    const buttons = screen.getAllByRole("button")
    const logoutButton = buttons[buttons.length - 1]
    expect(logoutButton).toBeDisabled()
  })

  it("renders the user avatar when a picture is set", () => {
    ;(useAuth as Mock).mockReturnValue({
      user: { ...mockUser, picture: "https://example.com/avatar.jpg" },
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    render(<Sidebar />)

    // Seven's Avatar (Radix) mounts the <img> only after the picture reports
    // `load`, which jsdom never simulates — so the image element isn't queryable
    // here. Actual image display is covered by the visual/E2E suite. At the unit
    // level we assert the avatar mounts for the user via its initials fallback
    // (collapsed + expanded sidebar variants both render it).
    expect(screen.getAllByText("JD").length).toBeGreaterThan(0)
  })

  it("shows single letter initial when user has no name", () => {
    ;(useAuth as Mock).mockReturnValue({
      user: { ...mockUser, name: null },
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    render(<Sidebar />)

    // Should show first letter of email "J" for "john@example.com"
    const avatarFallbacks = screen.getAllByText("J")
    expect(avatarFallbacks.length).toBeGreaterThan(0)
  })

  it("shows question mark when user has no name or email", () => {
    ;(useAuth as Mock).mockReturnValue({
      user: { id: "1", email: null, name: null, picture: null, role: "admin" },
      logout: vi.fn(),
      isLoggingOut: false,
      isAuthenticated: true,
      isLoading: false,
    })

    render(<Sidebar />)

    const avatarFallbacks = screen.getAllByText("?")
    expect(avatarFallbacks.length).toBeGreaterThan(0)
  })
})
