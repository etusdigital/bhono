import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-[var(--content-wide)] items-center">
          <div className="flex items-center space-x-2">
            <Icons.command className="h-6 w-6" />
            <span className="font-semibold">Hono</span>
          </div>
          <nav className="ml-auto flex items-center space-x-4">
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link to="/login">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center gap-4 py-24 md:py-32">
          <div className="flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm font-medium">
            <Icons.zap className="h-4 w-4" />
            <span>Built on Cloudflare Workers</span>
          </div>

          <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Build your SaaS
            <br />
            <span className="text-muted-foreground">faster than ever</span>
          </h1>

          <p className="max-w-[42rem] text-center text-lg text-muted-foreground sm:text-xl">
            A production-ready multi-tenant boilerplate with authentication,
            database, and API — all on the edge.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/login">
                Get Started
                <Icons.arrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.gitHub className="mr-2 h-4 w-4" />
                GitHub
              </a>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="container py-24 md:py-32">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Icons.zap className="h-10 w-10" />}
              title="Edge-First"
              description="Deploy globally on Cloudflare Workers with D1 database for lightning-fast responses."
            />
            <FeatureCard
              icon={<Icons.shield className="h-10 w-10" />}
              title="Secure by Default"
              description="Gateway OAuth, HTTP-only session cookies, and role-based access control built-in."
            />
            <FeatureCard
              icon={<Icons.users className="h-10 w-10" />}
              title="Multi-Tenant"
              description="Isolated accounts, team invitations, and audit logging ready to go."
            />
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="border-t bg-muted/50">
          <div className="container py-16">
            <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Built with modern tools
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
              <TechBadge name="Hono" />
              <TechBadge name="React" />
              <TechBadge name="TypeScript" />
              <TechBadge name="SQL" />
              <TechBadge name="Tailwind" />
              <TechBadge name="Cloudflare" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            Built with Hono and Cloudflare Workers.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icons.gitHub className="h-5 w-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 rounded-lg bg-muted p-3">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function TechBadge({ name }: { name: string }) {
  return (
    <span className="text-sm font-medium">{name}</span>
  )
}
