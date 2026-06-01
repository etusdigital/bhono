import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@etus/seven-react'
import { Icons } from '@/components/icons'

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="container flex h-14 items-center">
        <Link to="/" className="flex items-center space-x-2">
          <Icons.command className="h-6 w-6" />
          <span className="font-semibold">Hono</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          {/* Large 404 */}
          <div className="relative mb-8">
            <div className="text-[12rem] font-bold leading-none tracking-tighter text-muted/20 select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-background px-6 py-2 shadow-lg ring-1 ring-border">
                <span className="text-lg font-medium">Page not found</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="mb-8 text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/">
                <Icons.arrowRight className="mr-2 h-4 w-4 rotate-180" />
                Back to Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <Icons.dashboard className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>

          {/* Help Link */}
          <p className="mt-8 text-sm text-muted-foreground">
            Need help?{' '}
            <a
              href="mailto:support@example.com"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Contact support
            </a>
          </p>
        </div>
      </main>

      {/* Decorative Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      </div>
    </div>
  )
}
