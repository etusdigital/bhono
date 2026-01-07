/**
 * Products Router - Wires routes, handlers, and guards
 *
 * Example of complete router setup with:
 * - OpenAPIHono for OpenAPI documentation
 * - Route registration with handlers
 * - Guard application for RBAC
 * - Swagger path conversion
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '@server/types'
import { requireRole } from '@server/auth/guards'
import { toHonoPath } from '@server/routes/openapi'

// Import routes and handlers
import {
  listProductsRoute,
  getProductRoute,
  createProductRoute,
  updateProductRoute,
  deleteProductRoute,
} from './routes'
import {
  listProductsHandler,
  getProductHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from './handlers'

// ============================================================================
// Router Setup
// ============================================================================

const products = new OpenAPIHono<HonoEnv>()

// ============================================================================
// Public Routes (Auth required via parent router)
// ============================================================================

// GET /products - List all products (any authenticated user)
products.openapi(listProductsRoute, listProductsHandler)

// GET /products/:id - Get single product (any authenticated user)
products.openapi(getProductRoute, getProductHandler)

// ============================================================================
// Protected Routes (EDITOR role required)
// ============================================================================

// Apply EDITOR guard before create/update routes
products.use(toHonoPath(createProductRoute.path), requireRole('EDITOR'))
products.use(toHonoPath(updateProductRoute.path), requireRole('EDITOR'))

// POST /products - Create product (EDITOR+)
products.openapi(createProductRoute, createProductHandler)

// PATCH /products/:id - Update product (EDITOR+)
products.openapi(updateProductRoute, updateProductHandler)

// ============================================================================
// Admin Routes (ADMIN role required)
// ============================================================================

// Apply ADMIN guard before delete route
products.use(toHonoPath(deleteProductRoute.path), requireRole('ADMIN'))

// DELETE /products/:id - Delete product (ADMIN only)
products.openapi(deleteProductRoute, deleteProductHandler)

// ============================================================================
// Export
// ============================================================================

export { products }

/**
 * Mount in main router:
 *
 * // src/server/routes/index.ts
 * import { products } from './products'
 *
 * // Inside authenticated routes
 * api.route('/products', products)
 */
