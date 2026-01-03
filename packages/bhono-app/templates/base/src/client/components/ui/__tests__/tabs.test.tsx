import { describe, it, expect, vi } from "vitest"
import { render, screen } from "../../../__tests__/test-utils"
import userEvent from "@testing-library/user-event"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs"

describe("Tabs", () => {
  it("renders with defaultValue", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    // Both tabs should be visible
    expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Tab 2" })).toBeInTheDocument()

    // Only tab1 content should be rendered
    expect(screen.getByText("Content 1")).toBeInTheDocument()
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument()
  })

  it("shows active state on TabsTrigger via aria-selected", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    const tab1 = screen.getByRole("tab", { name: "Tab 1" })
    const tab2 = screen.getByRole("tab", { name: "Tab 2" })

    expect(tab1).toHaveAttribute("aria-selected", "true")
    expect(tab1).toHaveAttribute("data-state", "active")

    expect(tab2).toHaveAttribute("aria-selected", "false")
    expect(tab2).toHaveAttribute("data-state", "inactive")
  })

  it("changes active tab when TabsTrigger is clicked", async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    // Initially tab1 is selected
    expect(screen.getByText("Content 1")).toBeInTheDocument()
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument()

    // Click tab2
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))

    // Now tab2 should be selected
    const tab1 = screen.getByRole("tab", { name: "Tab 1" })
    const tab2 = screen.getByRole("tab", { name: "Tab 2" })

    expect(tab1).toHaveAttribute("aria-selected", "false")
    expect(tab2).toHaveAttribute("aria-selected", "true")

    expect(screen.queryByText("Content 1")).not.toBeInTheDocument()
    expect(screen.getByText("Content 2")).toBeInTheDocument()
  })

  it("renders TabsContent only when its tab is selected", async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="first">
        <TabsList>
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="second">Second</TabsTrigger>
          <TabsTrigger value="third">Third</TabsTrigger>
        </TabsList>
        <TabsContent value="first">First Content</TabsContent>
        <TabsContent value="second">Second Content</TabsContent>
        <TabsContent value="third">Third Content</TabsContent>
      </Tabs>
    )

    // Initially only first content is visible
    expect(screen.getByText("First Content")).toBeInTheDocument()
    expect(screen.queryByText("Second Content")).not.toBeInTheDocument()
    expect(screen.queryByText("Third Content")).not.toBeInTheDocument()

    // Switch to second tab
    await user.click(screen.getByRole("tab", { name: "Second" }))
    expect(screen.queryByText("First Content")).not.toBeInTheDocument()
    expect(screen.getByText("Second Content")).toBeInTheDocument()
    expect(screen.queryByText("Third Content")).not.toBeInTheDocument()

    // Switch to third tab
    await user.click(screen.getByRole("tab", { name: "Third" }))
    expect(screen.queryByText("First Content")).not.toBeInTheDocument()
    expect(screen.queryByText("Second Content")).not.toBeInTheDocument()
    expect(screen.getByText("Third Content")).toBeInTheDocument()
  })

  it("supports controlled mode with value and onValueChange", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <Tabs value="tab1" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    // Tab 1 is selected
    expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Content 1")).toBeInTheDocument()

    // Click tab 2
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))

    // onValueChange should be called with the new value
    expect(onValueChange).toHaveBeenCalledWith("tab2")

    // In controlled mode, content doesn't change unless parent updates value
    // Since we passed value="tab1", it should still show tab1 content
    expect(screen.getByText("Content 1")).toBeInTheDocument()
  })

  it("updates display when controlled value changes", () => {
    const { rerender } = render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByText("Content 1")).toBeInTheDocument()
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument()

    // Re-render with new value
    rerender(
      <Tabs value="tab2" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.queryByText("Content 1")).not.toBeInTheDocument()
    expect(screen.getByText("Content 2")).toBeInTheDocument()
  })
})

describe("TabsTrigger", () => {
  it("throws error when used outside Tabs provider", () => {
    // Suppress console.error for this test since we expect an error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => {
      render(<TabsTrigger value="test">Test Tab</TabsTrigger>)
    }).toThrow("Tabs components must be used within a Tabs provider")

    consoleSpy.mockRestore()
  })
})

describe("TabsContent", () => {
  it("throws error when used outside Tabs provider", () => {
    // Suppress console.error for this test since we expect an error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => {
      render(<TabsContent value="test">Test Content</TabsContent>)
    }).toThrow("Tabs components must be used within a Tabs provider")

    consoleSpy.mockRestore()
  })

  it("has tabpanel role when rendered", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole("tabpanel")).toBeInTheDocument()
  })
})

describe("TabsList", () => {
  it("renders children correctly", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    )

    const tabsList = screen.getByTestId("tabs-list")
    expect(tabsList).toBeInTheDocument()
    expect(tabsList).toHaveClass("inline-flex")
  })
})
