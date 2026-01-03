import { describe, it, expect, vi } from 'vitest'
import { withTransaction } from './transaction'

describe('withTransaction', () => {
  it('returns result from successful callback', async () => {
    const mockTx = { insert: vi.fn(), update: vi.fn() }
    const mockDb = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    }

    const result = await withTransaction(mockDb as any, async (tx) => {
      return { id: '123', name: 'Test' }
    })

    expect(result).toEqual({ id: '123', name: 'Test' })
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
  })

  it('propagates errors from callback', async () => {
    const mockDb = {
      transaction: vi.fn(async (cb) => cb({})),
    }

    await expect(
      withTransaction(mockDb as any, async () => {
        throw new Error('Database error')
      })
    ).rejects.toThrow('Database error')
  })

  it('passes transaction to callback', async () => {
    const mockTx = { insert: vi.fn(), update: vi.fn() }
    const mockDb = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    }

    let receivedTx: any
    await withTransaction(mockDb as any, async (tx) => {
      receivedTx = tx
      return null
    })

    expect(receivedTx).toBe(mockTx)
  })
})
