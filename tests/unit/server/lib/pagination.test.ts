import { describe, it, expect } from 'vitest'
import { createPaginationMeta, PaginationQuerySchema } from '@server/lib/pagination'

describe('pagination', () => {
  describe('createPaginationMeta', () => {
    it('should calculate correct pagination meta', () => {
      const meta = createPaginationMeta(100, 2, 10)

      expect(meta.currentPage).toBe(2)
      expect(meta.limit).toBe(10)
      expect(meta.totalItems).toBe(100)
      expect(meta.totalPages).toBe(10)
      expect(meta.hasPreviousPage).toBe(true)
      expect(meta.hasNextPage).toBe(true)
    })

    it('should return hasPreviousPage false on first page', () => {
      const meta = createPaginationMeta(100, 1, 10)
      expect(meta.hasPreviousPage).toBe(false)
    })

    it('should return hasNextPage false on last page', () => {
      const meta = createPaginationMeta(100, 10, 10)
      expect(meta.hasNextPage).toBe(false)
    })

    it('should handle empty results', () => {
      const meta = createPaginationMeta(0, 1, 10)
      expect(meta.totalPages).toBe(0)
      expect(meta.hasNextPage).toBe(false)
    })
  })

  describe('PaginationQuerySchema', () => {
    it('should use defaults for missing values', () => {
      const result = PaginationQuerySchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(50)
      expect(result.sortOrder).toBe('DESC')
    })

    it('should coerce string numbers', () => {
      const result = PaginationQuerySchema.parse({ page: '2', limit: '25' })
      expect(result.page).toBe(2)
      expect(result.limit).toBe(25)
    })

    it('should enforce limit max of 100', () => {
      expect(() => PaginationQuerySchema.parse({ limit: 200 })).toThrow()
    })
  })
})
