// src/server/services/audits.ts
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import type { ServiceContext, PaginatedResponse, AuditLog } from '../types'
import { queryAll, queryOne, toStringValue, toNullableString, type SqlRow, type SqlParams } from '../db/sql'

export interface AuditLogFilters {
  page: number
  limit: number
  entity?: string
  entityId?: string
  action?: string
}


const AUDIT_SELECT_COLUMNS = `
  id,
  transaction_id as transactionId,
  account_id as accountId,
  user_id as userId,
  entity,
  entity_id as entityId,
  action,
  changes,
  ip_address as ipAddress,
  user_agent as userAgent,
  timestamp
`


function parseChanges(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

function mapAuditRow(row: SqlRow): AuditLog {
  const transactionId = row.transactionId ?? row.transaction_id
  const accountId = row.accountId ?? row.account_id
  const userId = row.userId ?? row.user_id
  const entityId = row.entityId ?? row.entity_id
  const ipAddress = row.ipAddress ?? row.ip_address
  const userAgent = row.userAgent ?? row.user_agent
  const changesValue = row.changes

  return {
    id: toStringValue(row.id),
    transactionId: toStringValue(transactionId),
    accountId: toNullableString(accountId),
    userId: toNullableString(userId),
    entity: toStringValue(row.entity),
    entityId: toStringValue(entityId),
    action: toStringValue(row.action) as AuditLog['action'],
    changes: parseChanges(changesValue),
    ipAddress: toNullableString(ipAddress),
    userAgent: toNullableString(userAgent),
    timestamp: toStringValue(row.timestamp),
  }
}


async function findAllSql(
  db: D1Database,
  ctx: ServiceContext,
  filters: AuditLogFilters
): Promise<PaginatedResponse<AuditLog>> {
  const offset = calculateOffset(filters.page, filters.limit)
  const whereClauses: string[] = []
  const params: SqlParams = []

  // Super-admin can see all logs, non-super-admin only their account
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('account_id = ?')
    params.push(ctx.accountId)
  }

  if (filters.entity) {
    whereClauses.push('entity = ?')
    params.push(filters.entity)
  }

  if (filters.entityId) {
    whereClauses.push('entity_id = ?')
    params.push(filters.entityId)
  }

  if (filters.action) {
    whereClauses.push('action = ?')
    params.push(filters.action)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM audit_logs ${whereSql}`,
    params
  )

  const totalItems = countRow?.count ?? 0

  const rows = await queryAll(
    db,
    `SELECT ${AUDIT_SELECT_COLUMNS}
     FROM audit_logs
     ${whereSql}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset]
  )

  return {
    data: rows.map((row) => mapAuditRow(row)),
    meta: createPaginationMeta(totalItems, filters.page, filters.limit),
  }
}

export const auditsService = {
  async findAll(
    db: D1Database,
    ctx: ServiceContext,
    filters: AuditLogFilters
  ): Promise<PaginatedResponse<AuditLog>> {
    return findAllSql(db, ctx, filters)
  },
}
