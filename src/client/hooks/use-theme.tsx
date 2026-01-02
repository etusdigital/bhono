import type { ReactNode } from 'react'
import { createContext, use, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme())

  // Compute resolved theme from preference and system theme
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  // Apply theme class to document
  const applyThemeClass = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
  }, [])

  const handleSetTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, [])

  // Apply theme class on mount and when resolved theme changes
  useEffect(() => {
    applyThemeClass(resolvedTheme)
  }, [resolvedTheme, applyThemeClass])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => { mediaQuery.removeEventListener('change', handleChange) }
  }, [])

  return (
    <ThemeContext value={{ theme, resolvedTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext>
  )
}

export function useTheme() {
  const context = use(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
