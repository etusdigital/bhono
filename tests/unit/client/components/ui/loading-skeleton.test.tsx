import { describe, it, expect } from "vitest"
import { render, screen } from "@tests/helpers/client-test-utils"
import {
  DashboardSkeleton,
  TeamSkeleton,
  PageSkeleton,
  SidebarSkeleton,
} from "@/components/ui/loading-skeleton"

describe("DashboardSkeleton", () => {
  it("renders dashboard skeleton structure", () => {
    const { container } = render(<DashboardSkeleton />)

    // Should have skeleton elements
    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders stats cards skeleton", () => {
    const { container } = render(<DashboardSkeleton />)

    // Should have 4 stats cards
    const cards = container.querySelectorAll(".rounded-lg.border")
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })

  it("renders quick actions skeleton", () => {
    const { container } = render(<DashboardSkeleton />)

    // Should have grid layout for actions
    const grids = container.querySelectorAll(".grid")
    expect(grids.length).toBeGreaterThanOrEqual(2)
  })
})

describe("TeamSkeleton", () => {
  it("renders team skeleton structure", () => {
    const { container } = render(<TeamSkeleton />)

    // Should have skeleton elements
    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders header with title and button placeholders", () => {
    const { container } = render(<TeamSkeleton />)

    // Header section with flex layout
    const headerSection = container.querySelector(".flex.flex-col")
    expect(headerSection).toBeInTheDocument()
  })

  it("renders search skeleton", () => {
    const { container } = render(<TeamSkeleton />)

    // Search input skeleton (h-10 w-full max-w-sm)
    const searchSkeleton = container.querySelector(".h-10.max-w-sm")
    expect(searchSkeleton).toBeInTheDocument()
  })

  it("renders team member list skeletons", () => {
    const { container } = render(<TeamSkeleton />)

    // Should have avatar placeholders (rounded-full)
    const avatarSkeletons = container.querySelectorAll(".rounded-full")
    expect(avatarSkeletons.length).toBeGreaterThanOrEqual(3)
  })
})

describe("PageSkeleton", () => {
  it("renders page skeleton structure", () => {
    const { container } = render(<PageSkeleton />)

    // Should have skeleton elements
    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders header skeleton", () => {
    const { container } = render(<PageSkeleton />)

    // Title skeleton (h-8 w-48)
    const titleSkeleton = container.querySelector(".h-8.w-48")
    expect(titleSkeleton).toBeInTheDocument()
  })

  it("renders content card with lines", () => {
    const { container } = render(<PageSkeleton />)

    // Should have content lines (h-4 w-full)
    const contentLines = container.querySelectorAll(".h-4.w-full")
    expect(contentLines.length).toBeGreaterThanOrEqual(4)
  })
})

describe("SidebarSkeleton", () => {
  it("renders sidebar skeleton structure", () => {
    const { container } = render(<SidebarSkeleton />)

    // Should be an aside element
    const sidebar = container.querySelector("aside")
    expect(sidebar).toBeInTheDocument()
  })

  it("renders with correct width", () => {
    const { container } = render(<SidebarSkeleton />)

    const sidebar = container.querySelector("aside")
    expect(sidebar).toHaveClass("w-64")
  })

  it("renders header with logo placeholder", () => {
    const { container } = render(<SidebarSkeleton />)

    // Logo skeleton (h-8 w-8 rounded-lg)
    const logoSkeleton = container.querySelector(".h-8.w-8.rounded-lg")
    expect(logoSkeleton).toBeInTheDocument()
  })

  it("renders navigation skeletons", () => {
    const { container } = render(<SidebarSkeleton />)

    // Nav element
    const nav = container.querySelector("nav")
    expect(nav).toBeInTheDocument()

    // Navigation item skeletons (h-10 w-full rounded-lg)
    const navItems = container.querySelectorAll(".h-10.w-full.rounded-lg")
    expect(navItems.length).toBeGreaterThanOrEqual(5)
  })

  it("renders user profile skeleton at bottom", () => {
    const { container } = render(<SidebarSkeleton />)

    // User avatar skeleton (h-9 w-9 rounded-full)
    const userAvatar = container.querySelector(".h-9.w-9.rounded-full")
    expect(userAvatar).toBeInTheDocument()
  })
})
