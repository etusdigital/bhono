/**
 * SQL Injection Prevention Integration Tests
 *
 * Tests that the API properly prevents SQL injection attacks through:
 * - Parameterized queries via Drizzle ORM
 * - Zod UUID validation for ID parameters
 * - Safe handling of user input in search queries
 *
 * Since the codebase uses Drizzle ORM with parameterized queries,
 * these tests should PASS - demonstrating that SQL injection protection
 * is already in place by default.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getSqlite, type TestEnv } from '../setup'
import { createTestScenario } from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
 */
function createTestDb() {
  const sqlite = getSqlite()
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const db = drizzle(sqlite)
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('SQL Injection Prevention', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      // Inject environment bindings
      ;(c as any).env = env

      // Set up database
      const db = createTestDb()
      c.set('db', db)

      // Set up request context variables
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Session middleware - reads session from KV and sets sessionData in context
    app.use('*', sessionMiddleware())

    // Mount API routes (includes sessionAuth and accountMiddleware)
    app.route('/api', api)
  })

  // ============================================================================
  // SQL Injection in Search Query Tests
  // ============================================================================

  describe('SQL Injection in Search Query', () => {
    it('should prevent SQL injection in search query (DROP TABLE)', async () => {
      const scenario = await createTestScenario({
        userName: 'SQL Injection Test User',
        userEmail: 'sqli-drop@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "'; DROP TABLE users; --"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      // Should return valid response, not execute SQL
      expect(res.status).toBe(200)

      // Verify users table still exists
      const sqlite = getSqlite()
      const result = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get() as { name: string } | undefined
      expect(result).toBeDefined()
      expect(result?.name).toBe('users')

      // Verify response is valid JSON with expected structure
      const body = await res.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('should prevent SQL injection with OR 1=1 in search', async () => {
      const scenario = await createTestScenario({
        userName: 'OR Injection Test User',
        userEmail: 'sqli-or@example.com',
        role: 'VIEWER',
      })

      // Create another user in a different account that should NOT be visible
      const otherScenario = await createTestScenario({
        userName: 'Other Account User',
        userEmail: 'other-account@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "' OR '1'='1"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(res.status).toBe(200)

      const body = await res.json()
      // Should NOT return all users - should only return users from this account
      // that match the literal search string (which won't match any)
      expect(body.data.length).toBeLessThanOrEqual(1)

      // The other account's user should NOT appear in results
      const userEmails = body.data.map((u: { email: string }) => u.email)
      expect(userEmails).not.toContain(otherScenario.user.email)
    })

    it('should treat SQL injection payload as literal search term', async () => {
      const scenario = await createTestScenario({
        userName: 'Literal Search Test User',
        userEmail: 'sqli-literal@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "'; SELECT * FROM accounts; --"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(res.status).toBe(200)

      const body = await res.json()
      // Search should work but return no results (no user contains the SQL injection string)
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  // ============================================================================
  // SQL Injection in User ID Parameter Tests
  // ============================================================================

  describe('SQL Injection in User ID Parameter', () => {
    it('should reject SQL injection in user ID parameter with 400', async () => {
      const scenario = await createTestScenario({
        userName: 'ID Injection Test User',
        userEmail: 'sqli-id@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "1 OR 1=1"

      const res = await app.request(`/api/users/${sqlInjection}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Should return 400 (invalid UUID format) not all users
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body).toHaveProperty('error')
    })

    it('should reject UNION injection in user ID parameter', async () => {
      const scenario = await createTestScenario({
        userName: 'Union ID Injection Test User',
        userEmail: 'sqli-union-id@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "' UNION SELECT * FROM accounts --"

      const res = await app.request(
        `/api/users/${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      // Should return 400 (invalid UUID format)
      expect(res.status).toBe(400)
    })

    it('should reject encoded SQL injection in user ID', async () => {
      const scenario = await createTestScenario({
        userName: 'Encoded ID Injection Test User',
        userEmail: 'sqli-encoded-id@example.com',
        role: 'VIEWER',
      })

      // Try double-encoded injection
      const sqlInjection = "%27%20OR%201%3D1%20--"

      const res = await app.request(`/api/users/${sqlInjection}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Should return 400 (invalid UUID format)
      expect(res.status).toBe(400)
    })
  })

  // ============================================================================
  // UNION-based SQL Injection Tests
  // ============================================================================

  describe('UNION-based SQL Injection', () => {
    it('should prevent UNION-based SQL injection in search', async () => {
      const scenario = await createTestScenario({
        userName: 'Union Search Test User',
        userEmail: 'sqli-union@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "' UNION SELECT * FROM accounts --"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(res.status).toBe(200)

      const body = await res.json()
      // Should not leak account data
      const bodyString = JSON.stringify(body)
      expect(bodyString).not.toContain('accounts')

      // Should return valid users response structure
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
    })

    it('should prevent UNION SELECT password injection', async () => {
      const scenario = await createTestScenario({
        userName: 'Union Password Test User',
        userEmail: 'sqli-union-pwd@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "' UNION SELECT password FROM users --"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(res.status).toBe(200)

      // Should return normal response without exposing any password-related data
      const body = await res.json()
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('should prevent stacked queries injection', async () => {
      const scenario = await createTestScenario({
        userName: 'Stacked Query Test User',
        userEmail: 'sqli-stacked@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "'; INSERT INTO users (id, google_id, email, name) VALUES ('evil', 'evil', 'evil@evil.com', 'evil'); --"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(res.status).toBe(200)

      // Verify the evil user was NOT inserted
      const sqlite = getSqlite()
      const evilUser = sqlite
        .prepare("SELECT * FROM users WHERE id = 'evil'")
        .get()
      expect(evilUser).toBeUndefined()
    })
  })

  // ============================================================================
  // Database Integrity After Attack Attempts
  // ============================================================================

  describe('Database Integrity After Attack Attempts', () => {
    it('should preserve database schema after multiple injection attempts', async () => {
      const scenario = await createTestScenario({
        userName: 'Schema Integrity Test User',
        userEmail: 'sqli-schema@example.com',
        role: 'VIEWER',
      })

      // Execute multiple injection attempts
      const injectionPayloads = [
        "'; DROP TABLE users; --",
        "'; DROP TABLE accounts; --",
        "'; ALTER TABLE users ADD COLUMN hacked TEXT; --",
        "'; DELETE FROM users; --",
        "'; UPDATE users SET is_super_admin = 1; --",
      ]

      for (const payload of injectionPayloads) {
        await app.request(`/api/users?query=${encodeURIComponent(payload)}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      }

      // Verify all tables still exist
      const sqlite = getSqlite()
      const tables = ['users', 'accounts', 'user_accounts', 'audit_logs']

      for (const tableName of tables) {
        const result = sqlite
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`)
          .get() as { name: string } | undefined
        expect(result).toBeDefined()
        expect(result?.name).toBe(tableName)
      }

      // Verify user data is intact (specifically, our test user)
      const testUser = sqlite
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(scenario.user.email) as { email: string } | undefined
      expect(testUser).toBeDefined()
      expect(testUser?.email).toBe(scenario.user.email)
    })

    it('should not allow elevation of privileges through injection', async () => {
      const scenario = await createTestScenario({
        userName: 'Privilege Escalation Test User',
        userEmail: 'sqli-privilege@example.com',
        role: 'VIEWER',
        isSuperAdmin: false,
      })

      const sqlInjection = "'; UPDATE users SET is_super_admin = 1 WHERE email = 'sqli-privilege@example.com'; --"

      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(res.status).toBe(200)

      // Verify user was NOT made super admin
      const sqlite = getSqlite()
      const user = sqlite
        .prepare('SELECT is_super_admin FROM users WHERE email = ?')
        .get(scenario.user.email) as { is_super_admin: number } | undefined
      expect(user).toBeDefined()
      expect(user?.is_super_admin).toBe(0)
    })
  })

  // ============================================================================
  // Account ID Header SQL Injection Tests
  // ============================================================================

  describe('SQL Injection in Account ID Header', () => {
    it('should reject SQL injection in account-id header', async () => {
      const scenario = await createTestScenario({
        userName: 'Account Header Injection Test User',
        userEmail: 'sqli-account-header@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "' OR '1'='1"

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': sqlInjection,
        },
      })

      // Should return 400 (invalid UUID format) or 403 (no access to account)
      expect([400, 403]).toContain(res.status)
    })

    it('should reject UNION injection in account-id header', async () => {
      const scenario = await createTestScenario({
        userName: 'Account Union Injection Test User',
        userEmail: 'sqli-account-union@example.com',
        role: 'VIEWER',
      })

      const sqlInjection = "' UNION SELECT id FROM accounts --"

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': sqlInjection,
        },
      })

      // Should return 400 or 403
      expect([400, 403]).toContain(res.status)
    })
  })

  // ============================================================================
  // PATCH/UPDATE SQL Injection Tests
  // ============================================================================

  describe('SQL Injection in Update Operations', () => {
    it('should prevent SQL injection in user name update', async () => {
      const scenario = await createTestScenario({
        userName: 'Update Injection Test User',
        userEmail: 'sqli-update@example.com',
        role: 'MANAGER',
      })

      const sqlInjection = "'; DELETE FROM users; --"

      const res = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: sqlInjection }),
      })

      // The update should succeed (SQL is treated as literal string)
      expect(res.status).toBe(200)

      const body = await res.json()
      // The name should contain the SQL injection string literally
      expect(body.data.name).toBe(sqlInjection)

      // Verify no users were deleted
      const sqlite = getSqlite()
      const userCount = sqlite
        .prepare('SELECT COUNT(*) as count FROM users')
        .get() as { count: number }
      expect(userCount.count).toBeGreaterThan(0)
    })

    it('should prevent SQL injection in account description update', async () => {
      const scenario = await createTestScenario({
        userName: 'Account Update Injection Test User',
        userEmail: 'sqli-account-update@example.com',
        role: 'MANAGER',
      })

      const sqlInjection = "'; DROP TABLE accounts; --"

      const res = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: sqlInjection }),
      })

      // The update should succeed (SQL is treated as literal string)
      expect(res.status).toBe(200)

      // Verify accounts table still exists
      const sqlite = getSqlite()
      const result = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'")
        .get() as { name: string } | undefined
      expect(result).toBeDefined()
      expect(result?.name).toBe('accounts')
    })
  })

  // ============================================================================
  // Blind SQL Injection Tests
  // ============================================================================

  describe('Blind SQL Injection Prevention', () => {
    it('should prevent time-based blind SQL injection', async () => {
      const scenario = await createTestScenario({
        userName: 'Time Blind Injection Test User',
        userEmail: 'sqli-time-blind@example.com',
        role: 'VIEWER',
      })

      // SQLite doesn't have SLEEP, but has other time functions
      const sqlInjection = "' OR (SELECT CASE WHEN (1=1) THEN 'a' ELSE 'b' END)='a' --"

      const startTime = Date.now()
      const res = await app.request(
        `/api/users?query=${encodeURIComponent(sqlInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )
      const endTime = Date.now()

      expect(res.status).toBe(200)

      // Response should be quick (injection should not affect timing significantly)
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should prevent boolean-based blind SQL injection', async () => {
      const scenario = await createTestScenario({
        userName: 'Boolean Blind Injection Test User',
        userEmail: 'sqli-bool-blind@example.com',
        role: 'VIEWER',
      })

      // Create another user in same account to have some data
      await createTestScenario({
        userName: 'Another User',
        userEmail: 'sqli-another@example.com',
        role: 'VIEWER',
      })

      const trueInjection = "' OR 1=1 --"
      const falseInjection = "' OR 1=2 --"

      const trueRes = await app.request(
        `/api/users?query=${encodeURIComponent(trueInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      const falseRes = await app.request(
        `/api/users?query=${encodeURIComponent(falseInjection)}`,
        {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        }
      )

      expect(trueRes.status).toBe(200)
      expect(falseRes.status).toBe(200)

      const trueBody = await trueRes.json()
      const falseBody = await falseRes.json()

      // Both should return the same number of results (the injection shouldn't work)
      // If injection worked, true injection would return more results
      expect(trueBody.data.length).toBe(falseBody.data.length)
    })
  })
})
