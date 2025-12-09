import { z } from '@hono/zod-openapi'

// Error response schema
export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: 'Error message' }),
    statusCode: z.number().openapi({ example: 400 }),
    details: z.unknown().optional(),
  })
  .openapi('ErrorResponse')

// Pagination meta schema
export const PaginationMetaSchema = z
  .object({
    currentPage: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 50 }),
    totalItems: z.number().openapi({ example: 100 }),
    totalPages: z.number().openapi({ example: 2 }),
    hasPreviousPage: z.boolean().openapi({ example: false }),
    hasNextPage: z.boolean().openapi({ example: true }),
  })
  .openapi('PaginationMeta')

// Pagination query schema
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().min(1).max(100).default(50).openapi({ example: 50 }),
  sortBy: z.string().optional().openapi({ example: 'createdAt' }),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC').openapi({ example: 'DESC' }),
  query: z.string().optional().openapi({ example: 'search term' }),
})

// Create paginated response schema factory
export const createPaginatedSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) =>
  z
    .object({
      data: z.array(itemSchema),
      meta: PaginationMetaSchema,
    })
    .openapi(`Paginated${name}`)

// UUID param schema
export const IdParamSchema = z.object({
  id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
})

// Account header schema
export const AccountHeaderSchema = z.object({
  'account-id': z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
})
