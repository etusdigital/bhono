import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'
import type { Account, AuthUser } from '@shared/types'

const InviteFormSchema = z.object({
  email: z.email('Email inválido'),
  role: z.enum(['guest', 'member', 'admin']),
})

type InviteFormInput = z.infer<typeof InviteFormSchema>

interface AccountSummary extends Account {
  role: 'admin' | 'member' | 'guest'
}

interface AccountMember {
  id: string
  accountId: string
  userId: string
  role: 'admin' | 'member' | 'guest'
  status: 'active' | 'pending'
  joinedAt: string | null
  createdAt: string
  user: AuthUser | null
}

interface Invitation {
  id: string
  accountId: string
  email: string
  role: 'admin' | 'member' | 'guest'
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export const Route = createFileRoute('/_authenticated/team')({
  component: TeamPage,
})

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Request failed: ${String(res.status)}`)
  }
  const body: unknown = await res.json()
  return body as T
}

async function mutateJson<T>(url: string, method: 'POST' | 'DELETE', data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': '1',
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Request failed: ${String(res.status)}`)
  }
  const body: unknown = await res.json()
  return body as T
}

function TeamPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const form = useForm<InviteFormInput>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  })

  const accountsQuery = useQuery({
    queryKey: ['auth', 'accounts'],
    queryFn: async () => fetchJson<{ accounts: AccountSummary[] }>('/accounts'),
  })

  const currentAccount = accountsQuery.data?.accounts[0] ?? null
  const currentAccountId = currentAccount?.id ?? ''

  const membersQuery = useQuery({
    queryKey: ['auth', 'accounts', currentAccountId, 'members'],
    queryFn: async () => fetchJson<{ members: AccountMember[] }>(`/accounts/${currentAccountId}/members`),
    enabled: currentAccountId.length > 0,
  })

  const invitationsQuery = useQuery({
    queryKey: ['auth', 'accounts', currentAccountId, 'invitations'],
    queryFn: async () => {
      const res = await fetch(`/accounts/${currentAccountId}/invitations`, {
        credentials: 'include',
      })
      if (res.status === 403) return { invitations: [] }
      if (!res.ok) throw new Error(`Request failed: ${String(res.status)}`)
      const body: unknown = await res.json()
      return body as { invitations: Invitation[] }
    },
    enabled: currentAccountId.length > 0,
    retry: false,
  })

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormInput) => {
      if (!currentAccount) throw new Error('No account selected')
      return mutateJson<{ invitation: Invitation }>(
        `/accounts/${currentAccount.id}/members/invite`,
        'POST',
        data,
      )
    },
    onSuccess: (_result, variables) => {
      toast.success(`Invitation sent to ${variables.email}`)
      setIsInviteOpen(false)
      form.reset()
      void queryClient.invalidateQueries({ queryKey: ['auth', 'accounts', currentAccount?.id, 'invitations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!currentAccount) throw new Error('No account selected')
      return mutateJson<{ success: true }>(
        `/accounts/${currentAccount.id}/invitations/${invitationId}`,
        'DELETE',
      )
    },
    onSuccess: () => {
      toast.success('Invitation revoked')
      void queryClient.invalidateQueries({ queryKey: ['auth', 'accounts', currentAccount?.id, 'invitations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const teamMembers = useMemo(() => membersQuery.data?.members ?? [], [membersQuery.data?.members])
  const invitations = invitationsQuery.data?.invitations ?? []
  const isLoadingTeam = accountsQuery.isLoading || membersQuery.isLoading

  const filteredMembers = teamMembers.filter((member) => {
    const name = member.user?.name ?? ''
    const email = member.user?.email ?? ''
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleOpenChange = (open: boolean) => {
    setIsInviteOpen(open)
    if (!open) form.reset()
  }

  const onSubmit = async (data: InviteFormInput) => {
    await inviteMutation.mutateAsync(data)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Manage your team and invite new members.
          </p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={!currentAccount}>
              <Icons.userPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <Form {...form}>
              <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }}>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your workspace. They'll receive an email with a link to accept.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="colleague@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-3 gap-2">
                            {(['guest', 'member', 'admin'] as const).map((role) => (
                              <Button
                                key={role}
                                type="button"
                                variant={field.value === role ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { field.onChange(role) }}
                                className="capitalize"
                              >
                                {role}
                              </Button>
                            ))}
                          </div>
                        </FormControl>
                        <FormDescription>
                          {field.value === 'admin'
                            ? 'Admins can manage team settings and members.'
                            : field.value === 'member'
                              ? 'Members can view and collaborate on projects.'
                              : 'Guests can view workspace content.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsInviteOpen(false) }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Icons.search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value) }}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Members</CardTitle>
          <CardDescription>
            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} in your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {isLoadingTeam && (
              <div className="py-8 text-center text-muted-foreground">
                Loading members...
              </div>
            )}
            {!isLoadingTeam && filteredMembers.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                isCurrentUser={member.userId === user?.id}
              />
            ))}
            {!isLoadingTeam && filteredMembers.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No members found matching your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations</CardTitle>
            <CardDescription>
              {invitations.length} pending invitation{invitations.length !== 1 ? 's' : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {invitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  isRevoking={revokeMutation.isPending}
                  onRevoke={() => { revokeMutation.mutate(invitation.id) }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TeamMemberRow({
  member,
  isCurrentUser,
}: {
  member: AccountMember
  isCurrentUser: boolean
}) {
  const name = member.user?.name ?? member.user?.email ?? 'Unknown user'
  const email = member.user?.email ?? ''
  const initials = name
    ? name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const roleColors: Record<AccountMember['role'], 'default' | 'secondary' | 'outline'> = {
    admin: 'secondary',
    member: 'outline',
    guest: 'outline',
  }

  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={member.user?.picture ?? undefined} alt={name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{name}</p>
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={roleColors[member.role]} className="capitalize">
          {member.role}
        </Badge>
        {!isCurrentUser && (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Icons.more className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function InvitationRow({
  invitation,
  isRevoking,
  onRevoke,
}: {
  invitation: Invitation
  isRevoking: boolean
  onRevoke: () => void
}) {
  const [daysUntilExpiry] = useState(() =>
    Math.ceil(
      (new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  )

  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icons.mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{invitation.email}</p>
          <p className="text-sm text-muted-foreground">
            Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="warning">Pending</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={isRevoking}
          className="text-destructive hover:text-destructive"
        >
          {isRevoking ? (
            <Icons.spinner className="h-4 w-4 animate-spin" />
          ) : (
            <Icons.close className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Revoke</span>
        </Button>
      </div>
    </div>
  )
}
