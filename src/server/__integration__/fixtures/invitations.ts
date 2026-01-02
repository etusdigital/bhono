/**
 * Invitation Fixtures for Integration Tests
 *
 * Provides factory functions for creating invitations in the test database
 * with various states (pending, expired, accepted).
 */

import { getSqlite } from '../setup'
import type { Role } from './accounts'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateInvitationOptions {
  id?: string
  accountId: string
  email?: string
  role?: Role
  token?: string
  invitedById: string
  expiresAt?: string
  acceptedAt?: string | null
}

export interface CreatedInvitation {
  id: string
  accountId: string
  email: string
  role: Role
  token: string
  invitedById: string
  expiresAt: string
  acceptedAt: string | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let invitationCounter = 0

function generateInvitationDefaults(): { id: string; email: string; token: string } {
  invitationCounter++
  return {
    id: crypto.randomUUID(),
    email: `invited${invitationCounter}@example.com`,
    token: crypto.randomUUID(),
  }
}

/**
 * Get a date string for N days from now
 */
function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

/**
 * Get a date string for N days ago
 */
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

/**
 * Create an invitation in the database with defaults
 */
export async function createInvitation(options: CreateInvitationOptions): Promise<CreatedInvitation> {
  const db = getSqlite()
  const defaults = generateInvitationDefaults()

  const invitation: CreatedInvitation = {
    id: options.id ?? defaults.id,
    accountId: options.accountId,
    email: options.email ?? defaults.email,
    role: options.role ?? 'VIEWER',
    token: options.token ?? defaults.token,
    invitedById: options.invitedById,
    expiresAt: options.expiresAt ?? daysFromNow(7), // Default: expires in 7 days
    acceptedAt: options.acceptedAt ?? null,
  }

  db.prepare(`
    INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at, accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invitation.id,
    invitation.accountId,
    invitation.email,
    invitation.role,
    invitation.token,
    invitation.invitedById,
    invitation.expiresAt,
    invitation.acceptedAt
  )

  return invitation
}

/**
 * Create an expired invitation
 */
export async function createExpiredInvitation(
  options: Omit<CreateInvitationOptions, 'expiresAt'>
): Promise<CreatedInvitation> {
  return createInvitation({
    ...options,
    expiresAt: daysAgo(1), // Expired 1 day ago
  })
}

/**
 * Create an accepted invitation
 */
export async function createAcceptedInvitation(
  options: Omit<CreateInvitationOptions, 'acceptedAt'>
): Promise<CreatedInvitation> {
  return createInvitation({
    ...options,
    acceptedAt: new Date().toISOString(),
  })
}

/**
 * Get an invitation by token
 */
export async function getInvitationByToken(token: string): Promise<CreatedInvitation | null> {
  const db = getSqlite()
  const row = db.prepare(`
    SELECT id, account_id, email, role, token, invited_by_id, expires_at, accepted_at
    FROM invitations WHERE token = ?
  `).get(token) as {
    id: string
    account_id: string
    email: string
    role: Role
    token: string
    invited_by_id: string
    expires_at: string
    accepted_at: string | null
  } | undefined

  if (!row) return null

  return {
    id: row.id,
    accountId: row.account_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedById: row.invited_by_id,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  }
}

/**
 * Get all invitations for an account
 */
export async function getAccountInvitations(accountId: string): Promise<CreatedInvitation[]> {
  const db = getSqlite()
  const rows = db.prepare(`
    SELECT id, account_id, email, role, token, invited_by_id, expires_at, accepted_at
    FROM invitations WHERE account_id = ?
  `).all(accountId) as {
    id: string
    account_id: string
    email: string
    role: Role
    token: string
    invited_by_id: string
    expires_at: string
    accepted_at: string | null
  }[]

  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedById: row.invited_by_id,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  }))
}
