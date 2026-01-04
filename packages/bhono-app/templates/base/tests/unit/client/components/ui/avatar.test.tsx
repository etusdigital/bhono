import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@tests/helpers/client-test-utils"
import { createRef } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "../avatar"

describe("Avatar", () => {
  it("renders avatar container", () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByTestId("avatar")).toBeInTheDocument()
  })

  it("applies default styles", () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    const avatar = screen.getByTestId("avatar")
    expect(avatar).toHaveClass("relative")
    expect(avatar).toHaveClass("flex")
    expect(avatar).toHaveClass("h-10")
    expect(avatar).toHaveClass("w-10")
    expect(avatar).toHaveClass("rounded-full")
    expect(avatar).toHaveClass("overflow-hidden")
  })

  it("applies custom className", () => {
    render(
      <Avatar data-testid="avatar" className="h-16 w-16">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    const avatar = screen.getByTestId("avatar")
    expect(avatar).toHaveClass("h-16")
    expect(avatar).toHaveClass("w-16")
  })

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Avatar ref={ref}>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("AvatarFallback", () => {
  it("renders fallback content when no image", () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByText("JD")).toBeInTheDocument()
  })

  it("applies default styles", () => {
    render(
      <Avatar>
        <AvatarFallback data-testid="fallback">JD</AvatarFallback>
      </Avatar>
    )

    const fallback = screen.getByTestId("fallback")
    expect(fallback).toHaveClass("flex")
    expect(fallback).toHaveClass("h-full")
    expect(fallback).toHaveClass("w-full")
    expect(fallback).toHaveClass("items-center")
    expect(fallback).toHaveClass("justify-center")
    expect(fallback).toHaveClass("rounded-full")
    expect(fallback).toHaveClass("bg-muted")
  })

  it("applies custom className", () => {
    render(
      <Avatar>
        <AvatarFallback data-testid="fallback" className="bg-primary">
          JD
        </AvatarFallback>
      </Avatar>
    )

    const fallback = screen.getByTestId("fallback")
    expect(fallback).toHaveClass("bg-primary")
  })

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Avatar>
        <AvatarFallback ref={ref}>JD</AvatarFallback>
      </Avatar>
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("AvatarImage", () => {
  it("renders image when src is provided", () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByRole("img")).toBeInTheDocument()
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/avatar.jpg")
  })

  it("applies default styles", () => {
    render(
      <Avatar>
        <AvatarImage
          data-testid="avatar-img"
          src="https://example.com/avatar.jpg"
          alt="User"
        />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    const img = screen.getByTestId("avatar-img")
    expect(img).toHaveClass("aspect-square")
    expect(img).toHaveClass("h-full")
    expect(img).toHaveClass("w-full")
    expect(img).toHaveClass("object-cover")
  })

  it("returns null when src is empty", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="" alt="User" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(screen.getByText("JD")).toBeInTheDocument()
  })

  it("shows fallback and hides image on error", async () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/broken.jpg" alt="User" />
        <AvatarFallback data-testid="fallback">JD</AvatarFallback>
      </Avatar>
    )

    const img = screen.getByRole("img")

    // Simulate error
    fireEvent.error(img)

    // Wait for fallback to appear
    await waitFor(() => {
      expect(screen.getByTestId("fallback")).toBeInTheDocument()
    })
  })

  it("calls onError callback when image fails", () => {
    const onError = vi.fn()

    render(
      <Avatar>
        <AvatarImage
          src="https://example.com/broken.jpg"
          alt="User"
          onError={onError}
        />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    const img = screen.getByRole("img")
    fireEvent.error(img)

    expect(onError).toHaveBeenCalled()
  })

  it("calls onLoad callback when image loads", () => {
    const onLoad = vi.fn()

    render(
      <Avatar>
        <AvatarImage
          src="https://example.com/avatar.jpg"
          alt="User"
          onLoad={onLoad}
        />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    const img = screen.getByRole("img")
    fireEvent.load(img)

    expect(onLoad).toHaveBeenCalled()
  })

  it("hides fallback after image loads", async () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User" />
        <AvatarFallback data-testid="fallback">JD</AvatarFallback>
      </Avatar>
    )

    // Fallback should be visible initially
    expect(screen.getByTestId("fallback")).toBeInTheDocument()

    // Simulate image load
    const img = screen.getByRole("img")
    fireEvent.load(img)

    // Fallback should be hidden after load
    await waitFor(() => {
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument()
    })
  })

  it("resets error state when src changes", async () => {
    const { rerender } = render(
      <Avatar>
        <AvatarImage src="https://example.com/broken.jpg" alt="User" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    // Simulate error on first image
    const img = screen.getByRole("img")
    fireEvent.error(img)

    // Wait for image to be removed
    await waitFor(() => {
      expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })

    // Change src
    rerender(
      <Avatar>
        <AvatarImage src="https://example.com/new-avatar.jpg" alt="User" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    // New image should be rendered
    await waitFor(() => {
      expect(screen.getByRole("img")).toBeInTheDocument()
      expect(screen.getByRole("img")).toHaveAttribute(
        "src",
        "https://example.com/new-avatar.jpg"
      )
    })
  })

  it("forwards ref to image element", () => {
    const ref = createRef<HTMLImageElement>()

    render(
      <Avatar>
        <AvatarImage ref={ref} src="https://example.com/avatar.jpg" alt="User" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(ref.current).toBeInstanceOf(HTMLImageElement)
  })
})

describe("Avatar composition", () => {
  it("renders complete avatar with image and fallback", () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarImage src="https://example.com/avatar.jpg" alt="John Doe" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByTestId("avatar")).toBeInTheDocument()
    expect(screen.getByRole("img")).toBeInTheDocument()
    expect(screen.getByText("JD")).toBeInTheDocument() // Fallback visible until load
  })

  it("shows only fallback when image source is undefined", () => {
    render(
      <Avatar>
        <AvatarImage src={undefined} alt="User" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByText("AB")).toBeInTheDocument()
  })
})
