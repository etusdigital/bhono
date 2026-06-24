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

      {/* Main Content — Seven ErrorPage (type 404 traz código/título/descrição em pt-BR) */}
      <main className="flex flex-1 items-center justify-center px-4">
        <ErrorPage
          type="404"
          showHomeLink={false}
          actions={
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link to="/">
                    <Icons.arrowRight className="rotate-180" />
                    Início
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard">
                    <Icons.dashboard />
                    Painel
                  </Link>
                </Button>
              </div>
              <Text variant="caption1" color="muted">
                Precisa de ajuda?{' '}
                {/* TODO: trocar pelo e-mail de suporte real do produto */}
                <SevenLink href="mailto:support@example.com" variant="inline">
                  Falar com o suporte
                </SevenLink>
              </Text>
            </>
          }
        />
      </main>
    </div>
  )
}
