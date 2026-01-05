/**
 * Search and Filter Pattern
 *
 * Example of dynamic query building with multiple filters.
 * Shows how to safely construct WHERE clauses and handle pagination.
 */

import {
  queryAll,
  queryOne,
  toStringValue,
  toNullableString,
  type SqlRow,
  type SqlParams,
} from '@server/db/sql'
import { buildPaginatedResponse, calculateOffset } from '@server/lib/pagination'
import type { ServiceContext } from '@server/types'

// ============================================================================
// Filter Types
// ============================================================================

interface OrderFilters {
  // Pagination
  page?: number
  limit?: number

  // Filters
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  customerId?: string
  minTotal?: number
  maxTotal?: number
  dateFrom?: string
  dateTo?: string

  // Search
  query?: string

  // Sorting
  sortBy?: 'createdAt' | 'total' | 'status'
  sortOrder?: 'asc' | 'desc'
}

interface OrderResponse {
  id: string
  accountId: string
  customerId: string
  customerName: string | null
  status: string
  total: number
  itemCount: number
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Row Mapper
// ============================================================================

function mapOrderRow(row: SqlRow): OrderResponse {
  return {
    id: toStringValue(row.id),
    accountId: toStringValue(row.accountId),
    customerId: toStringValue(row.customerId),
    customerName: toNullableString(row.customerName),
    status: toStringValue(row.status),
    total: Number(row.total),
    itemCount: Number(row.itemCount),
    createdAt: toStringValue(row.createdAt),
    updatedAt: toStringValue(row.updatedAt),
  }
}

// ============================================================================
// Service
// ============================================================================

export const ordersService = {
  /**
   * Advanced search with multiple filters and sorting
   */
  async search(
    db: D1Database,
    ctx: ServiceContext,
    filters: OrderFilters
  ) {
    const {
      page = 1,
      limit = 20,
      status,
      customerId,
      minTotal,
      maxTotal,
      dateFrom,
      dateTo,
      query,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters

    const offset = calculateOffset(page, limit)

    // ========================================
    // Build WHERE clauses dynamically
    // ========================================
    const whereClauses: string[] = ['o.deleted_at IS NULL']
    const params: SqlParams = []

    // Multi-tenant filter (always applied for non-super-admins)
    if (!ctx.user.isSuperAdmin) {
      whereClauses.push('o.account_id = ?')
      params.push(ctx.accountId)
    }

    // Status filter
    if (status) {
      whereClauses.push('o.status = ?')
      params.push(status)
    }

    // Customer filter
    if (customerId) {
      whereClauses.push('o.customer_id = ?')
      params.push(customerId)
    }

    // Total range filters
    if (minTotal !== undefined) {
      whereClauses.push('o.total >= ?')
      params.push(minTotal)
    }
    if (maxTotal !== undefined) {
      whereClauses.push('o.total <= ?')
      params.push(maxTotal)
    }

    // Date range filters
    if (dateFrom) {
      whereClauses.push('o.created_at >= ?')
      params.push(dateFrom)
    }
    if (dateTo) {
      whereClauses.push('o.created_at <= ?')
      params.push(dateTo)
    }

    // Text search (customer name or order ID)
    if (query) {
      whereClauses.push('(c.name LIKE ? OR o.id LIKE ?)')
      const like = `%${query}%`
      params.push(like, like)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    // ========================================
    // Build ORDER BY clause
    // ========================================
    const sortColumns: Record<string, string> = {
      createdAt: 'o.created_at',
      total: 'o.total',
      status: 'o.status',
    }
    const orderColumn = sortColumns[sortBy] ?? 'o.created_at'
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const orderSql = `ORDER BY ${orderColumn} ${orderDirection}`

    // ========================================
    // Count total (for pagination)
    // ========================================
    const countRow = await queryOne<{ count: number }>(
      db,
      `SELECT count(*) as count
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       ${whereSql}`,
      params
    )
    const totalItems = countRow?.count ?? 0

    // ========================================
    // Fetch page with JOIN
    // ========================================
    const rows = await queryAll(
      db,
      `SELECT
         o.id,
         o.account_id as accountId,
         o.customer_id as customerId,
         c.name as customerName,
         o.status,
         o.total,
         o.item_count as itemCount,
         o.created_at as createdAt,
         o.updated_at as updatedAt
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       ${whereSql}
       ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const items = rows.map(mapOrderRow)

    return buildPaginatedResponse(items, totalItems, page, limit)
  },

  /**
   * Get aggregated stats with filters
   */
  async getStats(
    db: D1Database,
    ctx: ServiceContext,
    filters: Pick<OrderFilters, 'dateFrom' | 'dateTo' | 'status'>
  ) {
    const { dateFrom, dateTo, status } = filters

    const whereClauses: string[] = ['deleted_at IS NULL']
    const params: SqlParams = []

    if (!ctx.user.isSuperAdmin) {
      whereClauses.push('account_id = ?')
      params.push(ctx.accountId)
    }

    if (status) {
      whereClauses.push('status = ?')
      params.push(status)
    }

    if (dateFrom) {
      whereClauses.push('created_at >= ?')
      params.push(dateFrom)
    }

    if (dateTo) {
      whereClauses.push('created_at <= ?')
      params.push(dateTo)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const row = await queryOne<{
      totalOrders: number
      totalRevenue: number
      avgOrderValue: number
    }>(
      db,
      `SELECT
         count(*) as totalOrders,
         coalesce(sum(total), 0) as totalRevenue,
         coalesce(avg(total), 0) as avgOrderValue
       FROM orders
       ${whereSql}`,
      params
    )

    return {
      totalOrders: row?.totalOrders ?? 0,
      totalRevenue: row?.totalRevenue ?? 0,
      avgOrderValue: Math.round(row?.avgOrderValue ?? 0),
    }
  },
}
