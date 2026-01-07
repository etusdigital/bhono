/**
 * Product Schemas - Zod + OpenAPI validation
 *
 * Example of complete schema definitions for a CRUD feature.
 * Copy and adapt for your own features.
 */

import { z } from '@hono/zod-openapi'
import {
  PaginationQuerySchema,
  createPaginatedSchema,
} from '@shared/schemas/pagination'

// ============================================================================
// Base Schemas (Reusable)
// ============================================================================

/**
 * Product status enum
 */
export const ProductStatusSchema = z
  .enum(['draft', 'active', 'archived'])
  .openapi({
    description: 'Product publication status',
    example: 'active',
  })

/**
 * Base product fields (shared between create/update/response)
 */
const productBaseFields = {
  name: z.string().min(1).max(255).openapi({
    description: 'Product name',
    example: 'Premium Widget',
  }),
  description: z.string().max(2000).nullable().openapi({
    description: 'Product description',
    example: 'High-quality widget for professional use',
  }),
  price: z.number().min(0).openapi({
    description: 'Product price in cents',
    example: 9999,
  }),
  status: ProductStatusSchema,
}

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create product input
 */
export const CreateProductSchema = z
  .object({
    ...productBaseFields,
    status: ProductStatusSchema.default('draft'),
  })
  .openapi('CreateProductInput')

/**
 * Update product input (all fields optional)
 */
export const UpdateProductSchema = z
  .object({
    name: productBaseFields.name.optional(),
    description: productBaseFields.description.optional(),
    price: productBaseFields.price.optional(),
    status: ProductStatusSchema.optional(),
  })
  .openapi('UpdateProductInput')

/**
 * List products query params
 */
export const ListProductsQuerySchema = PaginationQuerySchema.extend({
  status: ProductStatusSchema.optional().openapi({
    description: 'Filter by status',
  }),
  query: z.string().optional().openapi({
    description: 'Search by name or description',
  }),
}).openapi('ListProductsQuery')

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Single product response
 */
export const ProductResponseSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: 'Product unique identifier',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    accountId: z.string().uuid().openapi({
      description: 'Account that owns this product',
    }),
    ...productBaseFields,
    createdAt: z.string().datetime().openapi({
      description: 'Creation timestamp',
      example: '2024-01-01T00:00:00.000Z',
    }),
    updatedAt: z.string().datetime().openapi({
      description: 'Last update timestamp',
    }),
    createdById: z.string().uuid().nullable().openapi({
      description: 'User who created the product',
    }),
    updatedById: z.string().uuid().nullable().openapi({
      description: 'User who last updated the product',
    }),
  })
  .openapi('ProductResponse')

/**
 * Paginated products response
 */
export const ProductListResponseSchema = createPaginatedSchema(
  ProductResponseSchema
).openapi('ProductListResponse')

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const ProductIdParamSchema = z.object({
  id: z.string().uuid().openapi({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    param: { name: 'id', in: 'path' },
  }),
})

// ============================================================================
// Type Exports (for use in handlers/services)
// ============================================================================

export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>
export type ProductResponse = z.infer<typeof ProductResponseSchema>
