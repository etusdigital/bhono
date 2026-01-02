import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { Sidebar } from '@/components/sidebar'
import { ErrorFallback } from '@/components/ui/error-fallback'
import { SidebarSkeleton, PageSkeleton } from '@/components/ui/loading-skeleton'
import { queryClient } from '@/lib/query-client'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    // Prefetch auth data and populate the query cache
    // This prevents duplicate fetch when useAuth() runs
    const res = await fetch('/auth/me', { credentials: 'include' })
    if (!res.ok) {
      throw redirect({ to: '/login' })
    }
    const data = await res.json()
    queryClient.setQueryData(['auth', 'me'], data)
  },
  component: AuthenticatedLayout,
  pendingComponent: AuthenticatedPendingComponent,
  errorComponent: AuthenticatedErrorComponent,
})

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-[var(--content-width)] p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function AuthenticatedPendingComponent() {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarSkeleton />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-[var(--content-width)] p-8">
          <PageSkeleton />
        </div>
      </main>
    </div>
  )
}

function AuthenticatedErrorComponent({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ErrorFallback
          error={error}
          title="Something went wrong"
          message="An error occurred while loading this page. Please try again."
          onRetry={() => { void router.invalidate() }}
          onGoBack={() => { router.history.back() }}
          onGoHome={() => { void router.navigate({ to: '/dashboard' }) }}
        />
      </main>
    </div>
  )
}
