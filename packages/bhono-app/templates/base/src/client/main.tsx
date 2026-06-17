// src/client/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@etus/seven-react'
import { router } from './router'
import { queryClient } from './lib/query-client'
import { ThemeProvider, useTheme } from './hooks/use-theme'
import './index.css'

/** Seven's Toaster wired to the app theme (needs the ThemeProvider context). */
function AppToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} />
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <AppToaster />
        {import.meta.env.DEV && <ReactQueryDevtools />}
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
