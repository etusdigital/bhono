import { createContext, use, useState } from "react"
import type { ButtonHTMLAttributes, HTMLAttributes, Ref } from "react"

import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabs() {
  const context = use(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider")
  }
  return context
}

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  ref?: Ref<HTMLDivElement>
}

function Tabs({
  className,
  defaultValue,
  value,
  onValueChange,
  children,
  ref,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "")

  const currentValue = value ?? internalValue
  const handleValueChange = onValueChange ?? setInternalValue

  return (
    <TabsContext value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext>
  )
}

function TabsList({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  ref?: Ref<HTMLButtonElement>
}

function TabsTrigger({ className, value, ref, ...props }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabs()
  const isSelected = selectedValue === value

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isSelected}
      data-state={isSelected ? "active" : "inactive"}
      onClick={() => { onValueChange(value) }}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isSelected
          ? "bg-background text-foreground shadow"
          : "hover:bg-background/50 hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  ref?: Ref<HTMLDivElement>
}

function TabsContent({ className, value, ref, ...props }: TabsContentProps) {
  const { value: selectedValue } = useTabs()

  if (selectedValue !== value) return null

  return (
    <div
      ref={ref}
      role="tabpanel"
      data-state={selectedValue === value ? "active" : "inactive"}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
