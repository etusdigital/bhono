import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge, Button, Card, FeaturedIcon, Heading, Text } from '@etus/seven-react'
import { Icons } from '@/components/icons'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background">
        <div className="container flex h-14 max-w-[var(--content-wide)] items-center">
          <Link to="/" className="flex items-center gap-2">
            <FeaturedIcon size="sm" tone="brand">
              <Icons.command />
            </FeaturedIcon>
            <Text as="span" weight="semibold">
              Hono
            </Text>
          </Link>
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
          <Badge color="secondary" leadingIcon={<Icons.zap />}>
            Built on Cloudflare Workers
          </Badge>

          <Heading
            level={1}
            align="center"
            className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Build your SaaS
            <br />
            <span className="text-muted-foreground">faster than ever</span>
          </Heading>

          <Text
            variant="p1"
            color="muted"
            className="max-w-[42rem] text-center"
          >
            A production-ready multi-tenant boilerplate with authentication,
            database, and API — all on the edge.
          </Text>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/login">
                Get Started
                <Icons.arrowRight />
              </Link>
            </Button>
            {/* TODO: apontar para o repositório real do produto */}
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.gitHub />
                GitHub
              </a>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="container py-24 md:py-32">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Icons.zap />}
              title="Edge-First"
              description="Deploy globally on Cloudflare Workers with D1 database for lightning-fast responses."
            />
            <FeatureCard
              icon={<Icons.shield />}
              title="Secure by Default"
              description="Gateway OAuth, HTTP-only session cookies, and role-based access control built-in."
            />
            <FeatureCard
              icon={<Icons.users />}
              title="Multi-Tenant"
              description="Isolated accounts, team invitations, and audit logging ready to go."
            />
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="border-t">
          <div className="container py-16">
            <Heading
              level={2}
              size="sm"
              weight="semibold"
              color="muted"
              align="center"
              className="mb-8 uppercase tracking-wider"
            >
              Built with modern tools
            </Heading>
            <div className="flex flex-wrap items-center justify-center gap-4">
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
          <Text variant="p3" color="muted">
            Built with Hono and Cloudflare Workers.
          </Text>
          <div className="flex items-center gap-4">
            {/* TODO: apontar para o repositório real do produto */}
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
    <Card variant="ghost" className="items-center text-center">
      <FeaturedIcon size="lg">{icon}</FeaturedIcon>
      <Heading level={3} size="lg" align="center">
        {title}
      </Heading>
      <Text variant="p3" color="muted">
        {description}
      </Text>
    </Card>
  )
}

function TechBadge({ name }: { name: string }) {
  return (
    <Badge type="pill-outline" color="secondary">
      {name}
    </Badge>
  )
}
