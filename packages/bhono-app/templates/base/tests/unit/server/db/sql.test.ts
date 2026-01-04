import { describe, it, expect } from 'vitest'
import { createMockEnv, setMockQueryResult } from '@tests/helpers/server'
import { queryAll, queryOne, queryValue, execute } from '@server/db/sql'

describe('sql helper', () => {
  it('returns all rows with optional mapper', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock

    setMockQueryResult(mockDb, [1], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    const rows = await queryAll(env.DB, 'SELECT id, name FROM users WHERE id = ?', [1])
    expect(rows).toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    const mapped = await queryAll(env.DB, 'SELECT id FROM users WHERE id = ?', [1], (row) => ({
      id: String(row.id),
    }))
    expect(mapped).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('returns one row or null', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock

    setMockQueryResult(mockDb, [], [{ ok: 1 }])

    const row = await queryOne(env.DB, 'SELECT 1 AS ok')
    expect(row).toEqual({ ok: 1 })

    const empty = await queryOne(env.DB, 'SELECT 1 AS ok', [999])
    expect(empty).toBeNull()
  })

  it('returns a single value', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock

    setMockQueryResult(mockDb, [], [{ count: 42 }])

    const value = await queryValue<number>(env.DB, 'SELECT count(*) AS count FROM users')
    expect(value).toBe(42)
  })

  it('normalizes params (boolean/date/undefined)', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock
    const date = new Date('2025-01-01T00:00:00.000Z')

    setMockQueryResult(mockDb, [1, date.toISOString(), null], [{ ok: 1 }])

    const row = await queryOne(env.DB, 'SELECT 1 AS ok WHERE a = ? AND b = ? AND c IS ?', [true, date, undefined])
    expect(row).toEqual({ ok: 1 })
  })

  it('executes statements and returns meta', async () => {
    const env = createMockEnv()

    const result = await execute(env.DB, 'UPDATE users SET name = ? WHERE id = ?', ['Alice', '1'])
    expect(result).toHaveProperty('meta')
    expect(result.meta.changes).toBe(1)
  })
})
