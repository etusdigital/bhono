import { execute } from '../db/sql'
import type { ServiceContext } from '../types'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'

async function logAuditSql(
  db: D1Database,
  ctx: ServiceContext,
  entity: string,
  entityId: string,
  action: AuditAction,
  changes: Record<string, unknown>
): Promise<void> {
  const id = crypto.randomUUID()
  const changesJson = Object.keys(changes).length > 0 ? JSON.stringify(changes) : null

  await execute(
    db,
    `INSERT INTO audit_logs (
      id,
      transaction_id,
      account_id,
      user_id,
      entity,
      entity_id,
      action,
      changes,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ctx.transactionId ?? crypto.randomUUID(),
      ctx.accountId,
      ctx.user.id,
      entity,
      entityId,
      action,
      changesJson,
      ctx.ip ?? null,
      ctx.userAgent ?? null,
    ]
  )
}

export async function logAudit(
  db: D1Database,
  ctx: ServiceContext,
  entity: string,
  entityId: string,
  action: AuditAction,
  changes: Record<string, unknown>
): Promise<void> {
  await logAuditSql(db, ctx, entity, entityId, action, changes)
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
  transactionId?: string
  ip?: string
  userAgent?: string
}

export type AuthAction = 'LOGIN' | 'LOGOUT' | 'SIGNUP' | 'TOKEN_REFRESH' | 'LOGIN_FAILED'

export async function logAuthEvent(
  db: D1Database,
  ctx: AuthEventContext,
  action: AuthAction,
  userId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  const id = crypto.randomUUID()
  const changesJson = Object.keys(details).length > 0 ? JSON.stringify(details) : null

  await execute(
    db,
    `INSERT INTO audit_logs (
      id,
      transaction_id,
      account_id,
      user_id,
      entity,
      entity_id,
      action,
      changes,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ctx.transactionId ?? crypto.randomUUID(),
      null,
      userId,
      'Auth',
      userId ?? 'anonymous',
      action,
      changesJson,
      ctx.ip ?? null,
      ctx.userAgent ?? null,
    ]
  )
}
