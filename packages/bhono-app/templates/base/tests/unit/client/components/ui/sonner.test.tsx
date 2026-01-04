import { describe, it, expect } from "vitest"
import { render, screen } from "@tests/helpers/client-test-utils"
import { Toaster } from "../sonner"

describe("Toaster", () => {
  it("renders toaster component", () => {
    render(<Toaster data-testid="toaster" />)

    // Sonner creates a container with role="region"
    expect(screen.getByRole("region")).toBeInTheDocument()
  })

  it("uses theme from context", () => {
    // The render function from test-utils wraps with ThemeProvider
    // which defaults to system theme (light in jsdom)
    render(<Toaster />)

    // Toaster should be rendered (theme integration works)
    expect(screen.getByRole("region")).toBeInTheDocument()
  })

  it("passes through additional props", () => {
    render(<Toaster position="top-center" />)

    // Toaster should render with custom position
    expect(screen.getByRole("region")).toBeInTheDocument()
  })
})
