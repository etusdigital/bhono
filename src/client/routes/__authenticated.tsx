import { createFileRoute, Outlet, redirect, Link } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Icons } from '@/components/icons'

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

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.[0].toUpperCase() || '?'

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <Link to="/__authenticated/dashboard" className="flex items-center space-x-2">
            <Icons.command className="h-6 w-6" />
            <span className="font-semibold">Hono</span>
          </Link>

          <nav className="ml-6 flex items-center space-x-4 lg:space-x-6">
            <Link
              to="/__authenticated/dashboard"
              className="text-sm font-medium transition-colors hover:text-foreground text-foreground"
            >
              Dashboard
            </Link>
          </nav>

          <div className="ml-auto flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || ''} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.logout className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="container max-w-screen-2xl py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
