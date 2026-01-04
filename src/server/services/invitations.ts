// src/services/invitations.ts
import { sendInvitationEmail } from '../lib/email'
import { logAuthEvent, type AuthEventContext } from '../lib/audit'
import { ConflictError, NotFoundError, ForbiddenError } from '../lib/errors'
import type { Env } from '../env'
import { hasMinimumRole, type Role } from '../auth/roles'
import type { ServiceContext } from '../types'
import { execute, queryAll, queryOne, toStringValue, type SqlRow } from '../db/sql'

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return [...array]
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


function mapInvitationRow(row: SqlRow): {
  id: string
  email: string
  role: Role
  invitedById: string
  inviterName: string
  expiresAt: string
  createdAt: string
} {
  const invitedById = row.invitedById ?? row.invited_by_id
  const inviterName = row.inviterName ?? row.inviter_name
  const expiresAt = row.expiresAt ?? row.expires_at
  const createdAt = row.createdAt ?? row.created_at

  return {
    id: toStringValue(row.id),
    email: toStringValue(row.email),
    role: toStringValue(row.role) as Role,
    invitedById: toStringValue(invitedById),
    inviterName: toStringValue(inviterName),
    expiresAt: toStringValue(expiresAt),
    createdAt: toStringValue(createdAt),
  }
}

async function createSql(
  db: D1Database,
  env: Env,
  ctx: ServiceContext,
  input: CreateInvitationInput
): Promise<InvitationResult> {
  const { email, role } = input

  if (!ctx.userRole) {
    throw new ForbiddenError('User must have a role in this account to invite others')
  }

  if (!hasMinimumRole(ctx.userRole, role)) {
    throw new ForbiddenError('Cannot assign a role higher than your own')
  }

  const membership = await queryOne(
    db,
    `SELECT 1 as ok
     FROM user_accounts ua
     INNER JOIN users u ON u.id = ua.user_id
     WHERE ua.account_id = ? AND u.email = ? AND u.deleted_at IS NULL
     LIMIT 1`,
    [ctx.accountId, email]
  )

  if (membership) {
    throw new ConflictError('User is already a member of this account')
  }

  const existingUser = await queryOne<{
    id: string
    email: string
    name: string
  }>(
    db,
    `SELECT id, email, name FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
    [email]
  )

  if (existingUser) {
    await execute(
      db,
      `INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)`,
      [existingUser.id, ctx.accountId, role]
    )

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

  const existingInvitation = await queryOne(
    db,
    `SELECT id FROM invitations
     WHERE account_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > ?
     LIMIT 1`,
    [ctx.accountId, email, new Date().toISOString()]
  )

  if (existingInvitation) {
    throw new ConflictError('Pending invitation already exists for this email')
  }

  const account = await queryOne<{ name: string }>(
    db,
    `SELECT name FROM accounts WHERE id = ? LIMIT 1`,
    [ctx.accountId]
  )

  if (!account) {
    throw new Error('Account not found')
  }

  const token = generateToken()
  const expiresAt = getExpiryDate()
  const invitationId = crypto.randomUUID()

  await execute(
    db,
    `INSERT INTO invitations (
      id,
      account_id,
      email,
      role,
      token,
      invited_by_id,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [invitationId, ctx.accountId, email, role, token, ctx.user.id, expiresAt]
  )

  const inviteUrl = `${env.APP_URL}/auth/invite/${token}`
  await sendInvitationEmail(env, email, ctx.user.name, account.name, inviteUrl)

  return {
    linked: false,
    invited: true,
    invitation: {
      id: invitationId,
      email,
      role,
      expiresAt,
    },
  }
}

async function listSql(
  db: D1Database,
  ctx: ServiceContext
): Promise<{
  id: string
  email: string
  role: Role
  invitedBy: { id: string; name: string }
  expiresAt: string
  createdAt: string
}[]> {
  const rows = await queryAll(
    db,
    `SELECT
       i.id,
       i.email,
       i.role,
       i.expires_at as expiresAt,
       i.created_at as createdAt,
       i.invited_by_id as invitedById,
       u.name as inviterName
     FROM invitations i
     INNER JOIN users u ON u.id = i.invited_by_id
     WHERE i.account_id = ? AND i.accepted_at IS NULL AND i.expires_at > ?
     ORDER BY i.created_at`,
    [ctx.accountId, new Date().toISOString()]
  )

  return rows.map((row) => {
    const mapped = mapInvitationRow(row)
    return {
      id: mapped.id,
      email: mapped.email,
      role: mapped.role,
      invitedBy: { id: mapped.invitedById, name: mapped.inviterName },
      expiresAt: mapped.expiresAt,
      createdAt: mapped.createdAt,
    }
  })
}

async function revokeSql(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
  const invitation = await queryOne(
    db,
    `SELECT id FROM invitations
     WHERE id = ? AND account_id = ? AND accepted_at IS NULL
     LIMIT 1`,
    [id, ctx.accountId]
  )

  if (!invitation) {
    throw new NotFoundError('Invitation')
  }

  await execute(db, `DELETE FROM invitations WHERE id = ?`, [id])
}

async function getByTokenSql(
  db: D1Database,
  token: string
): Promise<{
  id: string
  accountId: string
  email: string
  role: Role
  accountName: string
} | null> {
  const row = await queryOne(
    db,
    `SELECT
       i.id,
       i.account_id as accountId,
       i.email,
       i.role,
       i.expires_at as expiresAt,
       i.accepted_at as acceptedAt,
       a.name as accountName
     FROM invitations i
     INNER JOIN accounts a ON a.id = i.account_id
     WHERE i.token = ?
     LIMIT 1`,
    [token]
  )

  if (!row) return null

  const acceptedAt = row.acceptedAt ?? row.accepted_at
  if (acceptedAt) return null

  const expiresAtValue = row.expiresAt ?? row.expires_at
  if (expiresAtValue && new Date(toStringValue(expiresAtValue)) < new Date()) return null

  return {
    id: toStringValue(row.id),
    accountId: toStringValue(row.accountId ?? row.account_id),
    email: toStringValue(row.email),
    role: toStringValue(row.role) as Role,
    accountName: toStringValue(row.accountName ?? row.account_name),
  }
}

async function acceptSql(
  db: D1Database,
  invitationId: string,
  userId: string,
  ctx: AuthEventContext
): Promise<void> {
  const invitation = await queryOne(
    db,
    `SELECT id, account_id as accountId, role FROM invitations WHERE id = ? LIMIT 1`,
    [invitationId]
  )

  if (!invitation) {
    throw new NotFoundError('Invitation')
  }

  const accountId = toStringValue(invitation.accountId ?? invitation.account_id)
  const role = toStringValue(invitation.role) as Role

  await execute(
    db,
    `INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)`,
    [userId, accountId, role]
  )

  await execute(
    db,
    `UPDATE invitations SET accepted_at = ? WHERE id = ?`,
    [new Date().toISOString(), invitationId]
  )

  await logAuthEvent(db, ctx, 'LOGIN', userId, {
    invitationAccepted: true,
    accountId,
    role,
  })
}

export const invitationsService = {
  async create(
    db: D1Database,
    env: Env,
    ctx: ServiceContext,
    input: CreateInvitationInput
  ): Promise<InvitationResult> {
    return createSql(db, env, ctx, input)
  },

  async list(db: D1Database, ctx: ServiceContext): Promise<{
    id: string
    email: string
    role: Role
    invitedBy: { id: string; name: string }
    expiresAt: string
    createdAt: string
  }[]> {
    return listSql(db, ctx)
  },

  async revoke(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
    await revokeSql(db, ctx, id)
  },

  async getByToken(db: D1Database, token: string): Promise<{
    id: string
    accountId: string
    email: string
    role: Role
    accountName: string
  } | null> {
    return getByTokenSql(db, token)
  },

  async accept(
    db: D1Database,
    invitationId: string,
    userId: string,
    ctx: AuthEventContext
  ): Promise<void> {
    await acceptSql(db, invitationId, userId, ctx)
  },
}
