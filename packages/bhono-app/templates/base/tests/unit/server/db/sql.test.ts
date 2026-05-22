import { describe, it, expect } from 'vitest'
import { createMockEnv, setMockQueryResult, setMockDefaultResult } from '@tests/helpers/server'
import {
  queryAll,
  queryOne,
  queryValue,
  execute,
  executeBatch,
  toStringValue,
  toNullableString,
} from '@server/db/sql'

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

  it('returns one row with mapper', async () => {
    const env = createMockEnv()
    const mockDb = env.DB._mock

    setMockQueryResult(mockDb, [], [{ id: '123', name: 'Test User' }])

    const mapped = await queryOne(
      env.DB,
      'SELECT id, name FROM users WHERE id = ?',
      [],
      (row) => ({
        userId: String(row.id),
        displayName: String(row.name).toUpperCase(),
      })
    )
    expect(mapped).toEqual({ userId: '123', displayName: 'TEST USER' })
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

  describe('toStringValue', () => {
    it('converts string to string', () => {
      expect(toStringValue('hello')).toBe('hello')
    })

    it('converts number to string', () => {
      expect(toStringValue(42)).toBe('42')
      expect(toStringValue(0)).toBe('0')
      expect(toStringValue(-123.45)).toBe('-123.45')
    })

    it('converts bigint to string', () => {
      expect(toStringValue(BigInt(9007199254740991))).toBe('9007199254740991')
      expect(toStringValue(BigInt(0))).toBe('0')
    })

    it('returns empty string for null/undefined', () => {
      expect(toStringValue(null)).toBe('')
      expect(toStringValue(undefined)).toBe('')
    })

    it('returns empty string for objects', () => {
      expect(toStringValue({ key: 'value' })).toBe('')
      expect(toStringValue([1, 2, 3])).toBe('')
    })
  })

  describe('toNullableString', () => {
    it('returns null for null/undefined', () => {
      expect(toNullableString(null)).toBeNull()
      expect(toNullableString(undefined)).toBeNull()
    })

    it('returns string as-is', () => {
      expect(toNullableString('hello')).toBe('hello')
      expect(toNullableString('')).toBe('')
    })

    it('converts number to string', () => {
      expect(toNullableString(42)).toBe('42')
      expect(toNullableString(0)).toBe('0')
      expect(toNullableString(-99.5)).toBe('-99.5')
    })

    it('converts bigint to string', () => {
      expect(toNullableString(BigInt(12345678901234567890n))).toBe('12345678901234567890')
      expect(toNullableString(BigInt(-999))).toBe('-999')
    })

    it('returns null for objects and arrays', () => {
      expect(toNullableString({ foo: 'bar' })).toBeNull()
      expect(toNullableString([1, 2, 3])).toBeNull()
      expect(toNullableString(new Date())).toBeNull()
    })

    it('returns null for boolean values', () => {
      expect(toNullableString(true)).toBeNull()
      expect(toNullableString(false)).toBeNull()
    })
  })

  describe('normalizeValue (via execute)', () => {
    it('normalizes boolean false to 0', async () => {
      const env = createMockEnv()
      const mockDb = env.DB._mock

      setMockQueryResult(mockDb, [0], [{ ok: 1 }])

      const row = await queryOne(env.DB, 'SELECT 1 AS ok WHERE active = ?', [false])
      expect(row).toEqual({ ok: 1 })
    })
  })

  describe('queryValue edge cases', () => {
    it('returns null when column is specified but value is undefined', async () => {
      const env = createMockEnv()
      const mockDb = env.DB._mock

      setMockQueryResult(mockDb, [], [{ name: 'Alice' }])

      const value = await queryValue(env.DB, 'SELECT name FROM users', [], 'nonexistent')
      expect(value).toBeNull()
    })

    it('returns null when row has no keys (empty object)', async () => {
      const env = createMockEnv()
      const mockDb = env.DB._mock

      setMockQueryResult(mockDb, [], [{}])

      const value = await queryValue(env.DB, 'SELECT * FROM empty_table')
      expect(value).toBeNull()
    })

    it('returns value by column name when specified', async () => {
      const env = createMockEnv()
      const mockDb = env.DB._mock

      setMockQueryResult(mockDb, [], [{ id: 1, name: 'Alice', email: 'alice@example.com' }])

      const value = await queryValue<string>(env.DB, 'SELECT * FROM users', [], 'email')
      expect(value).toBe('alice@example.com')
    })

    it('returns first column value when no column specified', async () => {
      const env = createMockEnv()
      const mockDb = env.DB._mock

      setMockQueryResult(mockDb, [], [{ first: 'value1', second: 'value2' }])

      const value = await queryValue(env.DB, 'SELECT first, second FROM users')
      expect(value).toBe('value1')
    })

    it('returns null when no row is found', async () => {
      const env = createMockEnv()
      const mockDb = env.DB._mock

      setMockQueryResult(mockDb, ['nonexistent'], [])

      const value = await queryValue(env.DB, 'SELECT * FROM users WHERE id = ?', ['nonexistent'])
      expect(value).toBeNull()
    })
  })

  describe('executeBatch', () => {
    it('executes multiple statements in a batch', async () => {
      const env = createMockEnv()

      const results = await executeBatch(env.DB, [
        { statement: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
        { statement: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
        { statement: 'UPDATE users SET active = ? WHERE name = ?', params: [true, 'Alice'] },
      ])

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result).toHaveProperty('success')
        expect(result.success).toBe(true)
      })
    })

    it('executes batch with statements without params', async () => {
      const env = createMockEnv()

      const results = await executeBatch(env.DB, [
        { statement: 'DELETE FROM temp_data' },
        { statement: 'VACUUM' },
      ])

      expect(results).toHaveLength(2)
    })

    it('executes batch with mixed param types', async () => {
      const env = createMockEnv()
      const date = new Date('2025-06-15T10:30:00.000Z')

      const results = await executeBatch(env.DB, [
        { statement: 'INSERT INTO logs (active, created_at) VALUES (?, ?)', params: [true, date] },
        { statement: 'INSERT INTO logs (active, created_at) VALUES (?, ?)', params: [false, undefined] },
      ])

      expect(results).toHaveLength(2)
    })

    it('handles empty batch', async () => {
      const env = createMockEnv()

      const results = await executeBatch(env.DB, [])

      expect(results).toHaveLength(0)
    })
  })
})
