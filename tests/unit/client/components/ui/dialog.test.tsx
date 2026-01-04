import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@tests/helpers/client-test-utils"
import userEvent from "@testing-library/user-event"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../dialog"

describe("Dialog", () => {
  it("opens dialog when trigger is clicked", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    // Dialog content should not be visible initially
    expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument()

    // Click the trigger
    await user.click(screen.getByText("Open Dialog"))

    // Dialog content should now be visible
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()
  })

  it("closes dialog when close button is clicked", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    // Open the dialog
    await user.click(screen.getByText("Open Dialog"))
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()

    // Click the close button (sr-only text "Close")
    const closeButton = screen.getByRole("button", { name: "Close" })
    await user.click(closeButton)

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument()
    })
  })

  it("renders dialog content correctly", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Title</DialogTitle>
            <DialogDescription>Test description text</DialogDescription>
          </DialogHeader>
          <div>Main content area</div>
          <DialogFooter>
            <button>Cancel</button>
            <button>Confirm</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open Dialog"))

    expect(screen.getByText("Test Title")).toBeInTheDocument()
    expect(screen.getByText("Test description text")).toBeInTheDocument()
    expect(screen.getByText("Main content area")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument()
  })

  it("handles overlay click to close", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent data-testid="dialog-content">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    // Open the dialog
    await user.click(screen.getByText("Open Dialog"))
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()

    // Click on the overlay (the background)
    // The overlay is the fixed inset-0 element with bg-black/80
    const overlay = document.querySelector(".bg-black\\/80")
    if (overlay) {
      await user.click(overlay)
    }

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument()
    })
  })

  it("closes dialog when Escape key is pressed", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    // Open the dialog
    await user.click(screen.getByText("Open Dialog"))
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()

    // Press Escape
    await user.keyboard("{Escape}")

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument()
    })
  })

  it("supports controlled open state", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    // Click trigger should call onOpenChange
    await user.click(screen.getByText("Open Dialog"))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it("renders open controlled dialog", () => {
    render(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    // Dialog should be visible because open={true}
    expect(screen.getByText("Controlled Dialog")).toBeInTheDocument()
  })

  it("does not close when clicking inside dialog content", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
          <button>Inner Button</button>
        </DialogContent>
      </Dialog>
    )

    // Open the dialog
    await user.click(screen.getByText("Open Dialog"))
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()

    // Click inside the dialog content
    await user.click(screen.getByRole("button", { name: "Inner Button" }))

    // Dialog should still be open
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()
  })
})

describe("DialogHeader", () => {
  it("applies correct styles", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader data-testid="header">
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open"))

    const header = screen.getByTestId("header")
    expect(header).toHaveClass("flex")
    expect(header).toHaveClass("flex-col")
    expect(header).toHaveClass("space-y-1.5")
  })
})

describe("DialogFooter", () => {
  it("applies correct styles", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter data-testid="footer">
            <button>Action</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open"))

    const footer = screen.getByTestId("footer")
    expect(footer).toHaveClass("flex")
    expect(footer).toHaveClass("flex-col-reverse")
  })
})

describe("DialogTitle", () => {
  it("renders as h2 element", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open"))

    const title = screen.getByRole("heading", { level: 2 })
    expect(title).toHaveTextContent("My Title")
  })
})

describe("DialogDescription", () => {
  it("renders with muted text style", async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription data-testid="desc">Description text</DialogDescription>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText("Open"))

    const desc = screen.getByTestId("desc")
    expect(desc).toHaveClass("text-sm")
    expect(desc).toHaveClass("text-muted-foreground")
  })
})
