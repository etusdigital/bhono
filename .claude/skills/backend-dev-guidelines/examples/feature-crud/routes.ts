/**
 * Product Routes - OpenAPI route definitions
 *
 * Example of complete route definitions with OpenAPI documentation.
 * Routes define the API contract; handlers implement the logic.
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  CreateProductSchema,
  UpdateProductSchema,
  ListProductsQuerySchema,
  ProductResponseSchema,
  ProductListResponseSchema,
  ProductIdParamSchema,
} from './schemas'

// ============================================================================
// Common Response Schemas
// ============================================================================

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.number(),
    timestamp: z.string(),
    details: z.unknown().optional(),
  }),
})

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * List products with pagination and filters
 */
export const listProductsRoute = createRoute({
  method: 'get',
  path: '/products',
  tags: ['Products'],
  summary: 'List products',
  description: 'Get paginated list of products with optional filters',
  request: {
    query: ListProductsQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of products',
      content: {
        'application/json': {
          schema: z.object({ data: ProductListResponseSchema }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
  },
})

/**
 * Get single product by ID
 */
export const getProductRoute = createRoute({
  method: 'get',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Get product',
  description: 'Get a single product by ID',
  request: {
    params: ProductIdParamSchema,
  },
  responses: {
    200: {
      description: 'Product details',
      content: {
        'application/json': {
          schema: z.object({ data: ProductResponseSchema }),
        },
      },
    },
    404: {
      description: 'Product not found',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
  },
})

/**
 * Create new product
 */
export const createProductRoute = createRoute({
  method: 'post',
  path: '/products',
  tags: ['Products'],
  summary: 'Create product',
  description: 'Create a new product',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProductSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Product created successfully',
      content: {
        'application/json': {
          schema: z.object({ data: ProductResponseSchema }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
    409: {
      description: 'Conflict - product already exists',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
  },
})

/**
 * Update existing product
 */
export const updateProductRoute = createRoute({
  method: 'patch',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Update product',
  description: 'Update an existing product',
  request: {
    params: ProductIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateProductSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Product updated successfully',
      content: {
        'application/json': {
          schema: z.object({ data: ProductResponseSchema }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
    404: {
      description: 'Product not found',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
  },
})

/**
 * Delete product (soft delete)
 */
export const deleteProductRoute = createRoute({
  method: 'delete',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Delete product',
  description: 'Soft delete a product',
  request: {
    params: ProductIdParamSchema,
  },
  responses: {
    204: {
      description: 'Product deleted successfully',
    },
    404: {
      description: 'Product not found',
      content: {
        'application/json': { schema: ErrorResponseSchema },
      },
    },
  },
})
