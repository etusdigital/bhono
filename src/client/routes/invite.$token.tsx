import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'

export const Route = createFileRoute('/invite/$token')({
  component: AcceptInvitationPage,
})

// Mock invitation data - in real app, this would be fetched based on token
const mockInvitation = {
  email: 'invited@example.com',
  workspaceName: 'Acme Inc',
  inviterName: 'John Doe',
  role: 'member',
  isValid: true,
  isExpired: false,
}

function AcceptInvitationPage() {
  const { token } = Route.useParams()
  const [isAccepting, setIsAccepting] = useState(false)
  const [status, setStatus] = useState<'pending' | 'accepted' | 'error'>('pending')

  // In a real app, you'd fetch invitation details using the token
  const invitation = mockInvitation

  // Accept via @etus/auth's POST /invitations/:token/accept. If the user is
  // signed out, the package returns 401 — we redirect through the login flow
  // with returnTo so they come back to this page authenticated.
  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      const res = await fetch(`/invitations/${token}/accept`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.status === 401) {
        window.location.href = `/auth/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      setStatus('accepted')
    } finally {
      setIsAccepting(false)
    }
  }

  // Invalid or expired invitation
  if (!invitation.isValid || invitation.isExpired) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="container flex h-14 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Icons.command className="h-6 w-6" />
            <span className="font-semibold">Hono</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Icons.close className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {invitation.isExpired ? 'Invitation Expired' : 'Invalid Invitation'}
              </CardTitle>
              <CardDescription>
                {invitation.isExpired
                  ? 'This invitation link has expired. Please ask for a new invitation.'
                  : 'This invitation link is not valid. It may have been revoked or already used.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/">Go to Homepage</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Successfully accepted
  if (status === 'accepted') {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="container flex h-14 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Icons.command className="h-6 w-6" />
            <span className="font-semibold">Hono</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Icons.check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-xl">Welcome to {invitation.workspaceName}!</CardTitle>
              <CardDescription>
                Your invitation has been accepted. You're now a member of the team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Pending acceptance
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Link to="/" className="flex items-center space-x-2">
          <Icons.command className="h-6 w-6" />
          <span className="font-semibold">Hono</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Icons.mailPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">You've Been Invited!</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{invitation.inviterName}</span>{' '}
              invited you to join{' '}
              <span className="font-medium text-foreground">{invitation.workspaceName}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Invitation Details */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{invitation.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Workspace</dt>
                  <dd className="font-medium">{invitation.workspaceName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-medium capitalize">{invitation.role}</dd>
                </div>
              </dl>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => { void handleAccept() }}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <Icons.check className="mr-2 h-4 w-4" />
                    Accept Invitation
                  </>
                )}
              </Button>

              <Button variant="outline" className="w-full" asChild>
                <Link to="/">Decline</Link>
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              By accepting, you agree to our{' '}
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
    </div>
  )
}
