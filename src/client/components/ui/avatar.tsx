import { createContext, use, useState } from "react"
import type { HTMLAttributes, ImgHTMLAttributes, Ref } from "react"

import { cn } from "@/lib/utils"

interface AvatarContextValue {
  imageLoaded: boolean
  setImageLoaded: (loaded: boolean) => void
}

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined)

function Avatar({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <AvatarContext value={{ imageLoaded, setImageLoaded }}>
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      />
    </AvatarContext>
  )
}

function AvatarImage({
  className,
  src,
  onLoad,
  onError,
  ref,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { ref?: Ref<HTMLImageElement> }) {
  const context = use(AvatarContext)
  // Track previous src to detect changes
  const [prevSrc, setPrevSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  // Reset error state when src changes (using derived state pattern)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setHasError(false)
    context?.setImageLoaded(false)
  }

  if (!src || hasError) {
    return null
  }

  return (
    <img
      ref={ref}
      src={src}
      className={cn("aspect-square h-full w-full object-cover", className)}
      onLoad={(e) => {
        context?.setImageLoaded(true)
        onLoad?.(e)
      }}
      onError={(e) => {
        setHasError(true)
        context?.setImageLoaded(false)
        onError?.(e)
      }}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const context = use(AvatarContext)

  // Always show fallback if no context (standalone usage) or image not loaded
  if (context?.imageLoaded) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback, AvatarImage }
