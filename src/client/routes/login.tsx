import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@etus/seven-react'
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
        <div className="mx-auto grid w-[350px] gap-6">
          {/* Brand mark */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icons.command className="size-4" />
            </div>
            <span className="font-semibold">Hono</span>
          </Link>

          <div className="grid gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-balance text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <div className="grid gap-4">
            <Button className="w-full" disabled={isLoading} onClick={handleLogin}>
              {isLoading ? (
                <Icons.spinner className="mr-2 size-4 animate-spin" />
              ) : (
                <Icons.shield className="mr-2 size-4" />
              )}
              {isLoading ? 'Redirecting...' : 'Continue with ETUS'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Secure authentication
                </span>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <a className="underline underline-offset-4 hover:text-foreground" href="#">
                Terms of Service
              </a>{' '}
              and{' '}
              <a className="underline underline-offset-4 hover:text-foreground" href="#">
                Privacy Policy
              </a>
              .
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <a className="font-medium text-foreground underline underline-offset-4" href="#">
              Contact us
            </a>
          </div>
        </div>
      </main>

      {/* Brand panel — complementary */}
      <aside className="hidden bg-muted lg:block">
        <div className="flex h-full items-center justify-center p-10">
          <div className="max-w-md space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome to Hono</h2>
            <p className="text-lg text-muted-foreground">
              Production-ready multi-tenant SaaS, deployed on Cloudflare Workers.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
