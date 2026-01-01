import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarContextValue {
  imageLoaded: boolean
  setImageLoaded: (loaded: boolean) => void
}

const AvatarContext = React.createContext<AvatarContextValue | undefined>(undefined)

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const [imageLoaded, setImageLoaded] = React.useState(false)

  return (
    <AvatarContext.Provider value={{ imageLoaded, setImageLoaded }}>
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
})
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, src, onLoad, onError, ...props }, ref) => {
  const context = React.useContext(AvatarContext)
  const [hasError, setHasError] = React.useState(false)

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false)
    context?.setImageLoaded(false)
  }, [src])

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
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(AvatarContext)

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
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
