import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { render, screen } from "../../__tests__/test-utils"
import userEvent from "@testing-library/user-event"
import { Sidebar } from "../sidebar"

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
  avatarUrl: null,
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
      pathname: "/__authenticated/dashboard",
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
      pathname: "/__authenticated/dashboard",
    })

    render(<Sidebar />)

    // The active nav item link should have the active class (bg-sidebar-accent)
    // There are two links to dashboard (logo and nav item), get all and check the nav item
    const dashboardLinks = screen.getAllByTestId("link-/__authenticated/dashboard")
    // The nav item link has rounded-lg class (not the logo link)
    const navItemLink = dashboardLinks.find((link) => link.classList.contains("rounded-lg"))
    expect(navItemLink).toHaveClass("bg-sidebar-accent")
  })

  it("handles navigation clicks", async () => {
    render(<Sidebar />)

    const teamLink = screen.getByText("Team")
    expect(teamLink).toBeInTheDocument()

    // Team link should be clickable
    const teamNavItem = screen.getByTestId("link-/__authenticated/team")
    expect(teamNavItem).toHaveAttribute("href", "/__authenticated/team")
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
    // The logout button is one of the buttons in the sidebar
    const logoutButton = logoutButtons.find(
      (btn) => btn.querySelector('[class*="logout"]') || btn.closest('[class*="p-3"]')
    )

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

    expect(screen.getByText("to collapse")).toBeInTheDocument()
  })

  it("hides navigation labels when collapsed", () => {
    render(<Sidebar defaultCollapsed={true} />)

    // Navigation labels should not be visible when collapsed
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })
})
