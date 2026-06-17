import { createFileRoute } from '@tanstack/react-router'
import {
  Badge,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@etus/seven-react'
import { Icons } from '@/components/icons'
import { useGatewayAccounts, type AccountRole } from '@/hooks/use-gateway-accounts'

export const Route = createFileRoute('/_authenticated/workspaces')({
  component: WorkspacesPage,
})

// UI-only descriptions of what each gateway role grants in THIS app. Mirrors
// ACCOUNT_ROLE_MAP (src/server/auth/matrix.ts) at a human level — it is presentation,
// NOT a security boundary (the server `requirePermission` / `requireGatewayAccountRole`
// guards remain authoritative).
const ROLE_META: Record<AccountRole, { color: 'primary' | 'info' | 'success' | 'muted'; blurb: string }> = {
  admin: { color: 'primary', blurb: 'Manage members and account settings, plus create and update resources.' },
  manager: { color: 'info', blurb: 'Invite members and read audit logs, plus create and update resources.' },
  editor: { color: 'success', blurb: 'Create and update resources.' },
  viewer: { color: 'muted', blurb: 'Read-only access to resources.' },
}

function WorkspacesPage() {
  const { accounts, superAdmin, isLoading } = useGatewayAccounts()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="text-muted-foreground">
          The gateway accounts you belong to and the role you hold in each. Roles are
          resolved by the gateway (viewer &lt; editor &lt; manager &lt; admin).
        </p>
      </div>

      {superAdmin && (
        <Callout icon={<Icons.shield />} title="Super admin" variant="success">
          You have admin-level access across every workspace, regardless of the list below.
        </Callout>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icons.spinner className="h-4 w-4 animate-spin" />
          Loading workspaces…
        </div>
      ) : accounts.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icons.layers />
            </EmptyMedia>
            <EmptyTitle>No workspaces yet</EmptyTitle>
            <EmptyDescription>
              {superAdmin
                ? 'You hold no explicit per-workspace role, but super admin grants access everywhere.'
                : "You don't belong to any gateway workspace yet. An admin can grant you a role."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const meta = ROLE_META[account.role]
            return (
              <Card key={account.id}>
                <CardHeader className="space-y-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{account.name}</CardTitle>
                      <CardDescription className="truncate">{account.slug}</CardDescription>
                    </div>
                    <Badge color={meta.color} className="shrink-0 capitalize">
                      {account.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{meta.blurb}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
