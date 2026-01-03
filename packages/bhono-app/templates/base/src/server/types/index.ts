import type { Role } from '../auth/roles'
import type { Env } from '../env'
import type { Database } from '../db/client'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  status: 'active' | 'inactive'
  providerIds: string[]
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Account {
  id: string
  name: string
  description: string | null
  domain: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface UserAccount {
  userId: string
  accountId: string
  role: Role
}

export interface AuditLog {
  id: string
  transactionId: string
  accountId: string | null
  userId: string | null
  entity: string
  entityId: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changes: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
}

export interface ServiceContext {
  accountId: string
  user: User
  userRole?: Role | null
  transactionId?: string
  ip?: string
  userAgent?: string
}

export interface PaginationQuery {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  query?: string
}

export interface PaginationMeta {
  currentPage: number
  limit: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Session data type (matches lib/session.ts)
export interface SessionData {
  userId: string
  email: string
  name: string
  avatarUrl?: string | null
  isSuperAdmin: boolean
  fingerprint?: {
    ip?: string
    userAgent?: string
  }
}

// Hono Environment type
// Note: Many variables are optional because they're set by different middlewares
// at different points in the request lifecycle
export interface HonoEnv {
  Bindings: Env
  Variables: {
    // Set by request-context middleware
    transactionId?: string
    ip?: string
    userAgent?: string
    // Set by auth middleware
    user: User | null
    // Set by account middleware
    accountId?: string
    userRole: Role | null
    isSystemAdminAccess: boolean
    // Set by database middleware (may be undefined before middleware runs or in health checks)
    db?: Database
    // Session variables (set by session middleware)
    sessionId?: string
    sessionData?: SessionData
    sessionCookies?: string[]
  }
}

export type * from './auth'
