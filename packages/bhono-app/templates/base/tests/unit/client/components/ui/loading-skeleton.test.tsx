import { describe, it, expect } from "vitest"
import { render, screen } from "@tests/helpers/client-test-utils"
import {
  DashboardSkeleton,
  TeamSkeleton,
  PageSkeleton,
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

    // Should have 4 stats cards. Count the children of the stats grid (our own
    // markup) rather than Card's internal classes, which are owned by @etus/ui.
    const statsGrid = container.querySelector('[class*="grid-cols-4"]')
    expect(statsGrid?.children.length).toBe(4)
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
