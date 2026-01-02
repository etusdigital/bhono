import { describe, it, expect } from "vitest"
import { render, screen } from "../../../__tests__/test-utils"
import { createRef } from "react"
import { Skeleton } from "../skeleton"

describe("Skeleton", () => {
  it("renders a skeleton element", () => {
    render(<Skeleton data-testid="skeleton" />)

    expect(screen.getByTestId("skeleton")).toBeInTheDocument()
  })

  it("applies default styles", () => {
    render(<Skeleton data-testid="skeleton" />)

    const skeleton = screen.getByTestId("skeleton")
    expect(skeleton).toHaveClass("animate-pulse")
    expect(skeleton).toHaveClass("rounded-md")
    expect(skeleton).toHaveClass("bg-muted")
  })

  it("applies custom className", () => {
    render(<Skeleton data-testid="skeleton" className="h-8 w-32" />)

    const skeleton = screen.getByTestId("skeleton")
    expect(skeleton).toHaveClass("h-8")
    expect(skeleton).toHaveClass("w-32")
    expect(skeleton).toHaveClass("animate-pulse") // Still has default
  })

  it("renders as div element", () => {
    render(<Skeleton data-testid="skeleton" />)

    const skeleton = screen.getByTestId("skeleton")
    expect(skeleton.tagName).toBe("DIV")
  })

  it("passes through additional props", () => {
    render(<Skeleton data-testid="skeleton" aria-label="Loading..." />)

    const skeleton = screen.getByTestId("skeleton")
    expect(skeleton).toHaveAttribute("aria-label", "Loading...")
  })
})
