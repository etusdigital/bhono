/**
 * Product Handlers - Request/Response logic
 *
 * Example of complete handler implementations.
 * Handlers extract validated data, build context, call services, return responses.
 */

import type { RouteHandler } from '@hono/zod-openapi'
import type { HonoEnv } from '@server/types'
import {
  listProductsRoute,
  getProductRoute,
  createProductRoute,
  updateProductRoute,
  deleteProductRoute,
} from './routes'
import { productsService } from './service'

// ============================================================================
// Helper: Build ServiceContext from Hono Context
// ============================================================================

/**
 * Extract ServiceContext from Hono context
 * Provides consistent context for all service calls
 */
function buildServiceContext(c: Parameters<RouteHandler<typeof listProductsRoute, HonoEnv>>[0]) {
  return {
    accountId: c.get('accountId') ?? '',
    user: c.get('user')!,
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * List products with pagination and filters
 * No additional guard - uses parent router's auth
 */
export const listProductsHandler: RouteHandler<typeof listProductsRoute, HonoEnv> = async (c) => {
  // 1. Extract validated query params
  const query = c.req.valid('query')

  // 2. Get database binding
  const db = c.get('db')
  if (!db) {
    throw new Error('Database not available')
  }

  // 3. Build service context
  const ctx = buildServiceContext(c)

  // 4. Call service
  const result = await productsService.findAll(db, ctx, query)

  // 5. Return paginated response
  return c.json({ data: result }, 200)
}

/**
 * Get single product by ID
 */
export const getProductHandler: RouteHandler<typeof getProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  if (!db) throw new Error('Database not available')

  const ctx = buildServiceContext(c)
  const product = await productsService.findById(db, ctx, id)

  return c.json({ data: product }, 200)
}

/**
 * Create new product
 * Requires EDITOR role or higher (configured in index.ts)
 */
export const createProductHandler: RouteHandler<typeof createProductRoute, HonoEnv> = async (c) => {
  const input = c.req.valid('json')
  const db = c.get('db')
  if (!db) throw new Error('Database not available')

  const ctx = buildServiceContext(c)
  const product = await productsService.create(db, ctx, input)

  return c.json({ data: product }, 201)
}

/**
 * Update existing product
 * Requires EDITOR role or higher (configured in index.ts)
 */
export const updateProductHandler: RouteHandler<typeof updateProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const db = c.get('db')
  if (!db) throw new Error('Database not available')

  const ctx = buildServiceContext(c)
  const product = await productsService.update(db, ctx, id, input)

  return c.json({ data: product }, 200)
}

/**
 * Delete product (soft delete)
 * Requires ADMIN role (configured in index.ts)
 */
export const deleteProductHandler: RouteHandler<typeof deleteProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  if (!db) throw new Error('Database not available')

  const ctx = buildServiceContext(c)
  await productsService.softDelete(db, ctx, id)

  return c.body(null, 204)
}
