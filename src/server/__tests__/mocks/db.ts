// src/server/__tests__/mocks/db.ts
import { vi } from 'vitest'

/**
 * Mock D1 Prepared Statement
 */
export interface MockPreparedStatement {
  bind: ReturnType<typeof vi.fn>
  first: ReturnType<typeof vi.fn>
  all: ReturnType<typeof vi.fn>
  run: ReturnType<typeof vi.fn>
  raw: ReturnType<typeof vi.fn>
}

/**
 * Mock D1 Database interface
 */
export interface MockD1Database {
  prepare: ReturnType<typeof vi.fn>
  batch: ReturnType<typeof vi.fn>
  exec: ReturnType<typeof vi.fn>
  dump: ReturnType<typeof vi.fn>
  _queryResults: Map<string, unknown>
  _defaultResult: unknown
}

/**
 * Creates a mock prepared statement
 */
function createMockPreparedStatement(db: MockD1Database): MockPreparedStatement {
  const boundValues: unknown[] = []

  const statement: MockPreparedStatement = {
    bind: vi.fn((...values: unknown[]) => {
      boundValues.push(...values)
      return statement
    }),
    first: vi.fn(async (columnName?: string) => {
      const key = getQueryKey(boundValues)
      const result = db._queryResults.get(key) ?? db._defaultResult
      if (Array.isArray(result) && result.length > 0) {
        const row = result[0]
        if (columnName && typeof row === 'object' && row !== null) {
          return (row as Record<string, unknown>)[columnName] ?? null
        }
        return row
      }
      if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
        if (columnName) {
          return (result as Record<string, unknown>)[columnName] ?? null
        }
        return result
      }
      return null
    }),
    all: vi.fn(async () => {
      const key = getQueryKey(boundValues)
      const result = db._queryResults.get(key) ?? db._defaultResult
      const results = Array.isArray(result) ? result : result ? [result] : []
      return {
        results,
        success: true,
        meta: {
          duration: 0,
          changes: 0,
          last_row_id: 0,
          changed_db: false,
          size_after: 0,
          rows_read: results.length,
          rows_written: 0,
        },
      }
    }),
    run: vi.fn(async () => {
      return {
        results: [],
        success: true,
        meta: {
          duration: 0,
          changes: 1,
          last_row_id: 1,
          changed_db: true,
          size_after: 0,
          rows_read: 0,
          rows_written: 1,
        },
      }
    }),
    raw: vi.fn(async () => {
      const key = getQueryKey(boundValues)
      const result = db._queryResults.get(key) ?? db._defaultResult
      const results = Array.isArray(result) ? result : result ? [result] : []
      // raw returns array of arrays instead of objects
      return results.map((row) => {
        if (typeof row === 'object' && row !== null) {
          return Object.values(row as Record<string, unknown>)
        }
        return [row]
      })
    }),
  }

  return statement
}

/**
 * Generate a key for query results based on bound values
 */
function getQueryKey(values: unknown[]): string {
  if (values.length === 0) return '__default__'
  return JSON.stringify(values)
}

/**
 * Creates a mock D1 database with in-memory storage for query results
 */
export function createMockD1(): MockD1Database {
  const queryResults = new Map<string, unknown>()

  const db: MockD1Database = {
    _queryResults: queryResults,
    _defaultResult: null,
    prepare: vi.fn((query: string) => {
      return createMockPreparedStatement(db)
    }),
    batch: vi.fn(async (statements: MockPreparedStatement[]) => {
      const results = await Promise.all(
        statements.map(async (stmt) => {
          return stmt.all()
        })
      )
      return results
    }),
    exec: vi.fn(async (query: string) => {
      return {
        count: 1,
        duration: 0,
      }
    }),
    dump: vi.fn(async () => {
      return new ArrayBuffer(0)
    }),
  }

  return db
}

/**
 * Set a mock query result for specific bound values
 * @param db The mock database
 * @param boundValues The values that will be bound (used as key)
 * @param results The results to return
 */
export function setMockQueryResult(
  db: MockD1Database,
  boundValues: unknown[],
  results: unknown
): void {
  const key = getQueryKey(boundValues)
  db._queryResults.set(key, results)
}

/**
 * Set the default result for queries that don't match any specific pattern
 * @param db The mock database
 * @param results The default results
 */
export function setMockDefaultResult(db: MockD1Database, results: unknown): void {
  db._defaultResult = results
}

/**
 * Clear all mock query results
 * @param db The mock database
 */
export function clearMockQueryResults(db: MockD1Database): void {
  db._queryResults.clear()
  db._defaultResult = null
}

/**
 * Create a mock D1Database that conforms to the Cloudflare D1Database type
 */
export function createMockD1AsD1Database(): D1Database {
  return createMockD1() as unknown as D1Database
}
