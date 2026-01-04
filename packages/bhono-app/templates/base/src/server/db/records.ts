// src/server/db/records.ts

export type UserStatus = 'active' | 'inactive'

export interface UserRecord {
  id: string
  googleId: string
  email: string
  name: string
  avatarUrl: string | null
  status: UserStatus
  providerIds: string[]
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdById?: string | null
  updatedById?: string | null
  deletedById?: string | null
}

export interface AccountRecord {
  id: string
  name: string
  description: string | null
  domain: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface UserAccountRecord {
  userId: string
  accountId: string
  role: string
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: number
  createdAt: number
  revokedAt: number | null
}

export interface InvitationRecord {
  id: string
  accountId: string
  email: string
  role: string
  token: string
  invitedById: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export type AuditAction =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SIGNUP'
  | 'TOKEN_REFRESH'
  | 'LOGIN_FAILED'

export interface AuditLogRecord {
  id: string
  transactionId: string
  accountId: string | null
  userId: string | null
  entity: string
  entityId: string
  action: AuditAction
  changes: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
}
