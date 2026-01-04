/**
 * Integration Test Setup
 *
 * Provides:
 * - In-memory SQLite database (better-sqlite3) as D1-compatible database
 * - Mock KV store (Map-based) for sessions
 * - Mock R2 bucket (Map-based) for file storage
 * - Mocked external services (Google OAuth, SendGrid)
 * - Test utilities for creating sessions and test apps
 */

import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../../src/server/env'
import type { SessionData, HonoEnv } from '../../src/server/types'

// ============================================================================
// TYPES
// ============================================================================

export interface TestEnv extends Env {
  DB: D1Database
  SESSIONS: KVNamespace
  R2_BUCKET: R2Bucket
  ASSETS: Fetcher
}

export interface MockKVStore {
  _store: Map<string, { value: string; metadata?: unknown; expirationTtl?: number; storedAt: number }>
  get: (key: string, options?: { type?: string }) => Promise<string | null | unknown>
  getWithMetadata: (key: string, options?: { type?: string }) => Promise<{ value: unknown; metadata: unknown }>
  put: (key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }) => Promise<void>
  delete: (key: string) => Promise<void>
  list: (options?: { prefix?: string; limit?: number }) => Promise<{ keys: { name: string }[]; list_complete: boolean }>
}

export interface MockR2Store {
  _store: Map<string, { body: ArrayBuffer; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string>; uploaded: Date }>
  head: (key: string) => Promise<R2Object | null>
  get: (key: string) => Promise<R2ObjectBody | null>
  put: (key: string, value: ArrayBuffer | string | ReadableStream, options?: R2PutOptions) => Promise<R2Object>
  delete: (keys: string | string[]) => Promise<void>
  list: (options?: R2ListOptions) => Promise<R2Objects>
}

// ============================================================================
// DATABASE SCHEMA SQL
// ============================================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCHEMA_SQL = readFileSync(resolve(__dirname, '..', '..', 'schema.sql'), 'utf8')

// ============================================================================
// GLOBAL STATE
// ============================================================================

let sqliteDb: Database.Database | null = null
let mockKV: MockKVStore | null = null
let mockR2: MockR2Store | null = null
let testEnv: TestEnv | null = null

// ============================================================================
// D1-COMPATIBLE WRAPPER FOR SQLITE
// ============================================================================

/**
 * Creates a D1-compatible wrapper around better-sqlite3
 * This allows our test helpers to use a Cloudflare D1-like API
 * against an in-memory SQLite database.
 */
function createD1CompatibleWrapper(db: Database.Database): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      let boundParams: unknown[] = []

      const stmt: D1PreparedStatement = {
        bind(...params: unknown[]): D1PreparedStatement {
          boundParams = params
          return stmt
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          try {
            const sqliteStmt = db.prepare(query)
            const row = sqliteStmt.get(...boundParams) as Record<string, unknown> | undefined
            if (!row) return null
            if (colName) return (row[colName] as T) ?? null
            return row as T
          } catch (error) {
            console.error('D1 first() error:', error)
            throw error
          }
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          try {
            const sqliteStmt = db.prepare(query)
            const rows = sqliteStmt.all(...boundParams) as T[]
            return {
              results: rows,
              success: true,
              meta: {
                duration: 0,
                changes: 0,
                last_row_id: 0,
                changed_db: false,
                size_after: 0,
                rows_read: rows.length,
                rows_written: 0,
              },
            }
          } catch (error) {
            console.error('D1 all() error:', error)
            throw error
          }
        },
        async run<T = unknown>(): Promise<D1Result<T>> {
          try {
            const sqliteStmt = db.prepare(query)
            const result = sqliteStmt.run(...boundParams)
            return {
              results: [] as T[],
              success: true,
              meta: {
                duration: 0,
                changes: result.changes,
                last_row_id: Number(result.lastInsertRowid),
                changed_db: result.changes > 0,
                size_after: 0,
                rows_read: 0,
                rows_written: result.changes,
              },
            }
          } catch (error) {
            console.error('D1 run() error:', error)
            throw error
          }
        },
        async raw<T = unknown>(): Promise<T[]> {
          try {
            const sqliteStmt = db.prepare(query)
            const rows = sqliteStmt.raw(true).all(...boundParams) as T[]
            return rows
          } catch (error) {
            console.error('D1 raw() error:', error)
            throw error
          }
        },
      }

      return stmt
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = []
      for (const stmt of statements) {
        results.push(await stmt.all())
      }
      return results
    },
    async exec(query: string): Promise<D1ExecResult> {
      try {
        db.exec(query)
        return { count: 1, duration: 0 }
      } catch (error) {
        console.error('D1 exec() error:', error)
        throw error
      }
    },
    async dump(): Promise<ArrayBuffer> {
      const buffer = db.serialize()
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    },
  }
}

// ============================================================================
// MOCK KV STORE
// ============================================================================

/**
 * Creates a mock KV namespace using a Map
 * Supports TTL-based expiration checking
 */
function createMockKV(): MockKVStore {
  const store = new Map<string, { value: string; metadata?: unknown; expirationTtl?: number; storedAt: number }>()

  function isExpired(entry: { expirationTtl?: number; storedAt: number }): boolean {
    if (!entry.expirationTtl) return false
    const expiresAt = entry.storedAt + entry.expirationTtl * 1000
    return Date.now() > expiresAt
  }

  const kv: MockKVStore = {
    _store: store,

    async get(key: string, options?: { type?: string }): Promise<string | null | unknown> {
      const entry = store.get(key)
      if (!entry || isExpired(entry)) {
        if (entry) store.delete(key)
        return null
      }
      if (options?.type === 'json') {
        try {
          return JSON.parse(entry.value)
        } catch {
          return null
        }
      }
      return entry.value
    },

    async getWithMetadata(key: string, options?: { type?: string }): Promise<{ value: unknown; metadata: unknown }> {
      const entry = store.get(key)
      if (!entry || isExpired(entry)) {
        if (entry) store.delete(key)
        return { value: null, metadata: null }
      }
      let value: unknown = entry.value
      if (options?.type === 'json') {
        try {
          value = JSON.parse(entry.value)
        } catch {
          value = null
        }
      }
      return { value, metadata: entry.metadata ?? null }
    },

    async put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void> {
      store.set(key, {
        value,
        metadata: options?.metadata,
        expirationTtl: options?.expirationTtl,
        storedAt: Date.now(),
      })
    },

    async delete(key: string): Promise<void> {
      store.delete(key)
    },

    async list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
      const prefix = options?.prefix ?? ''
      const limit = options?.limit ?? 1000
      const keys: { name: string }[] = []

      for (const [key, entry] of store.entries()) {
        if (isExpired(entry)) {
          store.delete(key)
          continue
        }
        if (key.startsWith(prefix)) {
          keys.push({ name: key })
          if (keys.length >= limit) break
        }
      }

      return { keys, list_complete: keys.length < limit }
    },
  }

  return kv
}

// ============================================================================
// MOCK R2 BUCKET
// ============================================================================

/**
 * Creates a mock R2 bucket using a Map
 */
function createMockR2(): MockR2Store {
  const store = new Map<string, { body: ArrayBuffer; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string>; uploaded: Date }>()

  function createR2Object(key: string, entry: { body: ArrayBuffer; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string>; uploaded: Date }): R2Object {
    const etag = `"${Math.random().toString(36).substring(7)}"`
    return {
      key,
      version: crypto.randomUUID(),
      size: entry.body.byteLength,
      etag,
      httpEtag: etag,
      checksums: { toJSON: () => ({}) } as R2Checksums,
      uploaded: entry.uploaded,
      httpMetadata: entry.httpMetadata,
      customMetadata: entry.customMetadata,
      storageClass: 'Standard',
      writeHttpMetadata: (headers: Headers) => {
        if (entry.httpMetadata?.contentType) {
          headers.set('content-type', entry.httpMetadata.contentType)
        }
      },
    }
  }

  function createR2ObjectBody(key: string, entry: { body: ArrayBuffer; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string>; uploaded: Date }): R2ObjectBody {
    const obj = createR2Object(key, entry) as R2ObjectBody
    let bodyUsed = false

    Object.assign(obj, {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(entry.body))
          controller.close()
        },
      }),
      bodyUsed: false,
      arrayBuffer: async () => {
        if (bodyUsed) throw new Error('Body already used')
        bodyUsed = true
        return entry.body
      },
      text: async () => {
        if (bodyUsed) throw new Error('Body already used')
        bodyUsed = true
        return new TextDecoder().decode(entry.body)
      },
      json: async () => {
        if (bodyUsed) throw new Error('Body already used')
        bodyUsed = true
        return JSON.parse(new TextDecoder().decode(entry.body))
      },
      blob: async () => {
        if (bodyUsed) throw new Error('Body already used')
        bodyUsed = true
        return new Blob([entry.body], { type: entry.httpMetadata?.contentType })
      },
    })

    return obj
  }

  async function toArrayBuffer(value: ArrayBuffer | string | ReadableStream): Promise<ArrayBuffer> {
    if (value instanceof ArrayBuffer) return value
    if (typeof value === 'string') return new TextEncoder().encode(value).buffer as ArrayBuffer
    if (value instanceof ReadableStream) {
      const reader = value.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) chunks.push(result.value)
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      return combined.buffer as ArrayBuffer
    }
    throw new Error('Unsupported body type')
  }

  const r2: MockR2Store = {
    _store: store,

    async head(key: string): Promise<R2Object | null> {
      const entry = store.get(key)
      if (!entry) return null
      return createR2Object(key, entry)
    },

    async get(key: string): Promise<R2ObjectBody | null> {
      const entry = store.get(key)
      if (!entry) return null
      return createR2ObjectBody(key, entry)
    },

    async put(key: string, value: ArrayBuffer | string | ReadableStream, options?: R2PutOptions): Promise<R2Object> {
      const body = await toArrayBuffer(value)
      const entry = {
        body,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
        uploaded: new Date(),
      }
      store.set(key, entry)
      return createR2Object(key, entry)
    },

    async delete(keys: string | string[]): Promise<void> {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      for (const key of keyArray) {
        store.delete(key)
      }
    },

    async list(options?: R2ListOptions): Promise<R2Objects> {
      const prefix = options?.prefix ?? ''
      const limit = options?.limit ?? 1000
      const objects: R2Object[] = []

      for (const [key, entry] of store.entries()) {
        if (key.startsWith(prefix)) {
          objects.push(createR2Object(key, entry))
          if (objects.length >= limit) break
        }
      }

      objects.sort((a, b) => a.key.localeCompare(b.key))

      return {
        objects,
        truncated: objects.length >= limit,
        delimitedPrefixes: [],
      }
    },
  }

  return r2
}

// ============================================================================
// MOCK EXTERNAL SERVICES
// ============================================================================

/**
 * Mocked fetch for external services (Google OAuth, SendGrid)
 */
const originalFetch = globalThis.fetch

function createMockedFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    // Mock Google OAuth token endpoint
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid email profile',
          id_token: 'mock_id_token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mock Google userinfo endpoint
    if (url.includes('googleapis.com/oauth2') && url.includes('userinfo')) {
      return new Response(
        JSON.stringify({
          id: 'mock_google_id_123',
          email: 'testuser@gmail.com',
          verified_email: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://example.com/avatar.jpg',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mock SendGrid email endpoint
    if (url.includes('api.sendgrid.com')) {
      return new Response(null, { status: 202 })
    }

    // For other requests, use original fetch (or throw)
    console.warn(`[Integration Test] Unmocked fetch request: ${url}`)
    return originalFetch(input, init)
  })
}

// ============================================================================
// TEST ENVIRONMENT SETUP
// ============================================================================

/**
 * Default test environment configuration
 */
const DEFAULT_TEST_ENV_VALUES = {
  ENVIRONMENT: 'test',
  APP_URL: 'http://localhost:8787',
  JWT_SECRET: 'test-jwt-secret-key-for-integration-testing',
  JWT_EXPIRY_MINUTES: '15',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:8787/auth/google/callback',
  REFRESH_TOKEN_EXPIRY_DAYS: '30',
  SENDGRID_API_KEY: 'test-sendgrid-api-key',
  SENDGRID_FROM_EMAIL: 'test@example.com',
  R2_PUBLIC_URL: 'https://r2-test.example.com',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Get the test environment
 */
export function getEnv(): TestEnv {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Make sure beforeAll has run.')
  }
  return testEnv
}

/**
 * Get the D1-compatible database instance
 */
export function getDb(): D1Database {
  const env = getEnv()
  if (!env.DB) {
    throw new Error('Database not initialized. Make sure beforeAll has run.')
  }
  return env.DB
}

/**
 * Get the raw SQLite database instance (for direct SQL queries)
 */
export function getSqlite(): Database.Database {
  if (!sqliteDb) {
    throw new Error('SQLite database not initialized. Make sure beforeAll has run.')
  }
  return sqliteDb
}

/**
 * Get the mock KV store
 */
export function getKV(): MockKVStore {
  if (!mockKV) {
    throw new Error('KV not initialized. Make sure beforeAll has run.')
  }
  return mockKV
}

/**
 * Get the mock R2 bucket
 */
export function getR2(): MockR2Store {
  if (!mockR2) {
    throw new Error('R2 not initialized. Make sure beforeAll has run.')
  }
  return mockR2
}

/**
 * Create a session in KV storage
 */
export async function createSession(
  userId: string,
  sessionData?: Partial<SessionData>
): Promise<{ sessionId: string; sessionData: SessionData }> {
  const kv = getKV()
  const sessionId = crypto.randomUUID()

  const data: SessionData = {
    userId,
    email: sessionData?.email ?? `user-${userId}@example.com`,
    name: sessionData?.name ?? `Test User ${userId}`,
    avatarUrl: sessionData?.avatarUrl ?? null,
    isSuperAdmin: sessionData?.isSuperAdmin ?? false,
    fingerprint: sessionData?.fingerprint ?? {
      ip: '127.0.0.1',
      userAgent: 'IntegrationTest/1.0',
    },
  }

  await kv.put(`sid:${sessionId}`, JSON.stringify(data), { expirationTtl: 86400 })

  return { sessionId, sessionData: data }
}

/**
 * Create a test Hono app with bindings
 */
export function createTestApp(): Hono<HonoEnv> {
  const env = getEnv()
  const app = new Hono<HonoEnv>()

  // Set up bindings in middleware
  app.use('*', async (c, next) => {
    // Inject env bindings
    Object.assign(c.env, env)
    await next()
  })

  return app
}

/**
 * Clear all data from the database (useful between tests)
 */
export async function clearDatabase(): Promise<void> {
  const db = getSqlite()
  // Delete in order to respect foreign key constraints
  db.exec('DELETE FROM audit_logs')
  db.exec('DELETE FROM invitations')
  db.exec('DELETE FROM refresh_tokens')
  db.exec('DELETE FROM user_accounts')
  db.exec('DELETE FROM accounts')
  db.exec('DELETE FROM users')
}

/**
 * Seed a test user into the database
 */
export async function seedUser(userData: {
  id?: string
  googleId?: string
  email: string
  name: string
  avatarUrl?: string | null
  status?: 'active' | 'inactive'
  isSuperAdmin?: boolean
}): Promise<{ id: string; googleId: string; email: string; name: string }> {
  const db = getSqlite()
  const id = userData.id ?? crypto.randomUUID()
  const googleId = userData.googleId ?? `google_${id}`

  db.prepare(`
    INSERT INTO users (id, google_id, email, name, avatar_url, status, is_super_admin, provider_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    googleId,
    userData.email,
    userData.name,
    userData.avatarUrl ?? null,
    userData.status ?? 'active',
    userData.isSuperAdmin ? 1 : 0,
    JSON.stringify(['google'])
  )

  return { id, googleId, email: userData.email, name: userData.name }
}

/**
 * Seed a test account into the database
 */
export async function seedAccount(accountData: {
  id?: string
  name: string
  description?: string | null
  domain?: string | null
}): Promise<{ id: string; name: string }> {
  const db = getSqlite()
  const id = accountData.id ?? crypto.randomUUID()

  db.prepare(`
    INSERT INTO accounts (id, name, description, domain)
    VALUES (?, ?, ?, ?)
  `).run(id, accountData.name, accountData.description ?? null, accountData.domain ?? null)

  return { id, name: accountData.name }
}

/**
 * Seed a user-account relationship
 */
export async function seedUserAccount(data: {
  userId: string
  accountId: string
  role: 'ADMIN' | 'MANAGER' | 'EDITOR' | 'AUTHOR' | 'VIEWER' | 'BILLING' | 'ANALYTICS'
}): Promise<void> {
  const db = getSqlite()
  db.prepare(`
    INSERT INTO user_accounts (user_id, account_id, role)
    VALUES (?, ?, ?)
  `).run(data.userId, data.accountId, data.role)
}

// ============================================================================
// VITEST LIFECYCLE HOOKS
// ============================================================================

beforeAll(() => {
  // Create in-memory SQLite database
  sqliteDb = new Database(':memory:')

  // Enable foreign keys
  sqliteDb.pragma('foreign_keys = ON')

  // Create schema
  sqliteDb.exec(SCHEMA_SQL)

  // Create D1-compatible wrapper
  const d1Wrapper = createD1CompatibleWrapper(sqliteDb)

  // Create mock stores
  mockKV = createMockKV()
  mockR2 = createMockR2()

  // Create mock ASSETS fetcher
  const mockAssets: Fetcher = {
    fetch: vi.fn(async () => new Response('Not Found', { status: 404 })),
    connect: vi.fn(),
  } as unknown as Fetcher

  // Create test environment
  testEnv = {
    DB: d1Wrapper,
    SESSIONS: mockKV as unknown as KVNamespace,
    R2_BUCKET: mockR2 as unknown as R2Bucket,
    ASSETS: mockAssets,
    ...DEFAULT_TEST_ENV_VALUES,
  }

  // Mock global fetch for external services
  globalThis.fetch = createMockedFetch()
})

afterAll(() => {
  // Close database
  if (sqliteDb) {
    sqliteDb.close()
    sqliteDb = null
  }

  mockKV = null
  mockR2 = null
  testEnv = null

  // Restore original fetch
  globalThis.fetch = originalFetch
})

beforeEach(() => {
  // Clear mocks
  vi.clearAllMocks()

  // Clear KV store
  if (mockKV) {
    mockKV._store.clear()
  }

  // Clear R2 store
  if (mockR2) {
    mockR2._store.clear()
  }
})

afterEach(async () => {
  // Clear database between tests for isolation
  await clearDatabase()
})

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export { schema }
export type { Database }
