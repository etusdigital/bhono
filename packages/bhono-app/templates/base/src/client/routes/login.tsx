import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Divider, Heading, Link as SevenLink, Text } from '@etus/seven-react'
import { Icons } from '@/components/icons'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = () => {
    setIsLoading(true)
    window.location.href = '/auth/login'
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      {/* Form panel — primary content */}
      <main className="flex min-h-screen items-center justify-center px-4 py-12 lg:min-h-0">
        <div className="mx-auto grid w-full max-w-sm gap-6">
          {/* Brand mark */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icons.command className="size-4" />
            </div>
            <span className="font-semibold">Hono</span>
          </Link>

          <div className="grid gap-2">
            <Heading level={1} size="3xl" weight="bold">
              Welcome back
            </Heading>
            <Text variant="p2" color="muted" className="text-balance">
              Sign in to your account to continue
            </Text>
          </div>

          <div className="grid gap-4">
            <Button
              fullWidth
              loading={isLoading}
              loadingText="Redirecting..."
              leftIcon={<Icons.shield className="size-4" />}
              onClick={handleLogin}
            >
              Continue with ETUS
            </Button>

            <Divider type="text">Secure authentication</Divider>

            <Text as="p" variant="caption1" color="muted" className="text-center">
              By continuing, you agree to our{' '}
              {/* TODO: URL real de Terms of Service */}
              <SevenLink href="#" underline="always">
                Terms of Service
              </SevenLink>{' '}
              and{' '}
              {/* TODO: URL real de Privacy Policy */}
              <SevenLink href="#" underline="always">
                Privacy Policy
              </SevenLink>
              .
            </Text>
          </div>

          <Text as="p" variant="p3" color="muted" className="text-center">
            Don&apos;t have an account?{' '}
            {/* TODO: URL real de Contact us */}
            <SevenLink href="#" underline="always">
              Contact us
            </SevenLink>
          </Text>
        </div>
      </main>

      {/* Brand panel — complementary */}
      <aside className="hidden bg-muted lg:block">
        <div className="flex h-full items-center justify-center p-10">
          <div className="max-w-md space-y-2">
            <Heading level={2} size="3xl" weight="bold">
              Welcome to Hono
            </Heading>
            <Text variant="p1" color="muted">
              Production-ready multi-tenant SaaS, deployed on Cloudflare Workers.
            </Text>
          </div>
        </div>
      </aside>
    </div>
  )
}
