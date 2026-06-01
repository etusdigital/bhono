import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@etus/seven-react'
import { Icons } from '@/components/icons'

export const Route = createFileRoute('/invite/$token')({
  component: AcceptInvitationPage,
})

type Status = 'pending' | 'accepted' | 'error'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Link to="/" className="flex items-center space-x-2">
          <Icons.command className="h-6 w-6" />
          <span className="font-semibold">Hono</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4">{children}</main>
    </div>
  )
}

function AcceptInvitationPage() {
  const { token } = Route.useParams()
  const [isAccepting, setIsAccepting] = useState(false)
  const [status, setStatus] = useState<Status>('pending')

  // Accept via @etus/auth's POST /invitations/:token/accept. The package
  // validates the token server-side. If the user is signed out it returns
  // 401 — we redirect through the login flow with returnTo so they come
  // back to this page authenticated.
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
      setStatus(res.ok ? 'accepted' : 'error')
    } catch {
      setStatus('error')
    } finally {
      setIsAccepting(false)
    }
  }

  if (status === 'accepted') {
    return (
      <Shell>
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Icons.check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-xl">Invitation accepted</CardTitle>
            <CardDescription>You&apos;re now a member of the workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  if (status === 'error') {
    return (
      <Shell>
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Icons.close className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Invitation could not be accepted</CardTitle>
            <CardDescription>
              This invitation may have expired, been revoked, or already been used. Ask the
              workspace admin for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Icons.mailPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
          <CardDescription>
            Accept this invitation to join the workspace. The invitation is validated when you
            accept it.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>
    </Shell>
  )
}
