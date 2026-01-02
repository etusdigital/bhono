import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router"
import { routeTree } from "../routeTree.gen"
import type { ReactElement, ReactNode } from "react"

// Create a fresh QueryClient for each test
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Create a test router with memory history
export function createTestRouter(initialEntries: string[] = ["/"]) {
  const memoryHistory = createMemoryHistory({ initialEntries })
  return createRouter({
    routeTree,
    history: memoryHistory,
  })
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient
}

/**
 * Render a component wrapped with QueryClientProvider.
 * Use this for testing components that need React Query but not routing.
 */
export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
 */
export function renderRoute({
  queryClient = createTestQueryClient(),
  initialEntries = ["/"],
}: RenderRouteOptions = {}) {
  const router = createTestRouter(initialEntries)

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  return {
    ...result,
    queryClient,
    router,
  }
}

export * from "@testing-library/react"
export { renderWithProviders as render }
