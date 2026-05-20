import type { AuthUser, Account as AuthAccount, Membership } from '@etus/auth'
import type { Env } from '../env'

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

// Hono Environment type.
// Identity/tenancy is owned by @etus/auth — its middleware populates the
// auth* variables. The legacy user/accountId variables are kept optional
// only so the pre-auth middlewares (request-context, request-logger) keep
// compiling; they are no longer the source of truth.
export interface HonoEnv {
  Bindings: Env
  Variables: {
    // Set by request-context middleware
    transactionId?: string
    ip?: string
    userAgent?: string
    // Set by @etus/auth middleware
    authUser?: AuthUser | null
    authSessionId?: string | null
    authPermissions?: string[]
    authAccount?: AuthAccount | null
    authMembership?: Membership | null
    // Set by the database middleware
    db?: D1Database
  }
}
