import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'

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
  const { user, logout, isLoggingOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hono Boilerplate</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
