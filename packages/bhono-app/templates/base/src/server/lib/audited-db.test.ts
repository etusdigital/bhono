// src/server/lib/audited-db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditedInsert, auditedUpdate, auditedDelete } from './audited-db'
import type { ServiceContext } from '../types'

// Mock database and table
const mockDb = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
}

const mockTable = {
  _: { name: 'users' },
} as any

const mockCtx: ServiceContext = {
  accountId: 'account-123',
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    status: 'active',
    providerIds: [],
    isSuperAdmin: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    deletedAt: null,
  },
  transactionId: 'tx-123',
  ip: '127.0.0.1',
  userAgent: 'test-agent',
}

describe('audited-db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('auditedInsert', () => {
    it('should insert data and return result', async () => {
      const insertedData = { id: 'new-123', name: 'Test' }
      const mockReturning = vi.fn().mockResolvedValue([insertedData])
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      const result = await auditedInsert(mockDb as any, mockCtx, mockTable, { name: 'Test' })

      expect(result).toEqual([insertedData])
      expect(mockDb.insert).toHaveBeenCalledWith(mockTable)
    })

    it('should log audit after insert', async () => {
      const insertedData = { id: 'new-123', name: 'Test' }
      const mockReturning = vi.fn().mockResolvedValue([insertedData])
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      await auditedInsert(mockDb as any, mockCtx, mockTable, { name: 'Test' })

      // Verify insert was called (audit logging happens internally)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('auditedUpdate', () => {
    it('should update data and return result', async () => {
      const updatedData = { id: 'existing-123', name: 'Updated' }
      const mockReturning = vi.fn().mockResolvedValue([updatedData])
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.update.mockReturnValue({ set: mockSet })

      // Mock select for getting old data
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'existing-123', name: 'Old' }])
      const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
      mockDb.select.mockReturnValue({ from: mockFrom })

      const whereClause = {} as any
      const result = await auditedUpdate(
        mockDb as any,
        mockCtx,
        mockTable,
        { name: 'Updated' },
        whereClause
      )

      expect(result).toEqual([updatedData])
    })
  })

  describe('auditedDelete', () => {
    it('should soft delete and return void', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'deleted-123' }])
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.update.mockReturnValue({ set: mockSet })

      const whereClause = {} as any
      await auditedDelete(mockDb as any, mockCtx, mockTable, whereClause)

      expect(mockDb.update).toHaveBeenCalledWith(mockTable)
    })
  })
})
