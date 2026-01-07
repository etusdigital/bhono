/**
 * Products Service - Business Logic Layer
 *
 * Example of complete service implementation with:
 * - SQL helpers (queryOne, queryAll, execute)
 * - Multi-tenant filtering (accountId)
 * - Row mapping (SqlRow → Domain Type)
 * - Pagination support
 * - Audit logging
 */

import {
  queryAll,
  queryOne,
  execute,
  toStringValue,
  toNullableString,
  type SqlRow,
  type SqlParams,
} from '@server/db/sql'
import { NotFoundError, ForbiddenError, ConflictError } from '@server/lib/errors'
import { auditedUpdate, auditedDelete } from '@server/lib/audit'
import { buildPaginatedResponse, calculateOffset } from '@server/lib/pagination'
import type { ServiceContext } from '@server/types'
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
  ProductResponse,
} from './schemas'

// ============================================================================
// SQL Column Definitions
// ============================================================================

/**
 * Standard columns for SELECT queries
 * Use aliases for camelCase in results
 */
const COLUMNS = `
  id,
  account_id as accountId,
  name,
  description,
  price,
  status,
  created_at as createdAt,
  updated_at as updatedAt,
  created_by_id as createdById,
  updated_by_id as updatedById,
  deleted_at as deletedAt
`

// ============================================================================
// Row Mapper
// ============================================================================

/**
 * Map database row to domain type
 * Handles SQLite type conversions
 */
function mapProductRow(row: SqlRow): ProductResponse {
  return {
    id: toStringValue(row.id),
    accountId: toStringValue(row.accountId),
    name: toStringValue(row.name),
    description: toNullableString(row.description),
    price: Number(row.price),
    status: toStringValue(row.status) as 'draft' | 'active' | 'archived',
    createdAt: toStringValue(row.createdAt),
    updatedAt: toStringValue(row.updatedAt),
    createdById: toNullableString(row.createdById),
    updatedById: toNullableString(row.updatedById),
  }
}

// ============================================================================
// Service Object
// ============================================================================

export const productsService = {
  /**
   * Find all products with pagination and filters
   */
  async findAll(
    db: D1Database,
    ctx: ServiceContext,
    query: ListProductsQuery
  ) {
    const { page = 1, limit = 20, status, query: search } = query
    const offset = calculateOffset(page, limit)

    // Build WHERE clauses dynamically
    const whereClauses: string[] = ['deleted_at IS NULL']
    const params: SqlParams = []

    // Multi-tenant filtering (skip for super-admin)
    if (!ctx.user.isSuperAdmin) {
      whereClauses.push('account_id = ?')
      params.push(ctx.accountId)
    }

    // Status filter
    if (status) {
      whereClauses.push('status = ?')
      params.push(status)
    }

    // Search filter
    if (search) {
      whereClauses.push('(name LIKE ? OR description LIKE ?)')
      const like = `%${search}%`
      params.push(like, like)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    // Count total items
    const countRow = await queryOne<{ count: number }>(
      db,
      `SELECT count(*) as count FROM products ${whereSql}`,
      params
    )
    const totalItems = countRow?.count ?? 0

    // Fetch page
    const rows = await queryAll(
      db,
      `SELECT ${COLUMNS}
       FROM products
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const items = rows.map(mapProductRow)

    return buildPaginatedResponse(items, totalItems, page, limit)
  },

  /**
   * Find single product by ID
   * Throws NotFoundError if not found
   * Checks tenant access for non-super-admins
   */
  async findById(
    db: D1Database,
    ctx: ServiceContext,
    id: string
  ): Promise<ProductResponse> {
    const row = await queryOne(
      db,
      `SELECT ${COLUMNS}
       FROM products
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    )

    if (!row) {
      throw new NotFoundError('Product')
    }

    // Check tenant access
    if (!ctx.user.isSuperAdmin) {
      const productAccountId = toStringValue(row.accountId)
      if (productAccountId !== ctx.accountId) {
        throw new ForbiddenError('Product does not belong to this account')
      }
    }

    return mapProductRow(row)
  },

  /**
   * Create new product
   */
  async create(
    db: D1Database,
    ctx: ServiceContext,
    input: CreateProductInput
  ): Promise<ProductResponse> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await execute(
      db,
      `INSERT INTO products (
        id, account_id, name, description, price, status,
        created_at, updated_at, created_by_id, updated_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ctx.accountId,
        input.name,
        input.description ?? null,
        input.price,
        input.status,
        now,
        now,
        ctx.user.id,
        ctx.user.id,
      ]
    )

    return this.findById(db, ctx, id)
  },

  /**
   * Update existing product
   * Uses audited update for change tracking
   */
  async update(
    db: D1Database,
    ctx: ServiceContext,
    id: string,
    input: UpdateProductInput
  ): Promise<ProductResponse> {
    // Verify exists and has access
    await this.findById(db, ctx, id)

    // Build dynamic UPDATE
    const updates: string[] = []
    const params: SqlParams = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name)
    }
    if (input.description !== undefined) {
      updates.push('description = ?')
      params.push(input.description)
    }
    if (input.price !== undefined) {
      updates.push('price = ?')
      params.push(input.price)
    }
    if (input.status !== undefined) {
      updates.push('status = ?')
      params.push(input.status)
    }

    if (updates.length === 0) {
      return this.findById(db, ctx, id)
    }

    // Add audit fields
    const now = new Date().toISOString()
    updates.push('updated_at = ?', 'updated_by_id = ?')
    params.push(now, ctx.user.id, id)

    // Execute with audit logging
    await auditedUpdate(
      db,
      ctx,
      'products',
      id,
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
      params,
      input
    )

    return this.findById(db, ctx, id)
  },

  /**
   * Soft delete product
   * Uses audited delete for change tracking
   */
  async softDelete(
    db: D1Database,
    ctx: ServiceContext,
    id: string
  ): Promise<void> {
    // Verify exists and has access
    await this.findById(db, ctx, id)

    const now = new Date().toISOString()

    await auditedDelete(
      db,
      ctx,
      'products',
      id,
      `UPDATE products
       SET deleted_at = ?, deleted_by_id = ?, updated_at = ?, updated_by_id = ?
       WHERE id = ?`,
      [now, ctx.user.id, now, ctx.user.id, id]
    )
  },
}
