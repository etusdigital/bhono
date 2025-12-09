import { z } from 'zod'
import type { PaginationMeta } from '../types'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  query: z.string().optional(),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export function createPaginationMeta(
  totalItems: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit)
  return {
    currentPage: page,
    limit,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit
}
