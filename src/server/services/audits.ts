// src/server/services/audits.ts
import { eq, and, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { auditLogs } from '../db/schema'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import type { ServiceContext, PaginatedResponse, AuditLog } from '../types'

export interface AuditLogFilters {
  page: number
  limit: number
  entity?: string
  entityId?: string
  action?: string
}

export const auditsService = {
  async findAll(
    db: Database,
    ctx: ServiceContext,
    filters: AuditLogFilters
  ): Promise<PaginatedResponse<AuditLog>> {
    const offset = calculateOffset(filters.page, filters.limit)

    // Build query conditions - always filter by accountId for multi-tenancy
    const conditions = []

    // Super-admin can see all logs, non-super-admin only their account
    if (!ctx.user.isSuperAdmin) {
      conditions.push(eq(auditLogs.accountId, ctx.accountId))
    }

    // Optional filters
    if (filters.entity) {
      conditions.push(eq(auditLogs.entity, filters.entity))
    }

    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId))
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action as any))
    }

    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause)

    const totalItems = countResult?.count ?? 0

    // Get paginated data
    const data = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .limit(filters.limit)
      .offset(offset)
      .orderBy(sql`${auditLogs.timestamp} DESC`)

    return {
      data: data.map((log) => ({
        id: log.id,
        transactionId: log.transactionId,
        accountId: log.accountId,
        userId: log.userId,
        entity: log.entity,
        entityId: log.entityId,
        action: log.action as AuditLog['action'],
        changes: log.changes,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
      })),
      meta: createPaginationMeta(totalItems, filters.page, filters.limit),
    }
  },
}
