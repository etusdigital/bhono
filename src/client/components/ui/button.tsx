import type { VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes, Ref } from "react"

import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-green-500 hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-red-600 hover:shadow-md",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-gray-300 dark:hover:border-gray-600",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-gray-200 dark:hover:bg-gray-700",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-green-600",
        // Status variants
        success:
          "bg-green-500 text-white shadow-sm hover:bg-green-600 hover:shadow-md",
        warning:
          "bg-yellow-500 text-gray-900 shadow-sm hover:bg-yellow-600 hover:shadow-md",
        info:
          "bg-blue-500 text-white shadow-sm hover:bg-blue-600 hover:shadow-md",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ref?: Ref<HTMLButtonElement>
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
}

export { Button, buttonVariants }
