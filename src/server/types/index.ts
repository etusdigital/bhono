import type { Role } from '../auth/roles'
import type { Env } from '../env'

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
  transactionId: string
  ip: string
  userAgent: string
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

// Hono Environment type
export type HonoEnv = {
  Bindings: Env
  Variables: {
    transactionId: string
    ip: string
    userAgent: string
    user: User | null
    accountId: string
    userRole: Role | null
    isSystemAdminAccess: boolean
    db: any // Database instance injected by middleware
  }
}

export * from './auth'
