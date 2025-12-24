import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Sidebar } from '@/components/sidebar'

export const Route = createFileRoute('/__authenticated')({
  beforeLoad: async () => {
    const res = await fetch('/auth/me', { credentials: 'include' })
    if (!res.ok) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-screen-xl py-8 px-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
