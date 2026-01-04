// src/server/lib/audited-db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditedInsert, auditedUpdate, auditedDelete } from '@server/lib/audited-db'
import type { ServiceContext } from '@server/types'
import { createMockEnv, setMockQueryResult } from '@tests/helpers/server'

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

describe('audited-db (sql)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auditedInsert inserts and returns rows with SQL', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock

    setMockQueryResult(mockDb, ['user-1', 'Alice'], [{ id: 'user-1', name: 'Alice' }])

    const result = await auditedInsert(env.DB, mockCtx, 'users', { id: 'user-1', name: 'Alice' })

    expect(result).toEqual([{ id: 'user-1', name: 'Alice' }])
  })

  it('auditedUpdate updates and returns rows with SQL', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock

    setMockQueryResult(mockDb, ['user-1'], [{ id: 'user-1', name: 'Old' }])
    setMockQueryResult(mockDb, ['Updated', 'user-1'], [{ id: 'user-1', name: 'Updated' }])

    const result = await auditedUpdate(
      env.DB,
      mockCtx,
      'users',
      { name: 'Updated' },
      { clause: 'id = ?', params: ['user-1'] }
    )

    expect(result).toEqual([{ id: 'user-1', name: 'Updated' }])
  })

  it('auditedDelete soft deletes and logs with SQL', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock
    const fixedNow = '2025-01-01T00:00:00.000Z'

    setMockQueryResult(
      mockDb,
      [fixedNow, mockCtx.user.id, fixedNow, mockCtx.user.id, 'user-1'],
      [{ id: 'user-1', name: 'Alice' }]
    )

    await auditedDelete(
      env.DB,
      mockCtx,
      'users',
      { clause: 'id = ?', params: ['user-1'] },
      { now: () => fixedNow }
    )
  })
})
