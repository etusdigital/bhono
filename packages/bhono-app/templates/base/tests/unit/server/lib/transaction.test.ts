import { describe, it, expect, vi } from 'vitest'
import { withTransaction } from '@server/lib/transaction'

describe('withTransaction', () => {
  it('returns result from successful callback', async () => {
    const mockDb = { prepare: vi.fn() }

    const result = await withTransaction(mockDb as any, async (tx) => {
      return { id: '123', name: 'Test' }
    })

    expect(result).toEqual({ id: '123', name: 'Test' })
  })

  it('propagates errors from callback', async () => {
    const mockDb = { prepare: vi.fn() }

    await expect(
      withTransaction(mockDb as any, async () => {
        throw new Error('Database error')
      })
    ).rejects.toThrow('Database error')
  })

  it('passes transaction to callback', async () => {
    const mockDb = { prepare: vi.fn() }

    let receivedTx: any
    await withTransaction(mockDb as any, async (tx) => {
      receivedTx = tx
      return null
    })

    expect(receivedTx).toBe(mockDb)
  })
})
