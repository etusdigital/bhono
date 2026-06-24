import { createFileRoute, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, DashboardCard, Heading, Text } from '@etus/seven-react'
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name ? user.name.split(' ')[0] : 'there'

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <Heading level={1} size="2xl">
          Welcome back, {firstName}
        </Heading>
        <Text variant="p2" color="muted">
          Here&apos;s an overview of your workspace.
        </Text>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Total Users"
          value="0"
          valueDescription="Active team members"
          icon={<Icons.users className="size-4" />}
        />
        <DashboardCard
          title="Accounts"
          value="1"
          valueDescription="Connected accounts"
          icon={<Icons.layers className="size-4" />}
        />
        <DashboardCard
          title="API Requests"
          value="0"
          valueDescription="Last 30 days"
          icon={<Icons.zap className="size-4" />}
        />
        <DashboardCard
          title="Uptime"
          value="100%"
          valueDescription="Last 30 days"
          icon={<Icons.globe className="size-4" />}
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.users className="h-5 w-5" />
              Invite Team Members
            </CardTitle>
            <CardDescription>
              Add collaborators to your workspace and manage permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text variant="p3" color="muted">
              Use the API to send invitations or manage users programmatically.
            </Text>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link to="/team">Invite members</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.database className="h-5 w-5" />
              Database
            </CardTitle>
            <CardDescription>
              Your data is stored securely on Cloudflare D1.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text variant="p3" color="muted">
              Built with SQL-first access to Cloudflare D1.
            </Text>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO(stub)
                toast.info('Database management is coming soon')
              }}
            >
              Manage database
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              OAuth authentication with HTTP-only session cookies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text variant="p3" color="muted">
              Role-based access control and audit logging enabled.
            </Text>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO(stub)
                toast.info('Security settings are coming soon')
              }}
            >
              Review security
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Recent activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your latest actions and events will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <Text variant="p3" color="muted">
              No recent activity
            </Text>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
