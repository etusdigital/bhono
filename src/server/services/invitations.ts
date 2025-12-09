// src/services/invitations.ts
import { eq, and, isNull, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { invitations, users, userAccounts, accounts } from '../db/schema'
import { sendInvitationEmail } from '../lib/email'
import { logAuthEvent, type AuthEventContext } from '../lib/audit'
import { ConflictError, NotFoundError, ForbiddenError } from '../lib/errors'
import { env } from '../env'
import { hasMinimumRole, type Role } from '../auth/roles'
import type { ServiceContext } from '../types'

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getExpiryDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString()
}

interface CreateInvitationInput {
  email: string
  role: Role
}

interface InvitationResult {
  linked: boolean
  invited: boolean
  user?: {
    id: string
    email: string
    name: string
  }
  invitation?: {
    id: string
    email: string
    role: Role
    expiresAt: string
  }
}

export const invitationsService = {
  async create(ctx: ServiceContext, input: CreateInvitationInput): Promise<InvitationResult> {
    const { email, role } = input

    // Check inviter can assign this role (can't assign higher than own role)
    if (!hasMinimumRole(ctx.userRole!, role)) {
      throw new ForbiddenError('Cannot assign a role higher than your own')
    }

    // Check if user already in this account
    const [existingMembership] = await db
      .select()
      .from(userAccounts)
      .innerJoin(users, eq(users.id, userAccounts.userId))
      .where(
        and(
          eq(userAccounts.accountId, ctx.accountId),
          eq(users.email, email),
          isNull(users.deletedAt)
        )
      )
      .limit(1)

    if (existingMembership) {
      throw new ConflictError('User is already a member of this account')
    }

    // Check if user exists in system
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)

    if (existingUser) {
      // Link immediately
      await db.insert(userAccounts).values({
        userId: existingUser.id,
        accountId: ctx.accountId,
        role,
      })

      return {
        linked: true,
        invited: false,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      }
    }

    // Check for existing pending invitation
    const [existingInvitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.accountId, ctx.accountId),
          eq(invitations.email, email),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date().toISOString())
        )
      )
      .limit(1)

    if (existingInvitation) {
      throw new ConflictError('Pending invitation already exists for this email')
    }

    // Get account name for email
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, ctx.accountId))
      .limit(1)

    // Create invitation
    const token = generateToken()
    const expiresAt = getExpiryDate()

    const [invitation] = await db
      .insert(invitations)
      .values({
        accountId: ctx.accountId,
        email,
        role,
        token,
        invitedById: ctx.user.id,
        expiresAt,
      })
      .returning()

    // Send email
    const inviteUrl = `${env.APP_URL}/auth/invite/${token}`
    await sendInvitationEmail(email, ctx.user.name, account!.name, inviteUrl)

    return {
      linked: false,
      invited: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role as Role,
        expiresAt: invitation.expiresAt,
      },
    }
  },

  async list(ctx: ServiceContext): Promise<Array<{
    id: string
    email: string
    role: Role
    invitedBy: { id: string; name: string }
    expiresAt: string
    createdAt: string
  }>> {
    const results = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        invitedById: invitations.invitedById,
        inviterName: users.name,
      })
      .from(invitations)
      .innerJoin(users, eq(users.id, invitations.invitedById))
      .where(
        and(
          eq(invitations.accountId, ctx.accountId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date().toISOString())
        )
      )
      .orderBy(invitations.createdAt)

    return results.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as Role,
      invitedBy: { id: r.invitedById, name: r.inviterName },
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }))
  },

  async revoke(ctx: ServiceContext, id: string): Promise<void> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.accountId, ctx.accountId),
          isNull(invitations.acceptedAt)
        )
      )
      .limit(1)

    if (!invitation) {
      throw new NotFoundError('Invitation')
    }

    await db.delete(invitations).where(eq(invitations.id, id))
  },

  async getByToken(token: string): Promise<{
    id: string
    accountId: string
    email: string
    role: Role
    accountName: string
  } | null> {
    const [result] = await db
      .select({
        id: invitations.id,
        accountId: invitations.accountId,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        accountName: accounts.name,
      })
      .from(invitations)
      .innerJoin(accounts, eq(accounts.id, invitations.accountId))
      .where(eq(invitations.token, token))
      .limit(1)

    if (!result) return null
    if (result.acceptedAt) return null
    if (new Date(result.expiresAt) < new Date()) return null

    return {
      id: result.id,
      accountId: result.accountId,
      email: result.email,
      role: result.role as Role,
      accountName: result.accountName,
    }
  },

  async accept(
    invitationId: string,
    userId: string,
    ctx: AuthEventContext
  ): Promise<void> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1)

    if (!invitation) {
      throw new NotFoundError('Invitation')
    }

    // Create user-account relationship
    await db.insert(userAccounts).values({
      userId,
      accountId: invitation.accountId,
      role: invitation.role,
    })

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ acceptedAt: new Date().toISOString() })
      .where(eq(invitations.id, invitationId))

    // Log event
    await logAuthEvent(ctx, 'LOGIN', userId, {
      invitationAccepted: true,
      accountId: invitation.accountId,
      role: invitation.role,
    })
  },
}
