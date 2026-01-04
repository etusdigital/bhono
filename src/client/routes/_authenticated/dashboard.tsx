import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your workspace.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value="0"
          description="Active team members"
          icon={<Icons.users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Accounts"
          value="1"
          description="Connected accounts"
          icon={<Icons.layers className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="API Requests"
          value="0"
          description="Last 30 days"
          icon={<Icons.zap className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Uptime"
          value="100%"
          description="Last 30 days"
          icon={<Icons.globe className="h-4 w-4 text-muted-foreground" />}
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
            <p className="text-sm text-muted-foreground">
              Use the API to send invitations or manage users programmatically.
            </p>
          </CardContent>
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
            <p className="text-sm text-muted-foreground">
              Built with SQL-first access to Cloudflare D1.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              OAuth 2.0 authentication with secure JWT tokens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Role-based access control and audit logging enabled.
            </p>
          </CardContent>
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
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              No recent activity
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatsCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
