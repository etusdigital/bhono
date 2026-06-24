import type { ReactNode } from 'react'
import { createFileRoute, Outlet, redirect, useRouter, useRouterState } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Topbar,
  TopbarLeading,
} from '@etus/seven-react'
import { AppSidebar } from '@/components/sidebar'
import { ErrorFallback } from '@/components/ui/error-fallback'
import { PageSkeleton } from '@/components/ui/loading-skeleton'
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

/** Topbar breadcrumb derived from the first path segment. */
function RouteBreadcrumb() {
  const { location } = useRouterState()
  const seg = location.pathname.split('/').find(Boolean)
  const label = seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Dashboard'

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-semibold">{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** Canonical Seven app shell: collapsible sidebar + inset with topbar and tucked content. */
function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header>
          <Topbar variant="default">
            <TopbarLeading>
              <SidebarTrigger className="-ml-1" />
              <RouteBreadcrumb />
            </TopbarLeading>
          </Topbar>
        </header>
        <div className="flex-1 overflow-auto rounded-tl-[24px] border bg-background p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function AuthenticatedPendingComponent() {
  return (
    <div className="flex h-screen items-center justify-center p-8">
      <PageSkeleton />
    </div>
  )
}

export function AuthenticatedErrorComponent({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <div className="flex h-screen items-center justify-center p-8">
      <ErrorFallback
        error={error}
        title="Something went wrong"
        message="An error occurred while loading this page. Please try again."
        onRetry={() => { void router.invalidate() }}
        onGoBack={() => { router.history.back() }}
        onGoHome={() => { void router.navigate({ to: '/dashboard' }) }}
      />
    </div>
  )
}
