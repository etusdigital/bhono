import type { RenderOptions } from "@testing-library/react";
import { render, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router"
import { routeTree } from "@/routeTree.gen"
import { ThemeProvider } from "@/hooks/use-theme"
import type { ReactElement, ReactNode } from "react"

// Create a fresh QueryClient for each test
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Create a test router with memory history
// Uses TanStack Router best practices for testing
export function createTestRouter(initialEntries: string[] = ["/"]) {
  const memoryHistory = createMemoryHistory({ initialEntries })
  return createRouter({
    routeTree,
    history: memoryHistory,
    // Critical: Remove pending delay to prevent test timeouts
    defaultPendingMinMs: 0,
    // Disable preloading in tests
    defaultPreload: false,
  })
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient
}

/**
 * Render a component wrapped with all providers (Theme + Query).
 * Use this for testing components that need React Query but not routing.
 */
export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

interface RenderRouteOptions {
  queryClient?: QueryClient
  initialEntries?: string[]
}

/**
 * Render the app at a specific route.
 * Use this for testing routes/pages that need the full router context.
 *
 * TanStack Router best practices:
 * - defaultPendingMinMs: 0 to prevent 500ms delays
 * - Router is properly typed with the route tree
 * - ThemeProvider wraps everything like in main.tsx
 */
export function renderRoute({
  queryClient = createTestQueryClient(),
  initialEntries = ["/"],
}: RenderRouteOptions = {}) {
  const router = createTestRouter(initialEntries)

  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  )

  return {
    ...result,
    queryClient,
    router,
  }
}

/**
 * Render the app at a specific route and wait for it to be ready.
 * Use this when you need to ensure the route is fully loaded before assertions.
 */
export async function renderRouteAsync({
  queryClient = createTestQueryClient(),
  initialEntries = ["/"],
}: RenderRouteOptions = {}) {
  const router = createTestRouter(initialEntries)

  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  )

  // Wait for router to be ready (hydrated)
  await act(async () => {
    await router.load()
  })

  return {
    ...result,
    queryClient,
    router,
  }
}

export * from "@testing-library/react"
export { renderWithProviders as render }
