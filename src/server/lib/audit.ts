import { db } from '../db/client'
import { auditLogs } from '../db/schema'
import type { ServiceContext } from '../types'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'

export async function logAudit(
  ctx: ServiceContext,
  entity: string,
  entityId: string,
  action: AuditAction,
  changes: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLogs).values({
    transactionId: ctx.transactionId,
    accountId: ctx.accountId,
    userId: ctx.user.id,
    entity,
    entityId,
    action,
    changes,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  })
}

export function createChangeDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      }
    }
  }

  return changes
}

// Auth event context - doesn't require full ServiceContext
export interface AuthEventContext {
  transactionId: string
  ip: string
  userAgent: string
}

export type AuthAction = 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'

export async function logAuthEvent(
  ctx: AuthEventContext,
  action: AuthAction,
  userId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLogs).values({
    transactionId: ctx.transactionId,
    accountId: null, // Auth events are account-agnostic
    userId,
    entity: 'Auth',
    entityId: userId || 'anonymous',
    action,
    changes: details,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  })
}
