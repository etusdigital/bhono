// src/server/db/records.ts
//
// Record shapes for the package-owned auth_* tables in schema.sql.

export type AuthUserStatus = 'pending' | 'active' | 'suspended' | 'denied'
export type AuthRole = 'owner' | 'admin' | 'member' | 'guest'
export type AuthMembershipStatus = 'active' | 'invited' | 'removed'

export interface AuthUserRecord {
  id: string
  gatewayUserId: string | null
  email: string
  name: string | null
  picture: string | null
  role: AuthRole
  status: AuthUserStatus
  invitedBy: string | null
  createdAt: string
  lastLoginAt: string | null
}

export interface AuthSessionRecord {
  id: string
  userId: string
  ip: string | null
  userAgent: string | null
  lastActiveAt: number | null
  expiresAt: number
  createdAt: number
}

export interface AuthAccountRecord {
  id: string
  name: string
  slug: string | null
  ownerId: string
  createdAt: string
  updatedAt: string | null
}

export interface AuthMembershipRecord {
  id: string
  accountId: string
  userId: string
  role: AuthRole
  status: AuthMembershipStatus
  invitedBy: string | null
  invitedAt: string | null
  joinedAt: string | null
  createdAt: string
}

export interface AuthInvitationRecord {
  id: string
  accountId: string
  email: string
  role: AuthRole
  invitedBy: string
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export interface AuthAuditLogRecord {
  id: string
  eventType: string
  actorId: string | null
  actorEmail: string | null
  targetId: string | null
  targetType: string | null
  accountId: string | null
  ip: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}
