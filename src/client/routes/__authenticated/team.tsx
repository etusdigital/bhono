import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'

export const Route = createFileRoute('/__authenticated/team')({
  component: TeamPage,
})

// Mock data for team members
const mockTeamMembers = [
  {
    id: '1',
    name: 'You',
    email: '',
    role: 'owner',
    avatarUrl: null,
    joinedAt: new Date().toISOString(),
    isCurrentUser: true,
  },
]

// Mock data for pending invitations
const mockInvitations = [
  {
    id: '1',
    email: 'pending@example.com',
    role: 'member',
    invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

type TeamMember = typeof mockTeamMembers[0]
type Invitation = typeof mockInvitations[0]

function TeamPage() {
  const { user } = useAuth()
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Populate current user data
  const teamMembers: TeamMember[] = mockTeamMembers.map((m) =>
    m.isCurrentUser
      ? { ...m, name: user?.name || 'You', email: user?.email || '', avatarUrl: user?.avatarUrl || null }
      : m
  )

  const invitations: Invitation[] = mockInvitations

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsInviting(false)
    setIsInviteOpen(false)
    setInviteEmail('')
    setInviteRole('member')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Manage your team and invite new members.
          </p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <Icons.userPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your workspace. They'll receive an email with a link to accept.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={inviteRole === 'member' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setInviteRole('member')}
                      className="flex-1"
                    >
                      Member
                    </Button>
                    <Button
                      type="button"
                      variant={inviteRole === 'admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setInviteRole('admin')}
                      className="flex-1"
                    >
                      Admin
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inviteRole === 'member'
                      ? 'Members can view and collaborate on projects.'
                      : 'Admins can manage team settings and members.'}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isInviting || !inviteEmail}>
                  {isInviting && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Icons.search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Members</CardTitle>
          <CardDescription>
            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} in your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {filteredMembers.map((member) => (
              <TeamMemberRow key={member.id} member={member} />
            ))}
            {filteredMembers.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No members found matching your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
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
                <InvitationRow key={invitation.id} invitation={invitation} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TeamMemberRow({ member }: { member: TeamMember }) {
  const initials = member.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || member.email?.[0].toUpperCase() || '?'

  const roleColors: Record<string, 'default' | 'secondary' | 'outline'> = {
    owner: 'default',
    admin: 'secondary',
    member: 'outline',
  }

  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{member.name}</p>
            {member.isCurrentUser && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={roleColors[member.role]} className="capitalize">
          {member.role}
        </Badge>
        {!member.isCurrentUser && (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Icons.more className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const [isRevoking, setIsRevoking] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const daysUntilExpiry = Math.ceil(
    (new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  const handleRevoke = async () => {
    setIsRevoking(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsRevoking(false)
  }

  const handleResend = async () => {
    setIsResending(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsResending(false)
  }

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
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending ? (
            <Icons.spinner className="h-4 w-4 animate-spin" />
          ) : (
            <Icons.mail className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Resend</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevoke}
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
