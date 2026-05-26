/**
 * Smoke Test for Integration Test Infrastructure
 *
 * This test verifies that the integration test setup is working correctly.
 * It tests the in-memory SQLite database, mock KV store, and mock R2 bucket.
 */

import { describe, it, expect } from 'vitest'
import {
  getEnv,
  getDb,
  getSqlite,
  getKV,
  getR2,
  createSession,
  seedUser,
  seedAccount,
  seedUserAccount,
  clearDatabase,
} from './setup'

describe('Integration Test Infrastructure', () => {
  describe('SQLite Database', () => {
    it('should have initialized the SQLite database', () => {
      const sqlite = getSqlite()
      expect(sqlite).toBeDefined()

      // Verify we can query the database
      const result = sqlite.prepare('SELECT 1 as test').get() as { test: number }
      expect(result.test).toBe(1)
    })

    it('should have created all required tables', () => {
      const sqlite = getSqlite()

      // Query sqlite_master for tables
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[]

      const tableNames = tables.map((t) => t.name)

      expect(tableNames).toContain('auth_users')
      expect(tableNames).toContain('auth_sessions')
      expect(tableNames).toContain('auth_audit_logs')
      expect(tableNames).toContain('auth_accounts')
      expect(tableNames).toContain('auth_memberships')
      expect(tableNames).toContain('auth_invitations')
      expect(tableNames).toContain('auth_user_permissions')
      expect(tableNames).toContain('auth_resource_permissions')
    })

    it('should support foreign key constraints', () => {
      const sqlite = getSqlite()
      const result = sqlite.pragma('foreign_keys') as { foreign_keys: number }[]
      expect(result[0].foreign_keys).toBe(1)
    })
  })

  describe('D1 Database', () => {
    it('should have initialized D1 database instance', () => {
      const db = getDb()
      expect(db).toBeDefined()
      expect(typeof db.prepare).toBe('function')
    })
  })

  describe('Mock KV Store', () => {
    it('should have initialized the KV store', () => {
      const kv = getKV()
      expect(kv).toBeDefined()
      expect(kv._store).toBeDefined()
    })

    it('should support put/get operations', async () => {
      const kv = getKV()
      await kv.put('test-key', 'test-value')
      const value = await kv.get('test-key')
      expect(value).toBe('test-value')
    })

    it('should support JSON operations', async () => {
      const kv = getKV()
      await kv.put('json-key', JSON.stringify({ foo: 'bar' }))
      const value = await kv.get('json-key', { type: 'json' })
      expect(value).toEqual({ foo: 'bar' })
    })

    it('should support delete operations', async () => {
      const kv = getKV()
      await kv.put('delete-key', 'value')
      await kv.delete('delete-key')
      const value = await kv.get('delete-key')
      expect(value).toBeNull()
    })

    it('should support list operations', async () => {
      const kv = getKV()
      await kv.put('prefix:a', 'value-a')
      await kv.put('prefix:b', 'value-b')
      await kv.put('other:c', 'value-c')

      const result = await kv.list({ prefix: 'prefix:' })
      expect(result.keys.length).toBe(2)
      expect(result.keys.map((k: { name: string }) => k.name)).toContain('prefix:a')
      expect(result.keys.map((k: { name: string }) => k.name)).toContain('prefix:b')
    })
  })

  describe('Mock R2 Bucket', () => {
    it('should have initialized the R2 bucket', () => {
      const r2 = getR2()
      expect(r2).toBeDefined()
      expect(r2._store).toBeDefined()
    })

    it('should support put/get operations', async () => {
      const r2 = getR2()
      await r2.put('test-file.txt', 'Hello, World!')

      const obj = await r2.get('test-file.txt')
      expect(obj).not.toBeNull()

      const text = await obj!.text()
      expect(text).toBe('Hello, World!')
    })

    it('should support head operations', async () => {
      const r2 = getR2()
      await r2.put('head-file.txt', 'Content')

      const head = await r2.head('head-file.txt')
      expect(head).not.toBeNull()
      expect(head!.key).toBe('head-file.txt')
      expect(head!.size).toBe(7) // 'Content'.length
    })

    it('should support delete operations', async () => {
      const r2 = getR2()
      await r2.put('delete-file.txt', 'Content')
      await r2.delete('delete-file.txt')

      const obj = await r2.get('delete-file.txt')
      expect(obj).toBeNull()
    })

    it('should support list operations', async () => {
      const r2 = getR2()
      await r2.put('files/a.txt', 'A')
      await r2.put('files/b.txt', 'B')
      await r2.put('other/c.txt', 'C')

      const result = await r2.list({ prefix: 'files/' })
      expect(result.objects.length).toBe(2)
    })
  })

  describe('Test Environment', () => {
    it('should have all required environment variables', () => {
      const env = getEnv()

      expect(env.ENVIRONMENT).toBe('test')
      expect(env.APP_URL).toBe('http://localhost:8787')
      expect(env.ETUS_GATEWAY).toBeDefined()
      expect(env.ETUS_CLIENT_ID).toBeDefined()
      expect(env.ETUS_CLIENT_SECRET).toBeDefined()
      expect(env.ETUS_ALLOWED_DOMAINS).toBeDefined()
      expect(env.ETUS_ADMIN_EMAILS).toBeDefined()
      expect(env.SENDGRID_API_KEY).toBeDefined()
    })

    it('should have D1 database binding', () => {
      const env = getEnv()
      expect(env.DB).toBeDefined()
      expect(env.DB.prepare).toBeDefined()
    })

    it('should have KV binding', () => {
      const env = getEnv()
      expect(env.SESSIONS).toBeDefined()
    })

    it('should have R2 binding', () => {
      const env = getEnv()
      expect(env.R2_BUCKET).toBeDefined()
    })
  })

  describe('Seed Helpers', () => {
    it('should seed a user into the database', async () => {
      const user = await seedUser({
        email: 'test@example.com',
        name: 'Test User',
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.name).toBe('Test User')

      // Verify in database
      const sqlite = getSqlite()
      const row = sqlite.prepare('SELECT * FROM auth_users WHERE id = ?').get(user.id) as Record<
        string,
        unknown
      >
      expect(row).toBeDefined()
      expect(row.email).toBe('test@example.com')
    })

    it('should seed an account into the database', async () => {
      const account = await seedAccount({
        name: 'Test Account',
        description: 'A test account',
      })

      expect(account.id).toBeDefined()
      expect(account.name).toBe('Test Account')

      // Verify in database
      const sqlite = getSqlite()
      const row = sqlite
        .prepare('SELECT * FROM auth_accounts WHERE id = ?')
        .get(account.id) as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.name).toBe('Test Account')
    })

    it('should seed user-account relationship', async () => {
      const user = await seedUser({ email: 'admin@example.com', name: 'Admin' })
      const account = await seedAccount({ name: 'Company' })

      await seedUserAccount({
        userId: user.id,
        accountId: account.id,
        role: 'admin',
      })

      // Verify in database
      const sqlite = getSqlite()
      const row = sqlite
        .prepare('SELECT * FROM auth_memberships WHERE user_id = ? AND account_id = ?')
        .get(user.id, account.id) as Record<string, unknown>

      expect(row).toBeDefined()
      expect(row.role).toBe('admin')
    })
  })

  describe('Session Helpers', () => {
    it('should create a session in KV storage', async () => {
      const user = await seedUser({ email: 'session@example.com', name: 'Session User' })

      const { sessionId, sessionData } = await createSession(user.id)

      expect(sessionId).toBeDefined()
      expect(sessionData.userId).toBe(user.id)

      // Verify in KV
      const kv = getKV()
      const stored = await kv.get(`auth_sid:${sessionId}`, { type: 'json' })
      expect(stored).toBeDefined()
      expect((stored as { userId: string }).userId).toBe(user.id)
    })
  })

  describe('Database Cleanup', () => {
    it('should clear all data from the database', async () => {
      // Seed some data
      await seedUser({ email: 'cleanup@example.com', name: 'Cleanup User' })
      await seedAccount({ name: 'Cleanup Account' })

      // Clear database
      await clearDatabase()

      // Verify tables are empty
      const sqlite = getSqlite()
      const usersCount = sqlite.prepare('SELECT COUNT(*) as count FROM auth_users').get() as {
        count: number
      }
      const accountsCount = sqlite.prepare('SELECT COUNT(*) as count FROM auth_accounts').get() as {
        count: number
      }

      expect(usersCount.count).toBe(0)
      expect(accountsCount.count).toBe(0)
    })
  })
})
