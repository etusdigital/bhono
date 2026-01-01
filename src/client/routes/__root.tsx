// src/client/routes/__root.tsx
import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ErrorFallback } from '@/components/ui/error-fallback'

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  )
}

function RootErrorComponent({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center">
      <ErrorFallback
        error={error}
        title="Application Error"
        message="Something went wrong. Please try again or contact support if the problem persists."
        onRetry={() => router.invalidate()}
        onGoHome={() => router.navigate({ to: '/' })}
      />
    </div>
  )
}
