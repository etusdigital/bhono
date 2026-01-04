import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@tests/helpers/client-test-utils"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"
import { Input } from "../input"

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Enter text" />)

    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument()
  })

  it("renders as textbox by default", () => {
    render(<Input placeholder="text input" />)

    const input = screen.getByPlaceholderText("text input")
    // Input defaults to text type when no type is specified
    expect(input).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("renders with specified type", () => {
    render(<Input type="email" placeholder="email input" />)

    const input = screen.getByPlaceholderText("email input")
    expect(input).toHaveAttribute("type", "email")
  })

  it("handles value changes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Input onChange={onChange} placeholder="type here" />)

    const input = screen.getByPlaceholderText("type here")
    await user.type(input, "hello")

    expect(onChange).toHaveBeenCalled()
    expect(input).toHaveValue("hello")
  })

  it("shows disabled state", () => {
    render(<Input disabled placeholder="disabled input" />)

    const input = screen.getByPlaceholderText("disabled input")
    expect(input).toBeDisabled()
    expect(input).toHaveClass("disabled:cursor-not-allowed")
    expect(input).toHaveClass("disabled:opacity-50")
  })

  it("forwards ref correctly", () => {
    const ref = createRef<HTMLInputElement>()

    render(<Input ref={ref} placeholder="ref test" />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current?.placeholder).toBe("ref test")
  })

  it("applies custom className", () => {
    render(<Input className="custom-class" placeholder="custom" />)

    const input = screen.getByPlaceholderText("custom")
    expect(input).toHaveClass("custom-class")
  })

  it("handles controlled value", () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} placeholder="controlled" />)

    const input = screen.getByPlaceholderText("controlled")
    expect(input).toHaveValue("initial")

    rerender(<Input value="updated" onChange={() => {}} placeholder="controlled" />)
    expect(input).toHaveValue("updated")
  })

  it("renders password type input", () => {
    render(<Input type="password" placeholder="password" />)

    const input = screen.getByPlaceholderText("password")
    expect(input).toHaveAttribute("type", "password")
  })

  it("supports aria attributes", () => {
    render(
      <Input
        aria-label="Email address"
        aria-describedby="email-hint"
        placeholder="email"
      />
    )

    const input = screen.getByPlaceholderText("email")
    expect(input).toHaveAttribute("aria-label", "Email address")
    expect(input).toHaveAttribute("aria-describedby", "email-hint")
  })
})
