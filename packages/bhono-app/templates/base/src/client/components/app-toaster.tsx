import { Toaster } from '@etus/seven-react'
import { useTheme } from '@/hooks/use-theme'

/** Seven's Toaster wired to the app theme (needs the ThemeProvider context). */
export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} />
}
