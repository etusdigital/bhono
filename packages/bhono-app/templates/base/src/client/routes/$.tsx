import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, ErrorPage, Link as SevenLink, Text } from '@etus/seven-react'
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
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icons.command className="size-4" />
          </div>
          <span className="font-semibold">Hono</span>
        </Link>
      </header>

      {/* Main Content — Seven ErrorPage (English copy to match the rest of the app) */}
      <main className="flex flex-1 items-center justify-center px-4">
        <ErrorPage
          type="404"
          title="Page not found"
          description="The page you're looking for doesn't exist or was moved."
          showHomeLink={false}
          actions={
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link to="/">
                    <Icons.arrowRight className="rotate-180" />
                    Back to Home
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard">
                    <Icons.dashboard />
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
              <Text variant="caption1" color="muted">
                Need help?{' '}
                {/* TODO: replace with the product's real support email */}
                <SevenLink href="mailto:support@example.com" variant="inline">
                  Contact support
                </SevenLink>
              </Text>
            </>
          }
        />
      </main>
    </div>
  )
}
