import { describe, it, expect } from "vitest"
import { render, screen } from "../../../__tests__/test-utils"
import { createRef } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../card"

describe("Card", () => {
  it("renders Card with children", () => {
    render(
      <Card>
        <div data-testid="card-child">Card content</div>
      </Card>
    )

    expect(screen.getByTestId("card-child")).toBeInTheDocument()
    expect(screen.getByText("Card content")).toBeInTheDocument()
  })

  it("applies default Card styles", () => {
    render(<Card data-testid="card">Content</Card>)

    const card = screen.getByTestId("card")
    expect(card).toHaveClass("rounded-lg")
    expect(card).toHaveClass("border")
    expect(card).toHaveClass("bg-card")
    expect(card).toHaveClass("shadow-sm")
  })

  it("applies custom className to Card", () => {
    render(
      <Card className="custom-card-class" data-testid="card">
        Content
      </Card>
    )

    const card = screen.getByTestId("card")
    expect(card).toHaveClass("custom-card-class")
  })

  it("forwards ref to Card", () => {
    const ref = createRef<HTMLDivElement>()
    render(<Card ref={ref}>Content</Card>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("CardHeader", () => {
  it("renders CardHeader with children", () => {
    render(
      <CardHeader data-testid="header">
        <span>Header content</span>
      </CardHeader>
    )

    expect(screen.getByTestId("header")).toBeInTheDocument()
    expect(screen.getByText("Header content")).toBeInTheDocument()
  })

  it("applies default CardHeader styles", () => {
    render(<CardHeader data-testid="header">Content</CardHeader>)

    const header = screen.getByTestId("header")
    expect(header).toHaveClass("flex")
    expect(header).toHaveClass("flex-col")
    expect(header).toHaveClass("space-y-1.5")
    expect(header).toHaveClass("p-6")
  })

  it("forwards ref to CardHeader", () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardHeader ref={ref}>Content</CardHeader>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("CardTitle", () => {
  it("renders CardTitle with text", () => {
    render(<CardTitle>My Title</CardTitle>)

    expect(screen.getByText("My Title")).toBeInTheDocument()
  })

  it("applies default CardTitle styles", () => {
    render(<CardTitle data-testid="title">Title</CardTitle>)

    const title = screen.getByTestId("title")
    expect(title).toHaveClass("font-semibold")
    expect(title).toHaveClass("leading-none")
    expect(title).toHaveClass("tracking-tight")
  })

  it("forwards ref to CardTitle", () => {
    const ref = createRef<HTMLHeadingElement>()
    render(<CardTitle ref={ref}>Title</CardTitle>)

    expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
  })
})

describe("CardDescription", () => {
  it("renders CardDescription with text", () => {
    render(<CardDescription>Description text</CardDescription>)

    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("applies default CardDescription styles", () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>)

    const desc = screen.getByTestId("desc")
    expect(desc).toHaveClass("text-sm")
    expect(desc).toHaveClass("text-muted-foreground")
  })

  it("forwards ref to CardDescription", () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardDescription ref={ref}>Description</CardDescription>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("CardContent", () => {
  it("renders CardContent with children", () => {
    render(
      <CardContent data-testid="content">
        <p>Main content here</p>
      </CardContent>
    )

    expect(screen.getByTestId("content")).toBeInTheDocument()
    expect(screen.getByText("Main content here")).toBeInTheDocument()
  })

  it("applies default CardContent styles", () => {
    render(<CardContent data-testid="content">Content</CardContent>)

    const content = screen.getByTestId("content")
    expect(content).toHaveClass("p-6")
    expect(content).toHaveClass("pt-0")
  })

  it("forwards ref to CardContent", () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardContent ref={ref}>Content</CardContent>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("CardFooter", () => {
  it("renders CardFooter with children", () => {
    render(
      <CardFooter data-testid="footer">
        <button>Action</button>
      </CardFooter>
    )

    expect(screen.getByTestId("footer")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument()
  })

  it("applies default CardFooter styles", () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)

    const footer = screen.getByTestId("footer")
    expect(footer).toHaveClass("flex")
    expect(footer).toHaveClass("items-center")
    expect(footer).toHaveClass("p-6")
    expect(footer).toHaveClass("pt-0")
  })

  it("forwards ref to CardFooter", () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardFooter ref={ref}>Footer</CardFooter>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe("Card composition", () => {
  it("renders complete Card with all subcomponents", () => {
    render(
      <Card data-testid="complete-card">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description goes here</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This is the main content of the card.</p>
        </CardContent>
        <CardFooter>
          <button>Save</button>
          <button>Cancel</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByTestId("complete-card")).toBeInTheDocument()
    expect(screen.getByText("Card Title")).toBeInTheDocument()
    expect(screen.getByText("Card description goes here")).toBeInTheDocument()
    expect(screen.getByText("This is the main content of the card.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })
})
