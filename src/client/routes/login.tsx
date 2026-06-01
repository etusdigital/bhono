import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@etus/seven-react'
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
    <div className="flex min-h-screen flex-col">
      {/* Simple header */}
      <header className="container flex h-14 items-center">
        <Link to="/" className="flex items-center space-x-2">
          <Icons.command className="h-6 w-6" />
          <span className="font-semibold">Hono</span>
        </Link>
      </header>

      {/* Login form */}
      <main className="flex flex-1 items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Welcome back
            </CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icons.shield className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Redirecting...' : 'Continue with ETUS'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Secure authentication
                </span>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <a href="#" className="underline underline-offset-4 hover:text-foreground">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="underline underline-offset-4 hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href="#" className="font-medium text-foreground underline underline-offset-4">
            Contact us
          </a>
        </p>
      </footer>
    </div>
  )
}
