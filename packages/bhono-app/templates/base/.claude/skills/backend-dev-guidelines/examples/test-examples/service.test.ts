/**
 * Service Unit Tests Example
 *
 * Example of unit tests for service layer using Vitest.
 * Shows mocking patterns and test organization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productsService } from '../feature-crud/service'
import { NotFoundError, ForbiddenError } from '@server/lib/errors'
import type { ServiceContext } from '@server/types'

// ============================================================================
// Mocks
// ============================================================================

// Mock the SQL helpers
vi.mock('@server/db/sql', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
  toStringValue: (v: unknown) => String(v ?? ''),
  toNullableString: (v: unknown) => (v == null ? null : String(v)),
}))

// Mock audit functions
vi.mock('@server/lib/audit', () => ({
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}))

// Mock pagination helpers
vi.mock('@server/lib/pagination', () => ({
  calculateOffset: (page: number, limit: number) => (page - 1) * limit,
  buildPaginatedResponse: vi.fn((items, total, page, limit) => ({
    items,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    },
  })),
}))

// Import mocked modules
import { queryAll, queryOne, execute } from '@server/db/sql'
import { auditedUpdate, auditedDelete } from '@server/lib/audit'

// ============================================================================
// Test Fixtures
// ============================================================================

const mockDb = {} as D1Database

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  isSuperAdmin: false,
}

const mockSuperAdmin = {
  ...mockUser,
  id: 'admin-123',
  isSuperAdmin: true,
}

const mockContext: ServiceContext = {
  accountId: 'account-123',
  user: mockUser,
  userRole: 'EDITOR',
  transactionId: 'tx-123',
  ip: '127.0.0.1',
  userAgent: 'test',
}

const mockSuperAdminContext: ServiceContext = {
  ...mockContext,
  user: mockSuperAdmin,
}

const mockProductRow = {
  id: 'product-123',
  accountId: 'account-123',
  name: 'Test Product',
  description: 'A test product',
  price: 9999,
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdById: 'user-123',
  updatedById: 'user-123',
  deletedAt: null,
}

// ============================================================================
// Tests
// ============================================================================

describe('productsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('should return product when found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(mockProductRow)

      const result = await productsService.findById(
        mockDb,
        mockContext,
        'product-123'
      )

      expect(result).toEqual({
        id: 'product-123',
        accountId: 'account-123',
        name: 'Test Product',
        description: 'A test product',
        price: 9999,
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdById: 'user-123',
        updatedById: 'user-123',
      })
    })

    it('should throw NotFoundError when product not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null)

      await expect(
        productsService.findById(mockDb, mockContext, 'nonexistent')
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError when product belongs to different account', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        ...mockProductRow,
        accountId: 'different-account',
      })

      await expect(
        productsService.findById(mockDb, mockContext, 'product-123')
      ).rejects.toThrow(ForbiddenError)
    })

    it('should allow super admin to access any account', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        ...mockProductRow,
        accountId: 'different-account',
      })

      const result = await productsService.findById(
        mockDb,
        mockSuperAdminContext,
        'product-123'
      )

      expect(result.accountId).toBe('different-account')
    })
  })

  describe('findAll', () => {
    it('should return paginated results', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: 25 })
      vi.mocked(queryAll).mockResolvedValueOnce([
        mockProductRow,
        { ...mockProductRow, id: 'product-456' },
      ])

      const result = await productsService.findAll(mockDb, mockContext, {
        page: 1,
        limit: 20,
      })

      expect(result.items).toHaveLength(2)
      expect(result.pagination.totalItems).toBe(25)
    })

    it('should filter by status', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: 5 })
      vi.mocked(queryAll).mockResolvedValueOnce([mockProductRow])

      await productsService.findAll(mockDb, mockContext, {
        page: 1,
        limit: 20,
        status: 'active',
      })

      // Check that status filter was applied
      expect(queryAll).toHaveBeenCalledWith(
        mockDb,
        expect.stringContaining('status = ?'),
        expect.arrayContaining(['active'])
      )
    })

    it('should apply search filter', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: 1 })
      vi.mocked(queryAll).mockResolvedValueOnce([mockProductRow])

      await productsService.findAll(mockDb, mockContext, {
        page: 1,
        limit: 20,
        query: 'widget',
      })

      expect(queryAll).toHaveBeenCalledWith(
        mockDb,
        expect.stringContaining('LIKE'),
        expect.arrayContaining(['%widget%', '%widget%'])
      )
    })

    it('should skip account filter for super admin', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: 100 })
      vi.mocked(queryAll).mockResolvedValueOnce([])

      await productsService.findAll(mockDb, mockSuperAdminContext, {
        page: 1,
        limit: 20,
      })

      // Should NOT include account_id filter
      expect(queryAll).toHaveBeenCalledWith(
        mockDb,
        expect.not.stringContaining('account_id = ?'),
        expect.any(Array)
      )
    })
  })

  describe('create', () => {
    it('should create product and return it', async () => {
      vi.mocked(execute).mockResolvedValueOnce(undefined)
      vi.mocked(queryOne).mockResolvedValueOnce(mockProductRow)

      const result = await productsService.create(mockDb, mockContext, {
        name: 'New Product',
        description: 'A new product',
        price: 1999,
        status: 'draft',
      })

      expect(execute).toHaveBeenCalledWith(
        mockDb,
        expect.stringContaining('INSERT INTO products'),
        expect.arrayContaining(['New Product', 'A new product', 1999, 'draft'])
      )
      expect(result.id).toBeDefined()
    })
  })

  describe('update', () => {
    it('should update product with audited function', async () => {
      // Mock findById
      vi.mocked(queryOne)
        .mockResolvedValueOnce(mockProductRow) // First call: verify exists
        .mockResolvedValueOnce({ ...mockProductRow, name: 'Updated' }) // Second call: return updated

      vi.mocked(auditedUpdate).mockResolvedValueOnce(undefined)

      const result = await productsService.update(
        mockDb,
        mockContext,
        'product-123',
        { name: 'Updated' }
      )

      expect(auditedUpdate).toHaveBeenCalledWith(
        mockDb,
        mockContext,
        'products',
        'product-123',
        expect.stringContaining('UPDATE products SET'),
        expect.any(Array),
        { name: 'Updated' }
      )
    })

    it('should skip update if no fields provided', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(mockProductRow)

      await productsService.update(mockDb, mockContext, 'product-123', {})

      expect(auditedUpdate).not.toHaveBeenCalled()
    })
  })

  describe('softDelete', () => {
    it('should soft delete with audit', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(mockProductRow)
      vi.mocked(auditedDelete).mockResolvedValueOnce(undefined)

      await productsService.softDelete(mockDb, mockContext, 'product-123')

      expect(auditedDelete).toHaveBeenCalledWith(
        mockDb,
        mockContext,
        'products',
        'product-123',
        expect.stringContaining('deleted_at = ?'),
        expect.any(Array)
      )
    })
  })
})
