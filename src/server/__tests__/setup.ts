// src/server/__tests__/setup.ts
import { vi, beforeEach, afterEach } from 'vitest'
import type { Env } from '../env'
import type { SessionData } from '../types'
import { createMockD1, createMockD1AsD1Database, type MockD1Database } from './mocks/db'
import {
  createMockKV,
  createMockKVAsKVNamespace,
  seedMockKV,
  type MockKVNamespace,
} from './mocks/kv'
import { createMockR2, createMockR2AsR2Bucket, type MockR2Bucket } from './mocks/r2'

// Re-export mocks for convenience
export * from './mocks/db'
export * from './mocks/kv'
export * from './mocks/r2'

/**
 * Default environment configuration for tests
 */
export const DEFAULT_TEST_ENV = {
  ENVIRONMENT: 'test',
  APP_URL: 'http://localhost:8787',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  JWT_EXPIRY_MINUTES: '15',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:8787/api/auth/google/callback',
  REFRESH_TOKEN_EXPIRY_DAYS: '30',
  SENDGRID_API_KEY: 'test-sendgrid-api-key',
  SENDGRID_FROM_EMAIL: 'test@example.com',
  R2_PUBLIC_URL: 'https://r2-test.example.com',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
} as const

/**
 * Mock environment with typed mocks
 */
export interface MockEnv extends Env {
  DB: D1Database & { _mock: MockD1Database }
  SESSIONS: KVNamespace & { _mock: MockKVNamespace }
  R2_BUCKET: R2Bucket & { _mock: MockR2Bucket }
}

/**
 * Creates a complete mock environment for testing
 * @param overrides Partial env values to override defaults
 */
export function createMockEnv(overrides?: Partial<Env>): MockEnv {
  const mockDb = createMockD1()
  const mockKv = createMockKV()
  const mockR2 = createMockR2()

  // Create typed DB with internal mock reference
  const db = createMockD1AsD1Database() as D1Database & { _mock: MockD1Database }
  ;(db as any)._mock = mockDb
  // Copy mock methods to the D1Database interface
  Object.assign(db, mockDb)

  // Create typed KV with internal mock reference
  const kv = createMockKVAsKVNamespace() as KVNamespace & { _mock: MockKVNamespace }
  ;(kv as any)._mock = mockKv
  // Copy mock methods to the KVNamespace interface
  Object.assign(kv, mockKv)

  // Create typed R2 with internal mock reference
  const r2 = createMockR2AsR2Bucket() as R2Bucket & { _mock: MockR2Bucket }
  ;(r2 as any)._mock = mockR2
  // Copy mock methods to the R2Bucket interface
  Object.assign(r2, mockR2)

  // Create mock ASSETS fetcher
  const assets: Fetcher = {
    fetch: vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      return new Response('Not Found', { status: 404 })
    }),
    connect: vi.fn(),
  } as unknown as Fetcher

  return {
    DB: db,
    SESSIONS: kv,
    ASSETS: assets,
    R2_BUCKET: r2,
    ...DEFAULT_TEST_ENV,
    ...overrides,
  } as MockEnv
}

/**
 * Creates authentication headers with session cookie
 * @param sessionToken The session token/ID
 * @param accountId Optional account ID header
 */
export function createAuthHeaders(sessionToken: string, accountId?: string): Headers {
  const headers = new Headers()
  headers.set('Cookie', `sid=${sessionToken}`)

  if (accountId) {
    headers.set('X-Account-ID', accountId)
  }

  return headers
}

/**
 * Creates a mock session in KV storage
 * @param kv The mock KV namespace
 * @param token The session token
 * @param userId The user ID
 * @param sessionData Additional session data
 * @param ttlSeconds Optional TTL in seconds (default: 86400 = 24 hours)
 */
export async function createMockSession(
  kv: MockKVNamespace | KVNamespace,
  token: string,
  userId: string,
  sessionData: Partial<Omit<SessionData, 'userId'>> = {},
  ttlSeconds = 86400
): Promise<void> {
  const data: SessionData = {
    userId,
    email: sessionData.email ?? `user-${userId}@example.com`,
    name: sessionData.name ?? `User ${userId}`,
    avatarUrl: sessionData.avatarUrl ?? null,
    isSuperAdmin: sessionData.isSuperAdmin ?? false,
    fingerprint: sessionData.fingerprint ?? {
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
    },
  }

  const key = `sid:${token}`
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds })
}

/**
 * Creates an expired session in KV storage (for testing expiration)
 * @param kv The mock KV namespace
 * @param token The session token
 * @param userId The user ID
 * @param sessionData Additional session data
 */
export async function createExpiredSession(
  kv: MockKVNamespace | KVNamespace,
  token: string,
  userId: string,
  sessionData: Partial<Omit<SessionData, 'userId'>> = {}
): Promise<void> {
  const data: SessionData = {
    userId,
    email: sessionData.email ?? `user-${userId}@example.com`,
    name: sessionData.name ?? `User ${userId}`,
    avatarUrl: sessionData.avatarUrl ?? null,
    isSuperAdmin: sessionData.isSuperAdmin ?? false,
    fingerprint: sessionData.fingerprint ?? {
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
    },
  }

  const key = `sid:${token}`

  // For MockKVNamespace, we can directly set with past expiration
  if ('_store' in kv) {
    const mockKv = kv as MockKVNamespace
    mockKv._store.set(key, {
      value: JSON.stringify(data),
      expirationTtl: 1, // 1 second TTL
      storedAt: Date.now() - 2000, // Stored 2 seconds ago (already expired)
    })
  } else {
    // For real KV in integration tests, use a very short TTL
    await kv.put(key, JSON.stringify(data), { expirationTtl: 1 })
  }
}

/**
 * Global test setup - call in beforeEach
 */
export function setupTestEnvironment(): void {
  vi.clearAllMocks()
}

/**
 * Global test teardown - call in afterEach
 */
export function teardownTestEnvironment(): void {
  vi.restoreAllMocks()
}

/**
 * Setup hooks for test files
 * Import and call this in your test file to automatically setup/teardown
 */
export function registerTestLifecycle(): void {
  beforeEach(() => {
    setupTestEnvironment()
  })

  afterEach(() => {
    teardownTestEnvironment()
  })
}

/**
 * Create a mock Request object for testing handlers
 * @param method HTTP method
 * @param url URL string or path
 * @param options Request options
 */
export function createMockRequest(
  method: string,
  url: string,
  options?: {
    body?: unknown
    headers?: Headers | Record<string, string>
    sessionToken?: string
    accountId?: string
  }
): Request {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:8787${url}`

  const headers = new Headers()

  // Add custom headers
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers.set(key, value)
      })
    } else {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value)
      }
    }
  }

  // Add session cookie
  if (options?.sessionToken) {
    headers.set('Cookie', `sid=${options.sessionToken}`)
  }

  // Add account ID header
  if (options?.accountId) {
    headers.set('X-Account-ID', options.accountId)
  }

  // Set content type for JSON body
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const init: RequestInit = {
    method,
    headers,
  }

  if (options?.body) {
    init.body = JSON.stringify(options.body)
  }

  return new Request(fullUrl, init)
}

/**
 * Helper to extract JSON from Response
 * @param response Response object
 */
export async function getResponseJson<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

/**
 * Helper to check if response is successful
 * @param response Response object
 */
export function isSuccessResponse(response: Response): boolean {
  return response.ok && response.status >= 200 && response.status < 300
}
