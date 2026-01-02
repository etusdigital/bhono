import type { HTMLAttributes, Ref } from "react"

import { cn } from "@/lib/utils"

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
  ref?: Ref<HTMLDivElement>
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ref,
  ...props
}: SeparatorProps) {
  return (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
