// src/server/__tests__/mocks/__tests__/db.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockD1,
  setMockQueryResult,
  setMockDefaultResult,
  clearMockQueryResults,
  type MockD1Database,
} from '@tests/mocks/db'

describe('MockD1Database', () => {
  let db: MockD1Database

  beforeEach(() => {
    db = createMockD1()
    vi.clearAllMocks()
  })

  describe('createMockD1', () => {
    it('creates a mock database with all required methods', () => {
      expect(db.prepare).toBeDefined()
      expect(db.batch).toBeDefined()
      expect(db.exec).toBeDefined()
      expect(db.dump).toBeDefined()
      expect(db._queryResults).toBeInstanceOf(Map)
    })

    it('prepare returns a mock prepared statement', () => {
      const stmt = db.prepare('SELECT * FROM users')
      expect(stmt).toBeDefined()
      expect(stmt.bind).toBeDefined()
      expect(stmt.first).toBeDefined()
      expect(stmt.all).toBeDefined()
      expect(stmt.run).toBeDefined()
      expect(stmt.raw).toBeDefined()
    })
  })

  describe('PreparedStatement.bind', () => {
    it('returns the statement for chaining', () => {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      const bound = stmt.bind('user-1')
      expect(bound).toBe(stmt)
    })

    it('accepts multiple parameters', () => {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND status = ?')
      const bound = stmt.bind('user-1', 'active')
      expect(bound).toBe(stmt)
    })
  })

  describe('PreparedStatement.first', () => {
    it('returns null when no results are set', async () => {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      const result = await stmt.bind('user-1').first()
      expect(result).toBeNull()
    })

    it('returns the first row when results are set', async () => {
      const user = { id: 'user-1', name: 'Test User' }
      setMockQueryResult(db, ['user-1'], [user])

      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      const result = await stmt.bind('user-1').first()
      expect(result).toEqual(user)
    })

    it('returns a single column value when column name is provided', async () => {
      const user = { id: 'user-1', name: 'Test User' }
      setMockQueryResult(db, ['user-1'], [user])

      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      const result = await stmt.bind('user-1').first('name')
      expect(result).toBe('Test User')
    })

    it('returns null for non-existent column', async () => {
      const user = { id: 'user-1', name: 'Test User' }
      setMockQueryResult(db, ['user-1'], [user])

      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      const result = await stmt.bind('user-1').first('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('PreparedStatement.all', () => {
    it('returns empty results when no results are set', async () => {
      const stmt = db.prepare('SELECT * FROM users')
      const result = await stmt.all()
      expect(result.results).toEqual([])
      expect(result.success).toBe(true)
    })

    it('returns all rows when results are set', async () => {
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ]
      setMockDefaultResult(db, users)

      const stmt = db.prepare('SELECT * FROM users')
      const result = await stmt.all()
      expect(result.results).toEqual(users)
      expect(result.success).toBe(true)
      expect(result.meta).toBeDefined()
    })

    it('wraps single object result in array', async () => {
      const user = { id: 'user-1', name: 'User 1' }
      setMockDefaultResult(db, user)

      const stmt = db.prepare('SELECT * FROM users')
      const result = await stmt.all()
      expect(result.results).toEqual([user])
    })
  })

  describe('PreparedStatement.run', () => {
    it('returns success result for mutations', async () => {
      const stmt = db.prepare('INSERT INTO users (id, name) VALUES (?, ?)')
      const result = await stmt.bind('user-1', 'Test User').run()

      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      expect(result.meta.changed_db).toBe(true)
    })
  })

  describe('PreparedStatement.raw', () => {
    it('returns array of arrays instead of objects', async () => {
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ]
      setMockDefaultResult(db, users)

      const stmt = db.prepare('SELECT id, name FROM users')
      const result = await stmt.raw()

      expect(result).toEqual([
        ['user-1', 'User 1'],
        ['user-2', 'User 2'],
      ])
    })
  })

  describe('setMockQueryResult', () => {
    it('sets results for specific bound values', async () => {
      const user1 = { id: 'user-1', name: 'User 1' }
      const user2 = { id: 'user-2', name: 'User 2' }

      setMockQueryResult(db, ['user-1'], [user1])
      setMockQueryResult(db, ['user-2'], [user2])

      const stmt1 = db.prepare('SELECT * FROM users WHERE id = ?')
      const result1 = await stmt1.bind('user-1').first()
      expect(result1).toEqual(user1)

      const stmt2 = db.prepare('SELECT * FROM users WHERE id = ?')
      const result2 = await stmt2.bind('user-2').first()
      expect(result2).toEqual(user2)
    })
  })

  describe('setMockDefaultResult', () => {
    it('sets default result for unmatched queries', async () => {
      const defaultUsers = [{ id: 'default', name: 'Default User' }]
      setMockDefaultResult(db, defaultUsers)

      const stmt = db.prepare('SELECT * FROM users')
      const result = await stmt.all()
      expect(result.results).toEqual(defaultUsers)
    })
  })

  describe('clearMockQueryResults', () => {
    it('clears all query results and default', async () => {
      setMockQueryResult(db, ['user-1'], [{ id: 'user-1' }])
      setMockDefaultResult(db, [{ id: 'default' }])

      clearMockQueryResults(db)

      expect(db._queryResults.size).toBe(0)
      expect(db._defaultResult).toBeNull()
    })
  })

  describe('batch', () => {
    it('executes multiple statements and returns results', async () => {
      setMockDefaultResult(db, [{ id: 'user-1' }])

      const stmt1 = db.prepare('SELECT * FROM users')
      const stmt2 = db.prepare('SELECT * FROM accounts')

      const results = await db.batch([stmt1, stmt2])

      expect(results).toHaveLength(2)
      expect(results[0].results).toEqual([{ id: 'user-1' }])
      expect(results[1].results).toEqual([{ id: 'user-1' }])
    })
  })

  describe('exec', () => {
    it('executes raw SQL and returns count', async () => {
      const result = await db.exec('CREATE TABLE test (id TEXT)')
      expect(result.count).toBe(1)
      expect(result.duration).toBe(0)
    })
  })

  describe('dump', () => {
    it('returns an empty ArrayBuffer', async () => {
      const result = await db.dump()
      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBe(0)
    })
  })

  describe('vi.fn() tracking', () => {
    it('tracks prepare calls', () => {
      db.prepare('SELECT * FROM users')
      db.prepare('SELECT * FROM accounts')

      expect(db.prepare).toHaveBeenCalledTimes(2)
      expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM users')
      expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM accounts')
    })

    it('tracks statement method calls', async () => {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      await stmt.bind('user-1').first()

      expect(stmt.bind).toHaveBeenCalledWith('user-1')
      expect(stmt.first).toHaveBeenCalled()
    })
  })
})
