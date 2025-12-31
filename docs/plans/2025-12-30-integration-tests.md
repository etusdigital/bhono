# Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive integration tests covering all API endpoints, services, authentication flows, authorization, and multi-tenancy with real database operations.

**Architecture:** Integration tests use real D1 database with in-memory SQLite, real Hono app instance with all middleware, and mocked external services (Google OAuth, SendGrid, R2). Tests verify end-to-end request/response flows including database state changes and audit logging.

**Tech Stack:** Vitest, Hono testClient, D1 (SQLite in-memory), Drizzle ORM, vitest mocks for external APIs

---

## Test Infrastructure Overview

### Test Categories
| Category | Description | Database | External APIs |
|----------|-------------|----------|---------------|
| Integration | Full request→response with real DB | Real (in-memory SQLite) | Mocked |
| E2E | Full browser flows | Real (Miniflare D1) | Real or Mocked |

### Test File Structure
```
src/server/__integration__/
├── setup.ts                    # Shared setup, app factory, DB seeding
├── fixtures/                   # Test data factories
│   ├── users.ts
│   ├── accounts.ts
│   └── invitations.ts
├── auth/
│   ├── login.test.ts          # OAuth flow
│   ├── session.test.ts        # Session management
│   ├── logout.test.ts         # Logout flow
│   └── refresh.test.ts        # Token refresh
├── users/
│   ├── list.test.ts           # GET /api/users
│   ├── get.test.ts            # GET /api/users/:id
│   ├── update.test.ts         # PATCH /api/users/:id
│   ├── delete.test.ts         # DELETE /api/users/:id
│   ├── restore.test.ts        # POST /api/users/:id/restore
│   └── bulk.test.ts           # Bulk operations
├── accounts/
│   ├── list.test.ts           # GET /api/accounts
│   ├── get.test.ts            # GET /api/accounts/:id
│   ├── create.test.ts         # POST /api/accounts
│   ├── update.test.ts         # PATCH /api/accounts/:id
│   ├── delete.test.ts         # DELETE /api/accounts/:id
│   └── restore.test.ts        # POST /api/accounts/:id/restore
├── invitations/
│   ├── create.test.ts         # POST /api/invitations
│   ├── list.test.ts           # GET /api/invitations
│   ├── revoke.test.ts         # DELETE /api/invitations/:id
│   └── accept.test.ts         # Accept flow
├── audits/
│   └── list.test.ts           # GET /api/audits
├── storage/
│   ├── upload.test.ts         # Upload flow
│   └── delete.test.ts         # Delete flow
├── health/
│   └── health.test.ts         # Health endpoints
└── authorization/
    ├── roles.test.ts          # Role hierarchy tests
    ├── permissions.test.ts    # Permission matrix tests
    └── multi-tenancy.test.ts  # Account isolation tests
```

---

## Task 1: Integration Test Infrastructure Setup

**Files:**
- Create: `src/server/__integration__/setup.ts`
- Create: `src/server/__integration__/vitest.config.ts`
- Modify: `package.json` (add test:integration script)

**Step 1: Create integration test vitest config**

```typescript
// src/server/__integration__/vitest.config.ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@server': fileURLToPath(new URL('../', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/server/__integration__/**/*.test.ts'],
    setupFiles: ['./src/server/__integration__/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Ensure sequential execution for DB tests
      },
    },
  },
})
```

**Step 2: Create integration test setup**

```typescript
// src/server/__integration__/setup.ts
import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import Database from 'better-sqlite3'
import { Hono } from 'hono'
import * as schema from '../db/schema'
import type { HonoEnv } from '../types'

// Mock external services
vi.mock('../lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
}))

vi.mock('../lib/oauth', () => ({
  exchangeCodeForTokens: vi.fn().mockResolvedValue({
    access_token: 'mock-access-token',
    id_token: 'mock-id-token',
  }),
  decodeIdToken: vi.fn().mockReturnValue({
    sub: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    email_verified: true,
  }),
  generateState: vi.fn().mockReturnValue('mock-state'),
  generateCodeVerifier: vi.fn().mockReturnValue('mock-verifier'),
  generateCodeChallenge: vi.fn().mockResolvedValue('mock-challenge'),
  buildGoogleAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth'),
}))

// In-memory SQLite database
let sqlite: Database.Database
let db: ReturnType<typeof drizzle>

// Mock KV store
const kvStore = new Map<string, { value: string; expiration?: number }>()

const mockKV: KVNamespace = {
  get: vi.fn(async (key: string) => {
    const entry = kvStore.get(key)
    if (!entry) return null
    if (entry.expiration && Date.now() > entry.expiration) {
      kvStore.delete(key)
      return null
    }
    return entry.value
  }),
  put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined
    kvStore.set(key, { value, expiration })
  }),
  delete: vi.fn(async (key: string) => {
    kvStore.delete(key)
  }),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
} as unknown as KVNamespace

// Mock R2 bucket
const r2Store = new Map<string, { body: ArrayBuffer; metadata: Record<string, string> }>()

const mockR2: R2Bucket = {
  put: vi.fn(async (key: string, body: ArrayBuffer | string, options?: any) => {
    const buffer = typeof body === 'string' ? new TextEncoder().encode(body).buffer : body
    r2Store.set(key, { body: buffer, metadata: options?.customMetadata || {} })
    return { key, size: buffer.byteLength } as R2Object
  }),
  get: vi.fn(async (key: string) => {
    const entry = r2Store.get(key)
    if (!entry) return null
    return {
      key,
      body: entry.body,
      arrayBuffer: async () => entry.body,
      text: async () => new TextDecoder().decode(entry.body),
      json: async () => JSON.parse(new TextDecoder().decode(entry.body)),
      customMetadata: entry.metadata,
    } as unknown as R2ObjectBody
  }),
  delete: vi.fn(async (key: string) => {
    r2Store.delete(key)
  }),
  head: vi.fn(async (key: string) => {
    const entry = r2Store.get(key)
    if (!entry) return null
    return { key, size: entry.body.byteLength, customMetadata: entry.metadata } as R2Object
  }),
  list: vi.fn(async (options?: { prefix?: string }) => {
    const objects: R2Object[] = []
    for (const [key, entry] of r2Store.entries()) {
      if (!options?.prefix || key.startsWith(options.prefix)) {
        objects.push({ key, size: entry.body.byteLength } as R2Object)
      }
    }
    return { objects, truncated: false } as R2Objects
  }),
  createMultipartUpload: vi.fn(),
} as unknown as R2Bucket

// Test environment
export const testEnv = {
  DB: null as unknown as D1Database,
  KV: mockKV,
  R2_BUCKET: mockR2,
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:8787/auth/callback',
  JWT_SECRET: 'test-jwt-secret-key-for-integration-tests',
  COOKIE_SECRET: 'test-cookie-secret',
  APP_URL: 'http://localhost:8787',
  CORS_ORIGINS: 'http://localhost:5173',
  SENDGRID_API_KEY: 'test-sendgrid-key',
  SENDGRID_FROM_EMAIL: 'noreply@test.com',
  R2_PUBLIC_URL: 'https://r2.test.com',
}

// Schema SQL for in-memory database
const schemaSql = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    provider_ids TEXT,
    is_super_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    created_by_id TEXT,
    updated_by_id TEXT,
    deleted_by_id TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    domain TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS user_accounts (
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    PRIMARY KEY (user_id, account_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    revoked_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    invited_by_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_id) REFERENCES users(id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_account_email
    ON invitations(account_id, email) WHERE accepted_at IS NULL;

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    account_id TEXT,
    user_id TEXT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );
`

export function getDb() {
  return db
}

export function getSqlite() {
  return sqlite
}

export function getKV() {
  return mockKV
}

export function getR2() {
  return mockR2
}

export function getEnv() {
  return testEnv
}

// Create D1-compatible wrapper for better-sqlite3
function createD1Wrapper(sqlite: Database.Database): D1Database {
  return {
    prepare: (sql: string) => {
      const stmt = sqlite.prepare(sql)
      return {
        bind: (...params: unknown[]) => ({
          run: async () => {
            try {
              const result = stmt.run(...params)
              return {
                success: true,
                results: [],
                meta: { changes: result.changes, last_row_id: result.lastInsertRowid }
              }
            } catch (e) {
              return { success: false, error: String(e), results: [] }
            }
          },
          all: async () => {
            try {
              const results = stmt.all(...params)
              return { success: true, results }
            } catch (e) {
              return { success: false, error: String(e), results: [] }
            }
          },
          first: async () => {
            try {
              const result = stmt.get(...params)
              return result || null
            } catch (e) {
              return null
            }
          },
          raw: async () => {
            const results = stmt.all(...params)
            return results.map(r => Object.values(r as object))
          },
        }),
        run: async () => {
          const result = stmt.run()
          return { success: true, results: [], meta: { changes: result.changes } }
        },
        all: async () => {
          const results = stmt.all()
          return { success: true, results }
        },
        first: async () => stmt.get() || null,
        raw: async () => {
          const results = stmt.all()
          return results.map(r => Object.values(r as object))
        },
      }
    },
    batch: async (statements: D1PreparedStatement[]) => {
      const results = []
      for (const stmt of statements) {
        results.push(await stmt.all())
      }
      return results
    },
    exec: async (sql: string) => {
      sqlite.exec(sql)
      return { count: 1, duration: 0 }
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}

beforeAll(async () => {
  // Create in-memory SQLite database
  sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')

  // Create schema
  sqlite.exec(schemaSql)

  // Create D1 wrapper and Drizzle instance
  testEnv.DB = createD1Wrapper(sqlite)
  db = drizzle(testEnv.DB, { schema })
})

afterAll(() => {
  sqlite?.close()
})

beforeEach(() => {
  // Clear KV and R2 stores
  kvStore.clear()
  r2Store.clear()

  // Clear all mocks
  vi.clearAllMocks()
})

afterEach(() => {
  // Clean up database tables (in reverse order of dependencies)
  sqlite.exec('DELETE FROM audit_logs')
  sqlite.exec('DELETE FROM invitations')
  sqlite.exec('DELETE FROM refresh_tokens')
  sqlite.exec('DELETE FROM user_accounts')
  sqlite.exec('DELETE FROM accounts')
  sqlite.exec('DELETE FROM users')
})

// Helper to create authenticated session
export async function createSession(userId: string, options: {
  ip?: string
  userAgent?: string
  expiresIn?: number
} = {}) {
  const sessionId = `sid_${crypto.randomUUID()}`
  const fingerprint = JSON.stringify({
    ip: options.ip || '127.0.0.1',
    userAgent: options.userAgent || 'test-agent',
  })

  const sessionData = {
    userId,
    fingerprint,
    createdAt: Date.now(),
  }

  await mockKV.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: options.expiresIn || 86400,
  })

  return sessionId
}

// Helper to create test app
export function createTestApp() {
  // Import the actual app factory
  const { createApp } = require('../index')
  return createApp()
}

// Export schema for direct DB operations in tests
export { schema }
```

**Step 3: Add npm script**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "test:integration": "vitest run --config src/server/__integration__/vitest.config.ts",
    "test:integration:watch": "vitest --config src/server/__integration__/vitest.config.ts"
  }
}
```

**Step 4: Run setup test**

Run: `npm run test:integration`
Expected: No tests found (setup complete)

**Step 5: Commit**

```bash
git add src/server/__integration__/setup.ts src/server/__integration__/vitest.config.ts package.json
git commit -m "test: add integration test infrastructure with in-memory SQLite"
```

---

## Task 2: Test Fixtures Factory

**Files:**
- Create: `src/server/__integration__/fixtures/index.ts`
- Create: `src/server/__integration__/fixtures/users.ts`
- Create: `src/server/__integration__/fixtures/accounts.ts`
- Create: `src/server/__integration__/fixtures/invitations.ts`

**Step 1: Create users fixture factory**

```typescript
// src/server/__integration__/fixtures/users.ts
import { v4 as uuid } from 'uuid'
import { getDb, schema } from '../setup'

export interface CreateUserOptions {
  id?: string
  googleId?: string
  email?: string
  name?: string
  avatarUrl?: string
  status?: 'active' | 'inactive'
  isSuperAdmin?: boolean
  deletedAt?: string | null
}

export async function createUser(options: CreateUserOptions = {}) {
  const db = getDb()
  const id = options.id || uuid()

  const user = {
    id,
    googleId: options.googleId || `google-${id}`,
    email: options.email || `user-${id}@test.com`,
    name: options.name || `Test User ${id.slice(0, 8)}`,
    avatarUrl: options.avatarUrl || null,
    status: options.status || 'active',
    isSuperAdmin: options.isSuperAdmin ? 1 : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: options.deletedAt || null,
  }

  await db.insert(schema.users).values(user)

  return user
}

export async function createSuperAdmin(options: Omit<CreateUserOptions, 'isSuperAdmin'> = {}) {
  return createUser({ ...options, isSuperAdmin: true })
}

export async function createInactiveUser(options: Omit<CreateUserOptions, 'status'> = {}) {
  return createUser({ ...options, status: 'inactive' })
}

export async function createDeletedUser(options: Omit<CreateUserOptions, 'deletedAt'> = {}) {
  return createUser({ ...options, deletedAt: new Date().toISOString() })
}
```

**Step 2: Create accounts fixture factory**

```typescript
// src/server/__integration__/fixtures/accounts.ts
import { v4 as uuid } from 'uuid'
import { getDb, schema } from '../setup'

export interface CreateAccountOptions {
  id?: string
  name?: string
  description?: string
  domain?: string | null
  deletedAt?: string | null
}

export async function createAccount(options: CreateAccountOptions = {}) {
  const db = getDb()
  const id = options.id || uuid()

  const account = {
    id,
    name: options.name || `Test Account ${id.slice(0, 8)}`,
    description: options.description || null,
    domain: options.domain || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: options.deletedAt || null,
  }

  await db.insert(schema.accounts).values(account)

  return account
}

export async function createDeletedAccount(options: Omit<CreateAccountOptions, 'deletedAt'> = {}) {
  return createAccount({ ...options, deletedAt: new Date().toISOString() })
}

export type Role = 'ADMIN' | 'MANAGER' | 'EDITOR' | 'AUTHOR' | 'VIEWER' | 'BILLING' | 'ANALYTICS'

export async function addUserToAccount(
  userId: string,
  accountId: string,
  role: Role = 'VIEWER'
) {
  const db = getDb()

  await db.insert(schema.userAccounts).values({
    userId,
    accountId,
    role,
  })

  return { userId, accountId, role }
}
```

**Step 3: Create invitations fixture factory**

```typescript
// src/server/__integration__/fixtures/invitations.ts
import { v4 as uuid } from 'uuid'
import { getDb, schema } from '../setup'
import type { Role } from './accounts'

export interface CreateInvitationOptions {
  id?: string
  accountId: string
  email?: string
  role?: Role
  token?: string
  invitedById: string
  expiresAt?: string
  acceptedAt?: string | null
}

export async function createInvitation(options: CreateInvitationOptions) {
  const db = getDb()
  const id = options.id || uuid()

  const invitation = {
    id,
    accountId: options.accountId,
    email: options.email || `invite-${id}@test.com`,
    role: options.role || 'VIEWER',
    token: options.token || uuid(),
    invitedById: options.invitedById,
    expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: options.acceptedAt || null,
    createdAt: new Date().toISOString(),
  }

  await db.insert(schema.invitations).values(invitation)

  return invitation
}

export async function createExpiredInvitation(options: Omit<CreateInvitationOptions, 'expiresAt'>) {
  return createInvitation({
    ...options,
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  })
}

export async function createAcceptedInvitation(options: Omit<CreateInvitationOptions, 'acceptedAt'>) {
  return createInvitation({
    ...options,
    acceptedAt: new Date().toISOString(),
  })
}
```

**Step 4: Create index export**

```typescript
// src/server/__integration__/fixtures/index.ts
export * from './users'
export * from './accounts'
export * from './invitations'

import { createUser, createSuperAdmin } from './users'
import { createAccount, addUserToAccount, type Role } from './accounts'
import { createSession } from '../setup'

// Helper to create a complete test scenario
export interface TestScenarioOptions {
  userRole?: Role
  isSuperAdmin?: boolean
}

export async function createTestScenario(options: TestScenarioOptions = {}) {
  const user = options.isSuperAdmin
    ? await createSuperAdmin()
    : await createUser()

  const account = await createAccount()

  if (!options.isSuperAdmin) {
    await addUserToAccount(user.id, account.id, options.userRole || 'ADMIN')
  }

  const sessionId = await createSession(user.id)

  return {
    user,
    account,
    sessionId,
    headers: {
      Cookie: `sid=${sessionId}`,
      'account-id': account.id,
    },
  }
}

// Create scenario with multiple users in same account
export async function createMultiUserScenario() {
  const account = await createAccount()

  const admin = await createUser({ name: 'Admin User' })
  const manager = await createUser({ name: 'Manager User' })
  const viewer = await createUser({ name: 'Viewer User' })

  await addUserToAccount(admin.id, account.id, 'ADMIN')
  await addUserToAccount(manager.id, account.id, 'MANAGER')
  await addUserToAccount(viewer.id, account.id, 'VIEWER')

  const adminSession = await createSession(admin.id)
  const managerSession = await createSession(manager.id)
  const viewerSession = await createSession(viewer.id)

  return {
    account,
    admin: {
      user: admin,
      sessionId: adminSession,
      headers: { Cookie: `sid=${adminSession}`, 'account-id': account.id },
    },
    manager: {
      user: manager,
      sessionId: managerSession,
      headers: { Cookie: `sid=${managerSession}`, 'account-id': account.id },
    },
    viewer: {
      user: viewer,
      sessionId: viewerSession,
      headers: { Cookie: `sid=${viewerSession}`, 'account-id': account.id },
    },
  }
}

// Create scenario with multiple accounts (for multi-tenancy tests)
export async function createMultiTenantScenario() {
  const user = await createUser()

  const account1 = await createAccount({ name: 'Account 1' })
  const account2 = await createAccount({ name: 'Account 2' })
  const account3 = await createAccount({ name: 'Account 3 (no access)' })

  await addUserToAccount(user.id, account1.id, 'ADMIN')
  await addUserToAccount(user.id, account2.id, 'VIEWER')
  // User has NO access to account3

  const sessionId = await createSession(user.id)

  return {
    user,
    sessionId,
    account1: {
      account: account1,
      role: 'ADMIN' as Role,
      headers: { Cookie: `sid=${sessionId}`, 'account-id': account1.id },
    },
    account2: {
      account: account2,
      role: 'VIEWER' as Role,
      headers: { Cookie: `sid=${sessionId}`, 'account-id': account2.id },
    },
    account3: {
      account: account3,
      role: null, // No access
      headers: { Cookie: `sid=${sessionId}`, 'account-id': account3.id },
    },
  }
}
```

**Step 5: Commit**

```bash
git add src/server/__integration__/fixtures/
git commit -m "test: add integration test fixtures for users, accounts, invitations"
```

---

## Task 3: Health Check Integration Tests

**Files:**
- Create: `src/server/__integration__/health/health.test.ts`

**Step 1: Write health check tests**

```typescript
// src/server/__integration__/health/health.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv } from '../setup'

describe('Health Check Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /health', () => {
    it('should return healthy status with all services up', async () => {
      const res = await app.request('/health', {}, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('healthy')
      expect(body.services).toBeDefined()
      expect(body.services.database).toBe('up')
      expect(body.services.storage).toBe('up')
      expect(body.timestamp).toBeDefined()
    })

    it('should include version information', async () => {
      const res = await app.request('/health', {}, getEnv())
      const body = await res.json()

      expect(body.version).toBeDefined()
    })
  })

  describe('GET /health/ready', () => {
    it('should return 200 when database is connected', async () => {
      const res = await app.request('/health/ready', {}, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.ready).toBe(true)
      expect(body.database).toBe('connected')
    })
  })

  describe('GET /health/live', () => {
    it('should return 200 indicating process is alive', async () => {
      const res = await app.request('/health/live', {}, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.alive).toBe(true)
    })
  })

  describe('CORS headers', () => {
    it('should include CORS headers for health endpoints', async () => {
      const res = await app.request('/health', {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:5173' },
      }, getEnv())

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    })
  })
})
```

**Step 2: Run test**

Run: `npm run test:integration -- health`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/health/
git commit -m "test: add health check integration tests"
```

---

## Task 4: Authentication - Session Tests

**Files:**
- Create: `src/server/__integration__/auth/session.test.ts`

**Step 1: Write session tests**

```typescript
// src/server/__integration__/auth/session.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, createSession, getKV } from '../setup'
import { createUser, createInactiveUser, createDeletedUser } from '../fixtures'

describe('Session Authentication Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /auth/me', () => {
    it('should return 401 without session cookie', async () => {
      const res = await app.request('/auth/me', {}, getEnv())

      expect(res.status).toBe(401)
    })

    it('should return 401 with invalid session', async () => {
      const res = await app.request('/auth/me', {
        headers: { Cookie: 'sid=invalid-session-id' },
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should return 401 with expired session', async () => {
      const user = await createUser()
      const sessionId = await createSession(user.id, { expiresIn: -1 })

      // Wait for KV to recognize expiration
      await new Promise(resolve => setTimeout(resolve, 10))

      const res = await app.request('/auth/me', {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should return 401 when user is inactive', async () => {
      const user = await createInactiveUser()
      const sessionId = await createSession(user.id)

      const res = await app.request('/auth/me', {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should return 401 when user is deleted', async () => {
      const user = await createDeletedUser()
      const sessionId = await createSession(user.id)

      const res = await app.request('/auth/me', {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should return current user with valid session', async () => {
      const user = await createUser({
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
      })
      const sessionId = await createSession(user.id)

      const res = await app.request('/auth/me', {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.user.id).toBe(user.id)
      expect(body.user.email).toBe('test@example.com')
      expect(body.user.name).toBe('Test User')
      expect(body.user.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('should include isSuperAdmin flag', async () => {
      const user = await createUser({ isSuperAdmin: true })
      const sessionId = await createSession(user.id)

      const res = await app.request('/auth/me', {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      const body = await res.json()
      expect(body.user.isSuperAdmin).toBe(true)
    })
  })

  describe('Session fingerprint validation', () => {
    it('should reject session with mismatched IP', async () => {
      const user = await createUser()
      const sessionId = await createSession(user.id, { ip: '192.168.1.1' })

      const res = await app.request('/auth/me', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'X-Forwarded-For': '10.0.0.1', // Different IP
        },
      }, getEnv())

      expect(res.status).toBe(401)
    })
  })
})
```

**Step 2: Run test**

Run: `npm run test:integration -- auth/session`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/auth/session.test.ts
git commit -m "test: add session authentication integration tests"
```

---

## Task 5: Authentication - Logout Tests

**Files:**
- Create: `src/server/__integration__/auth/logout.test.ts`

**Step 1: Write logout tests**

```typescript
// src/server/__integration__/auth/logout.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, createSession, getKV } from '../setup'
import { createUser } from '../fixtures'

describe('Logout Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('POST /auth/logout', () => {
    it('should return 401 without session', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should logout and invalidate session', async () => {
      const user = await createUser()
      const sessionId = await createSession(user.id)

      // Verify session exists before logout
      const kv = getKV()
      const sessionBefore = await kv.get(`session:${sessionId}`)
      expect(sessionBefore).not.toBeNull()

      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect(res.status).toBe(200)

      // Verify session is deleted
      const sessionAfter = await kv.get(`session:${sessionId}`)
      expect(sessionAfter).toBeNull()
    })

    it('should clear session cookie', async () => {
      const user = await createUser()
      const sessionId = await createSession(user.id)

      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      const setCookie = res.headers.get('Set-Cookie')
      expect(setCookie).toContain('sid=')
      expect(setCookie).toContain('Max-Age=0')
    })

    it('should return success message', async () => {
      const user = await createUser()
      const sessionId = await createSession(user.id)

      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('should create audit log for logout', async () => {
      const user = await createUser()
      const sessionId = await createSession(user.id)

      await app.request('/auth/logout', {
        method: 'POST',
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      // Verify audit log was created
      const { getDb, schema } = await import('../setup')
      const db = getDb()
      const logs = await db.select().from(schema.auditLogs).where(
        eq(schema.auditLogs.action, 'LOGOUT')
      )

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].userId).toBe(user.id)
    })
  })
})
```

**Step 2: Run test**

Run: `npm run test:integration -- auth/logout`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/auth/logout.test.ts
git commit -m "test: add logout integration tests"
```

---

## Task 6: Users API - List Users

**Files:**
- Create: `src/server/__integration__/users/list.test.ts`

**Step 1: Write list users tests**

```typescript
// src/server/__integration__/users/list.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv } from '../setup'
import { createTestScenario, createMultiUserScenario, createMultiTenantScenario } from '../fixtures'
import { createUser, addUserToAccount } from '../fixtures'

describe('List Users Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /api/users', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/users', {}, getEnv())

      expect(res.status).toBe(401)
    })

    it('should return 400 without account-id header', async () => {
      const { user, sessionId } = await createTestScenario()

      const res = await app.request('/api/users', {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect(res.status).toBe(400)
    })

    it('should return 403 when user is not member of account', async () => {
      const scenario = await createMultiTenantScenario()

      const res = await app.request('/api/users', {
        headers: scenario.account3.headers, // User has no access
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should return paginated users for account', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/users?page=1&limit=10', {
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data.length).toBe(3) // admin, manager, viewer
      expect(body.pagination).toBeDefined()
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(10)
      expect(body.pagination.total).toBe(3)
    })

    it('should filter users by search query', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/users?search=Manager', {
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.length).toBe(1)
      expect(body.data[0].name).toBe('Manager User')
    })

    it('should respect pagination parameters', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/users?page=2&limit=1', {
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.length).toBe(1)
      expect(body.pagination.page).toBe(2)
      expect(body.pagination.totalPages).toBe(3)
    })

    it('should exclude deleted users by default', async () => {
      const { account, admin } = await createMultiUserScenario()
      const deletedUser = await createUser({ deletedAt: new Date().toISOString() })
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      const res = await app.request('/api/users', {
        headers: admin.headers,
      }, getEnv())

      const body = await res.json()
      const userIds = body.data.map((u: any) => u.id)
      expect(userIds).not.toContain(deletedUser.id)
    })

    it('should include deleted users when includeDeleted=true', async () => {
      const { account, admin } = await createMultiUserScenario()
      const deletedUser = await createUser({ deletedAt: new Date().toISOString() })
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      const res = await app.request('/api/users?includeDeleted=true', {
        headers: admin.headers,
      }, getEnv())

      const body = await res.json()
      const userIds = body.data.map((u: any) => u.id)
      expect(userIds).toContain(deletedUser.id)
    })

    it('should only show users in same account (multi-tenancy)', async () => {
      const scenario = await createMultiTenantScenario()

      // Create another user in account1 only
      const otherUser = await createUser({ name: 'Other User' })
      await addUserToAccount(otherUser.id, scenario.account1.account.id, 'VIEWER')

      // Create user in account2 only
      const account2User = await createUser({ name: 'Account2 User' })
      await addUserToAccount(account2User.id, scenario.account2.account.id, 'VIEWER')

      // Query account1
      const res1 = await app.request('/api/users', {
        headers: scenario.account1.headers,
      }, getEnv())

      const body1 = await res1.json()
      const names1 = body1.data.map((u: any) => u.name)
      expect(names1).toContain('Other User')
      expect(names1).not.toContain('Account2 User')

      // Query account2
      const res2 = await app.request('/api/users', {
        headers: scenario.account2.headers,
      }, getEnv())

      const body2 = await res2.json()
      const names2 = body2.data.map((u: any) => u.name)
      expect(names2).toContain('Account2 User')
      expect(names2).not.toContain('Other User')
    })
  })
})
```

**Step 2: Run test**

Run: `npm run test:integration -- users/list`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/users/list.test.ts
git commit -m "test: add list users integration tests"
```

---

## Task 7: Users API - Get, Update, Delete, Restore

**Files:**
- Create: `src/server/__integration__/users/get.test.ts`
- Create: `src/server/__integration__/users/update.test.ts`
- Create: `src/server/__integration__/users/delete.test.ts`
- Create: `src/server/__integration__/users/restore.test.ts`

**Step 1: Write get user tests**

```typescript
// src/server/__integration__/users/get.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv } from '../setup'
import { createTestScenario, createMultiUserScenario } from '../fixtures'
import { createUser } from '../fixtures'

describe('Get User Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /api/users/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/users/some-id', {}, getEnv())
      expect(res.status).toBe(401)
    })

    it('should return 404 for non-existent user', async () => {
      const { headers } = await createTestScenario()

      const res = await app.request('/api/users/non-existent-id', {
        headers,
      }, getEnv())

      expect(res.status).toBe(404)
    })

    it('should return user details', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.manager.user.id}`, {
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.id).toBe(scenario.manager.user.id)
      expect(body.name).toBe('Manager User')
      expect(body.role).toBe('MANAGER')
    })

    it('should return 403 when user not in same account', async () => {
      const scenario1 = await createTestScenario()
      const otherUser = await createUser()

      const res = await app.request(`/api/users/${otherUser.id}`, {
        headers: scenario1.headers,
      }, getEnv())

      expect(res.status).toBe(404) // Returns 404 for security (don't reveal existence)
    })
  })
})
```

**Step 2: Write update user tests**

```typescript
// src/server/__integration__/users/update.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createMultiUserScenario } from '../fixtures'
import { eq } from 'drizzle-orm'

describe('Update User Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('PATCH /api/users/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/users/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should update user name', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.name).toBe('Updated Name')

      // Verify in database
      const db = getDb()
      const [user] = await db.select().from(schema.users).where(
        eq(schema.users.id, scenario.viewer.user.id)
      )
      expect(user.name).toBe('Updated Name')
    })

    it('should update user status', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inactive' }),
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('inactive')
    })

    it('should create audit log', async () => {
      const scenario = await createMultiUserScenario()

      await app.request(`/api/users/${scenario.viewer.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Audit Test' }),
      }, getEnv())

      const db = getDb()
      const logs = await db.select().from(schema.auditLogs).where(
        eq(schema.auditLogs.entityId, scenario.viewer.user.id)
      )

      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0].action).toBe('UPDATE')
      expect(logs[0].entity).toBe('user')
    })

    it('should return 403 for VIEWER role', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.manager.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.viewer.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Fail' }),
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should validate input schema', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'invalid-status' }),
      }, getEnv())

      expect(res.status).toBe(400)
    })
  })
})
```

**Step 3: Write delete user tests**

```typescript
// src/server/__integration__/users/delete.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createMultiUserScenario } from '../fixtures'
import { eq } from 'drizzle-orm'

describe('Delete User Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('DELETE /api/users/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/users/some-id', {
        method: 'DELETE',
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should soft delete user', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
        method: 'DELETE',
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(204)

      // Verify soft delete in database
      const db = getDb()
      const [user] = await db.select().from(schema.users).where(
        eq(schema.users.id, scenario.viewer.user.id)
      )
      expect(user.deletedAt).not.toBeNull()
    })

    it('should create audit log for deletion', async () => {
      const scenario = await createMultiUserScenario()

      await app.request(`/api/users/${scenario.viewer.user.id}`, {
        method: 'DELETE',
        headers: scenario.admin.headers,
      }, getEnv())

      const db = getDb()
      const logs = await db.select().from(schema.auditLogs).where(
        eq(schema.auditLogs.entityId, scenario.viewer.user.id)
      )

      const deleteLog = logs.find(l => l.action === 'DELETE')
      expect(deleteLog).toBeDefined()
    })

    it('should return 403 for VIEWER role', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.manager.user.id}`, {
        method: 'DELETE',
        headers: scenario.viewer.headers,
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should prevent self-deletion', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.admin.user.id}`, {
        method: 'DELETE',
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(403)
    })
  })
})
```

**Step 4: Write restore user tests**

```typescript
// src/server/__integration__/users/restore.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createMultiUserScenario, createTestScenario } from '../fixtures'
import { createDeletedUser, addUserToAccount } from '../fixtures'
import { eq } from 'drizzle-orm'

describe('Restore User Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('POST /api/users/:id/restore', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/users/some-id/restore', {
        method: 'POST',
      }, getEnv())

      expect(res.status).toBe(401)
    })

    it('should restore soft-deleted user', async () => {
      const { account, admin } = await createMultiUserScenario()
      const deletedUser = await createDeletedUser()
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
        method: 'POST',
        headers: admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      // Verify in database
      const db = getDb()
      const [user] = await db.select().from(schema.users).where(
        eq(schema.users.id, deletedUser.id)
      )
      expect(user.deletedAt).toBeNull()
    })

    it('should return 404 for non-deleted user', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/users/${scenario.viewer.user.id}/restore`, {
        method: 'POST',
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(404)
    })

    it('should require ADMIN role', async () => {
      const { account, manager } = await createMultiUserScenario()
      const deletedUser = await createDeletedUser()
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
        method: 'POST',
        headers: manager.headers,
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should create audit log for restore', async () => {
      const { account, admin } = await createMultiUserScenario()
      const deletedUser = await createDeletedUser()
      await addUserToAccount(deletedUser.id, account.id, 'VIEWER')

      await app.request(`/api/users/${deletedUser.id}/restore`, {
        method: 'POST',
        headers: admin.headers,
      }, getEnv())

      const db = getDb()
      const logs = await db.select().from(schema.auditLogs).where(
        eq(schema.auditLogs.entityId, deletedUser.id)
      )

      const restoreLog = logs.find(l => l.changes?.includes('restored'))
      expect(restoreLog).toBeDefined()
    })
  })
})
```

**Step 5: Run tests**

Run: `npm run test:integration -- users/`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/server/__integration__/users/
git commit -m "test: add users CRUD integration tests"
```

---

## Task 8: Accounts API - Full CRUD

**Files:**
- Create: `src/server/__integration__/accounts/list.test.ts`
- Create: `src/server/__integration__/accounts/get.test.ts`
- Create: `src/server/__integration__/accounts/create.test.ts`
- Create: `src/server/__integration__/accounts/update.test.ts`
- Create: `src/server/__integration__/accounts/delete.test.ts`
- Create: `src/server/__integration__/accounts/restore.test.ts`

**Step 1: Write accounts tests (combined for brevity)**

```typescript
// src/server/__integration__/accounts/list.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv } from '../setup'
import { createTestScenario, createMultiTenantScenario } from '../fixtures'
import { createSuperAdmin, createSession, createAccount, addUserToAccount } from '../fixtures'

describe('List Accounts Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /api/accounts', () => {
    it('should return only accounts user has access to', async () => {
      const scenario = await createMultiTenantScenario()

      const res = await app.request('/api/accounts', {
        headers: scenario.account1.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.length).toBe(2) // account1 and account2 only

      const accountIds = body.data.map((a: any) => a.id)
      expect(accountIds).toContain(scenario.account1.account.id)
      expect(accountIds).toContain(scenario.account2.account.id)
      expect(accountIds).not.toContain(scenario.account3.account.id)
    })

    it('should return all accounts for super admin', async () => {
      const superAdmin = await createSuperAdmin()
      const sessionId = await createSession(superAdmin.id)

      // Create multiple accounts
      await createAccount({ name: 'Account A' })
      await createAccount({ name: 'Account B' })
      await createAccount({ name: 'Account C' })

      const res = await app.request('/api/accounts', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': 'any', // Super admin can use any account-id
        },
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(3)
    })
  })
})
```

```typescript
// src/server/__integration__/accounts/create.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createTestScenario } from '../fixtures'
import { createSuperAdmin, createSession } from '../fixtures'

describe('Create Account Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('POST /api/accounts', () => {
    it('should return 403 for non-super-admin', async () => {
      const { headers } = await createTestScenario()

      const res = await app.request('/api/accounts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Account' }),
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should create account for super admin', async () => {
      const superAdmin = await createSuperAdmin()
      const sessionId = await createSession(superAdmin.id)

      const res = await app.request('/api/accounts', {
        method: 'POST',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': 'system',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Account',
          description: 'Test description',
          domain: 'newaccount.test.com',
        }),
      }, getEnv())

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.name).toBe('New Account')
      expect(body.domain).toBe('newaccount.test.com')
    })

    it('should reject duplicate domain', async () => {
      const superAdmin = await createSuperAdmin()
      const sessionId = await createSession(superAdmin.id)

      // Create first account
      await app.request('/api/accounts', {
        method: 'POST',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': 'system',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'First', domain: 'unique.test.com' }),
      }, getEnv())

      // Try to create second with same domain
      const res = await app.request('/api/accounts', {
        method: 'POST',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': 'system',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Second', domain: 'unique.test.com' }),
      }, getEnv())

      expect(res.status).toBe(409)
    })
  })
})
```

```typescript
// src/server/__integration__/accounts/update.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createTestScenario, createMultiUserScenario } from '../fixtures'
import { eq } from 'drizzle-orm'

describe('Update Account Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('PATCH /api/accounts/:id', () => {
    it('should update account for ADMIN', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.name).toBe('Updated Name')
    })

    it('should return 403 for VIEWER', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.viewer.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Should Fail' }),
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should create audit log', async () => {
      const scenario = await createMultiUserScenario()

      await app.request(`/api/accounts/${scenario.account.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: 'New description' }),
      }, getEnv())

      const db = getDb()
      const logs = await db.select().from(schema.auditLogs).where(
        eq(schema.auditLogs.entityId, scenario.account.id)
      )

      expect(logs.some(l => l.action === 'UPDATE')).toBe(true)
    })
  })
})
```

```typescript
// src/server/__integration__/accounts/delete.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createSuperAdmin, createSession, createAccount } from '../fixtures'
import { createTestScenario } from '../fixtures'
import { eq } from 'drizzle-orm'

describe('Delete Account Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('DELETE /api/accounts/:id', () => {
    it('should return 403 for non-super-admin', async () => {
      const { headers, account } = await createTestScenario()

      const res = await app.request(`/api/accounts/${account.id}`, {
        method: 'DELETE',
        headers,
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should soft delete account for super admin', async () => {
      const superAdmin = await createSuperAdmin()
      const sessionId = await createSession(superAdmin.id)
      const account = await createAccount()

      const res = await app.request(`/api/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account.id,
        },
      }, getEnv())

      expect(res.status).toBe(204)

      // Verify soft delete
      const db = getDb()
      const [acc] = await db.select().from(schema.accounts).where(
        eq(schema.accounts.id, account.id)
      )
      expect(acc.deletedAt).not.toBeNull()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:integration -- accounts/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/accounts/
git commit -m "test: add accounts CRUD integration tests"
```

---

## Task 9: Invitations API

**Files:**
- Create: `src/server/__integration__/invitations/create.test.ts`
- Create: `src/server/__integration__/invitations/list.test.ts`
- Create: `src/server/__integration__/invitations/revoke.test.ts`
- Create: `src/server/__integration__/invitations/accept.test.ts`

**Step 1: Write invitation tests**

```typescript
// src/server/__integration__/invitations/create.test.ts
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createMultiUserScenario } from '../fixtures'
import { createUser, addUserToAccount } from '../fixtures'
import { sendInvitationEmail } from '../../lib/email'

describe('Create Invitation Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('POST /api/invitations', () => {
    it('should create invitation and send email', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newinvite@test.com',
          role: 'EDITOR',
        }),
      }, getEnv())

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.invited).toBe(true)
      expect(body.invitation.email).toBe('newinvite@test.com')
      expect(body.invitation.role).toBe('EDITOR')

      // Verify email was sent
      expect(sendInvitationEmail).toHaveBeenCalled()
    })

    it('should link existing user immediately', async () => {
      const scenario = await createMultiUserScenario()
      const existingUser = await createUser({ email: 'existing@test.com' })

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'existing@test.com',
          role: 'VIEWER',
        }),
      }, getEnv())

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.linked).toBe(true)

      // Verify user is now in account
      const db = getDb()
      const [userAccount] = await db.select().from(schema.userAccounts).where(
        eq(schema.userAccounts.userId, existingUser.id)
      )
      expect(userAccount.accountId).toBe(scenario.account.id)
    })

    it('should reject higher role than own', async () => {
      const scenario = await createMultiUserScenario()

      // Manager trying to invite ADMIN
      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.manager.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newadmin@test.com',
          role: 'ADMIN',
        }),
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should reject invitation for existing member', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.admin.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: scenario.viewer.user.email,
          role: 'EDITOR',
        }),
      }, getEnv())

      expect(res.status).toBe(409)
    })
  })
})
```

```typescript
// src/server/__integration__/invitations/list.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv } from '../setup'
import { createMultiUserScenario } from '../fixtures'
import { createInvitation } from '../fixtures'

describe('List Invitations Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /api/invitations', () => {
    it('should return pending invitations', async () => {
      const scenario = await createMultiUserScenario()

      // Create some invitations
      await createInvitation({
        accountId: scenario.account.id,
        invitedById: scenario.admin.user.id,
        email: 'pending1@test.com',
        role: 'VIEWER',
      })
      await createInvitation({
        accountId: scenario.account.id,
        invitedById: scenario.admin.user.id,
        email: 'pending2@test.com',
        role: 'EDITOR',
      })

      const res = await app.request('/api/invitations', {
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.length).toBe(2)
    })

    it('should exclude accepted invitations', async () => {
      const scenario = await createMultiUserScenario()

      await createInvitation({
        accountId: scenario.account.id,
        invitedById: scenario.admin.user.id,
        email: 'pending@test.com',
      })
      await createInvitation({
        accountId: scenario.account.id,
        invitedById: scenario.admin.user.id,
        email: 'accepted@test.com',
        acceptedAt: new Date().toISOString(),
      })

      const res = await app.request('/api/invitations', {
        headers: scenario.admin.headers,
      }, getEnv())

      const body = await res.json()
      expect(body.length).toBe(1)
      expect(body[0].email).toBe('pending@test.com')
    })
  })
})
```

```typescript
// src/server/__integration__/invitations/revoke.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createMultiUserScenario } from '../fixtures'
import { createInvitation } from '../fixtures'
import { eq } from 'drizzle-orm'

describe('Revoke Invitation Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('DELETE /api/invitations/:id', () => {
    it('should revoke pending invitation', async () => {
      const scenario = await createMultiUserScenario()
      const invitation = await createInvitation({
        accountId: scenario.account.id,
        invitedById: scenario.admin.user.id,
      })

      const res = await app.request(`/api/invitations/${invitation.id}`, {
        method: 'DELETE',
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(204)

      // Verify deletion (or mark as revoked)
      const db = getDb()
      const [inv] = await db.select().from(schema.invitations).where(
        eq(schema.invitations.id, invitation.id)
      )
      // Depending on implementation: either deleted or marked revoked
      expect(inv === undefined || inv.acceptedAt !== null).toBe(true)
    })

    it('should return 404 for non-existent invitation', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/invitations/non-existent', {
        method: 'DELETE',
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(404)
    })

    it('should require MANAGER role or higher', async () => {
      const scenario = await createMultiUserScenario()
      const invitation = await createInvitation({
        accountId: scenario.account.id,
        invitedById: scenario.admin.user.id,
      })

      const res = await app.request(`/api/invitations/${invitation.id}`, {
        method: 'DELETE',
        headers: scenario.viewer.headers,
      }, getEnv())

      expect(res.status).toBe(403)
    })
  })
})
```

```typescript
// src/server/__integration__/invitations/accept.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema, createSession } from '../setup'
import { createUser, createAccount, createInvitation, createExpiredInvitation } from '../fixtures'
import { eq, and } from 'drizzle-orm'

describe('Accept Invitation Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('GET /auth/invite/:token', () => {
    it('should add user to account on accept', async () => {
      const inviter = await createUser()
      const account = await createAccount()
      const newUser = await createUser({ email: 'newmember@test.com' })
      const sessionId = await createSession(newUser.id)

      const invitation = await createInvitation({
        accountId: account.id,
        invitedById: inviter.id,
        email: 'newmember@test.com',
        role: 'EDITOR',
      })

      const res = await app.request(`/auth/invite/${invitation.token}`, {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      // Should redirect after accepting
      expect([200, 302]).toContain(res.status)

      // Verify user-account relationship created
      const db = getDb()
      const [userAccount] = await db.select().from(schema.userAccounts).where(
        and(
          eq(schema.userAccounts.userId, newUser.id),
          eq(schema.userAccounts.accountId, account.id)
        )
      )
      expect(userAccount).toBeDefined()
      expect(userAccount.role).toBe('EDITOR')
    })

    it('should return error for expired invitation', async () => {
      const inviter = await createUser()
      const account = await createAccount()
      const newUser = await createUser()
      const sessionId = await createSession(newUser.id)

      const invitation = await createExpiredInvitation({
        accountId: account.id,
        invitedById: inviter.id,
        email: newUser.email,
      })

      const res = await app.request(`/auth/invite/${invitation.token}`, {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      expect([400, 404]).toContain(res.status)
    })

    it('should mark invitation as accepted', async () => {
      const inviter = await createUser()
      const account = await createAccount()
      const newUser = await createUser({ email: 'accepter@test.com' })
      const sessionId = await createSession(newUser.id)

      const invitation = await createInvitation({
        accountId: account.id,
        invitedById: inviter.id,
        email: 'accepter@test.com',
      })

      await app.request(`/auth/invite/${invitation.token}`, {
        headers: { Cookie: `sid=${sessionId}` },
      }, getEnv())

      // Verify invitation marked as accepted
      const db = getDb()
      const [inv] = await db.select().from(schema.invitations).where(
        eq(schema.invitations.id, invitation.id)
      )
      expect(inv.acceptedAt).not.toBeNull()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:integration -- invitations/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/invitations/
git commit -m "test: add invitations integration tests"
```

---

## Task 10: Audit Logs Integration Tests

**Files:**
- Create: `src/server/__integration__/audits/list.test.ts`

**Step 1: Write audit tests**

```typescript
// src/server/__integration__/audits/list.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getDb, schema } from '../setup'
import { createMultiUserScenario, createTestScenario } from '../fixtures'
import { createSuperAdmin, createSession } from '../fixtures'
import { v4 as uuid } from 'uuid'

describe('Audit Logs Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  async function createAuditLog(options: {
    accountId: string
    userId?: string
    entity: string
    entityId: string
    action: string
  }) {
    const db = getDb()
    await db.insert(schema.auditLogs).values({
      id: uuid(),
      transactionId: uuid(),
      accountId: options.accountId,
      userId: options.userId || null,
      entity: options.entity,
      entityId: options.entityId,
      action: options.action,
      timestamp: new Date().toISOString(),
    })
  }

  describe('GET /api/audits', () => {
    it('should return audit logs for account', async () => {
      const scenario = await createMultiUserScenario()

      // Create some audit logs
      await createAuditLog({
        accountId: scenario.account.id,
        userId: scenario.admin.user.id,
        entity: 'user',
        entityId: scenario.viewer.user.id,
        action: 'UPDATE',
      })
      await createAuditLog({
        accountId: scenario.account.id,
        userId: scenario.admin.user.id,
        entity: 'account',
        entityId: scenario.account.id,
        action: 'UPDATE',
      })

      const res = await app.request('/api/audits', {
        headers: scenario.admin.headers,
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.length).toBe(2)
    })

    it('should filter by entity type', async () => {
      const scenario = await createMultiUserScenario()

      await createAuditLog({
        accountId: scenario.account.id,
        entity: 'user',
        entityId: 'user-1',
        action: 'INSERT',
      })
      await createAuditLog({
        accountId: scenario.account.id,
        entity: 'account',
        entityId: 'acc-1',
        action: 'UPDATE',
      })

      const res = await app.request('/api/audits?entity=user', {
        headers: scenario.admin.headers,
      }, getEnv())

      const body = await res.json()
      expect(body.data.every((l: any) => l.entity === 'user')).toBe(true)
    })

    it('should filter by action', async () => {
      const scenario = await createMultiUserScenario()

      await createAuditLog({
        accountId: scenario.account.id,
        entity: 'user',
        entityId: 'u-1',
        action: 'INSERT',
      })
      await createAuditLog({
        accountId: scenario.account.id,
        entity: 'user',
        entityId: 'u-2',
        action: 'DELETE',
      })

      const res = await app.request('/api/audits?action=DELETE', {
        headers: scenario.admin.headers,
      }, getEnv())

      const body = await res.json()
      expect(body.data.every((l: any) => l.action === 'DELETE')).toBe(true)
    })

    it('should require ADMIN or ANALYTICS role', async () => {
      const scenario = await createMultiUserScenario()

      const res = await app.request('/api/audits', {
        headers: scenario.viewer.headers,
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should only show account-scoped logs (multi-tenancy)', async () => {
      const scenario1 = await createTestScenario()
      const scenario2 = await createTestScenario()

      await createAuditLog({
        accountId: scenario1.account.id,
        entity: 'user',
        entityId: 'u-1',
        action: 'INSERT',
      })
      await createAuditLog({
        accountId: scenario2.account.id,
        entity: 'user',
        entityId: 'u-2',
        action: 'INSERT',
      })

      const res = await app.request('/api/audits', {
        headers: scenario1.headers,
      }, getEnv())

      const body = await res.json()
      expect(body.data.every((l: any) => l.accountId === scenario1.account.id)).toBe(true)
    })

    it('should show all logs for super admin', async () => {
      const superAdmin = await createSuperAdmin()
      const sessionId = await createSession(superAdmin.id)
      const scenario = await createTestScenario()

      await createAuditLog({
        accountId: scenario.account.id,
        entity: 'user',
        entityId: 'u-1',
        action: 'INSERT',
      })

      const res = await app.request('/api/audits', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': 'system',
        },
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.length).toBeGreaterThan(0)
    })

    it('should paginate results', async () => {
      const scenario = await createMultiUserScenario()

      // Create 15 audit logs
      for (let i = 0; i < 15; i++) {
        await createAuditLog({
          accountId: scenario.account.id,
          entity: 'user',
          entityId: `u-${i}`,
          action: 'UPDATE',
        })
      }

      const res = await app.request('/api/audits?page=1&limit=10', {
        headers: scenario.admin.headers,
      }, getEnv())

      const body = await res.json()
      expect(body.data.length).toBe(10)
      expect(body.pagination.total).toBe(15)
      expect(body.pagination.totalPages).toBe(2)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:integration -- audits/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/audits/
git commit -m "test: add audit logs integration tests"
```

---

## Task 11: Authorization - Role Hierarchy Tests

**Files:**
- Create: `src/server/__integration__/authorization/roles.test.ts`

**Step 1: Write role hierarchy tests**

```typescript
// src/server/__integration__/authorization/roles.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, createSession } from '../setup'
import { createUser, createAccount, addUserToAccount } from '../fixtures'

describe('Role Hierarchy Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  const roles = ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER'] as const

  describe('Role-based access to user updates', () => {
    roles.forEach((role) => {
      it(`${role} should have correct update permissions`, async () => {
        const account = await createAccount()
        const user = await createUser()
        const target = await createUser({ name: 'Target User' })

        await addUserToAccount(user.id, account.id, role)
        await addUserToAccount(target.id, account.id, 'VIEWER')

        const sessionId = await createSession(user.id)

        const res = await app.request(`/api/users/${target.id}`, {
          method: 'PATCH',
          headers: {
            Cookie: `sid=${sessionId}`,
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated' }),
        }, getEnv())

        // ADMIN and MANAGER can update, others cannot
        if (['ADMIN', 'MANAGER'].includes(role)) {
          expect(res.status).toBe(200)
        } else {
          expect(res.status).toBe(403)
        }
      })
    })
  })

  describe('Role-based access to user deletion', () => {
    roles.forEach((role) => {
      it(`${role} should have correct delete permissions`, async () => {
        const account = await createAccount()
        const user = await createUser()
        const target = await createUser()

        await addUserToAccount(user.id, account.id, role)
        await addUserToAccount(target.id, account.id, 'VIEWER')

        const sessionId = await createSession(user.id)

        const res = await app.request(`/api/users/${target.id}`, {
          method: 'DELETE',
          headers: {
            Cookie: `sid=${sessionId}`,
            'account-id': account.id,
          },
        }, getEnv())

        // Only ADMIN can delete
        if (role === 'ADMIN') {
          expect(res.status).toBe(204)
        } else {
          expect(res.status).toBe(403)
        }
      })
    })
  })

  describe('Role-based access to invitations', () => {
    roles.forEach((role) => {
      it(`${role} should have correct invitation permissions`, async () => {
        const account = await createAccount()
        const user = await createUser()

        await addUserToAccount(user.id, account.id, role)

        const sessionId = await createSession(user.id)

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            Cookie: `sid=${sessionId}`,
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'newinvite@test.com',
            role: 'VIEWER',
          }),
        }, getEnv())

        // ADMIN and MANAGER can invite, others cannot
        if (['ADMIN', 'MANAGER'].includes(role)) {
          expect(res.status).toBe(201)
        } else {
          expect(res.status).toBe(403)
        }
      })
    })
  })

  describe('Special roles', () => {
    it('BILLING role should access only billing endpoints', async () => {
      const account = await createAccount()
      const user = await createUser()

      await addUserToAccount(user.id, account.id, 'BILLING')

      const sessionId = await createSession(user.id)

      // Should not be able to access users
      const usersRes = await app.request('/api/users', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account.id,
        },
      }, getEnv())

      expect(usersRes.status).toBe(403)
    })

    it('ANALYTICS role should access audit logs', async () => {
      const account = await createAccount()
      const user = await createUser()

      await addUserToAccount(user.id, account.id, 'ANALYTICS')

      const sessionId = await createSession(user.id)

      const res = await app.request('/api/audits', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account.id,
        },
      }, getEnv())

      expect(res.status).toBe(200)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:integration -- authorization/roles`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/authorization/roles.test.ts
git commit -m "test: add role hierarchy integration tests"
```

---

## Task 12: Multi-Tenancy Isolation Tests

**Files:**
- Create: `src/server/__integration__/authorization/multi-tenancy.test.ts`

**Step 1: Write multi-tenancy tests**

```typescript
// src/server/__integration__/authorization/multi-tenancy.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, createSession } from '../setup'
import { createUser, createAccount, addUserToAccount, createInvitation } from '../fixtures'

describe('Multi-Tenancy Isolation Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('User isolation between accounts', () => {
    it('should not list users from other accounts', async () => {
      const account1 = await createAccount({ name: 'Account 1' })
      const account2 = await createAccount({ name: 'Account 2' })

      const user1 = await createUser({ name: 'User in Account 1' })
      const user2 = await createUser({ name: 'User in Account 2' })
      const admin = await createUser({ name: 'Admin' })

      await addUserToAccount(user1.id, account1.id, 'VIEWER')
      await addUserToAccount(user2.id, account2.id, 'VIEWER')
      await addUserToAccount(admin.id, account1.id, 'ADMIN')

      const sessionId = await createSession(admin.id)

      const res = await app.request('/api/users', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account1.id,
        },
      }, getEnv())

      const body = await res.json()
      const userNames = body.data.map((u: any) => u.name)

      expect(userNames).toContain('User in Account 1')
      expect(userNames).toContain('Admin')
      expect(userNames).not.toContain('User in Account 2')
    })

    it('should not access user from other account by ID', async () => {
      const account1 = await createAccount()
      const account2 = await createAccount()

      const admin = await createUser()
      const otherUser = await createUser()

      await addUserToAccount(admin.id, account1.id, 'ADMIN')
      await addUserToAccount(otherUser.id, account2.id, 'VIEWER')

      const sessionId = await createSession(admin.id)

      const res = await app.request(`/api/users/${otherUser.id}`, {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account1.id,
        },
      }, getEnv())

      expect(res.status).toBe(404)
    })

    it('should not update user from other account', async () => {
      const account1 = await createAccount()
      const account2 = await createAccount()

      const admin = await createUser()
      const otherUser = await createUser()

      await addUserToAccount(admin.id, account1.id, 'ADMIN')
      await addUserToAccount(otherUser.id, account2.id, 'VIEWER')

      const sessionId = await createSession(admin.id)

      const res = await app.request(`/api/users/${otherUser.id}`, {
        method: 'PATCH',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account1.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hacked!' }),
      }, getEnv())

      expect(res.status).toBe(404)
    })
  })

  describe('Invitation isolation between accounts', () => {
    it('should not list invitations from other accounts', async () => {
      const account1 = await createAccount()
      const account2 = await createAccount()

      const admin1 = await createUser()
      const admin2 = await createUser()

      await addUserToAccount(admin1.id, account1.id, 'ADMIN')
      await addUserToAccount(admin2.id, account2.id, 'ADMIN')

      await createInvitation({
        accountId: account1.id,
        invitedById: admin1.id,
        email: 'invite1@test.com',
      })
      await createInvitation({
        accountId: account2.id,
        invitedById: admin2.id,
        email: 'invite2@test.com',
      })

      const sessionId = await createSession(admin1.id)

      const res = await app.request('/api/invitations', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account1.id,
        },
      }, getEnv())

      const body = await res.json()
      const emails = body.map((i: any) => i.email)

      expect(emails).toContain('invite1@test.com')
      expect(emails).not.toContain('invite2@test.com')
    })

    it('should not revoke invitation from other account', async () => {
      const account1 = await createAccount()
      const account2 = await createAccount()

      const admin1 = await createUser()
      const admin2 = await createUser()

      await addUserToAccount(admin1.id, account1.id, 'ADMIN')
      await addUserToAccount(admin2.id, account2.id, 'ADMIN')

      const invitation2 = await createInvitation({
        accountId: account2.id,
        invitedById: admin2.id,
      })

      const sessionId = await createSession(admin1.id)

      const res = await app.request(`/api/invitations/${invitation2.id}`, {
        method: 'DELETE',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account1.id,
        },
      }, getEnv())

      expect(res.status).toBe(404)
    })
  })

  describe('Audit log isolation', () => {
    it('should only show audit logs from own account', async () => {
      const account1 = await createAccount()
      const account2 = await createAccount()

      const admin = await createUser()
      await addUserToAccount(admin.id, account1.id, 'ADMIN')
      await addUserToAccount(admin.id, account2.id, 'ADMIN')

      const sessionId = await createSession(admin.id)

      // Generate audit log in account1 by updating something
      await app.request(`/api/accounts/${account1.id}`, {
        method: 'PATCH',
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account1.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Account 1' }),
      }, getEnv())

      // Query audits from account2 context
      const res = await app.request('/api/audits', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account2.id,
        },
      }, getEnv())

      const body = await res.json()
      const accountIds = body.data.map((l: any) => l.accountId)

      expect(accountIds).not.toContain(account1.id)
    })
  })

  describe('Account access validation', () => {
    it('should return 403 when accessing account user is not member of', async () => {
      const account1 = await createAccount()
      const account2 = await createAccount()

      const user = await createUser()
      await addUserToAccount(user.id, account1.id, 'ADMIN')
      // User is NOT in account2

      const sessionId = await createSession(user.id)

      const res = await app.request('/api/users', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account2.id,
        },
      }, getEnv())

      expect(res.status).toBe(403)
    })

    it('should allow super admin to access any account', async () => {
      const account = await createAccount()
      const superAdmin = await createUser({ isSuperAdmin: true })
      // Super admin is NOT explicitly in account

      const sessionId = await createSession(superAdmin.id)

      const res = await app.request('/api/users', {
        headers: {
          Cookie: `sid=${sessionId}`,
          'account-id': account.id,
        },
      }, getEnv())

      expect(res.status).toBe(200)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:integration -- authorization/multi-tenancy`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/authorization/multi-tenancy.test.ts
git commit -m "test: add multi-tenancy isolation integration tests"
```

---

## Task 13: Storage Integration Tests

**Files:**
- Create: `src/server/__integration__/storage/upload.test.ts`
- Create: `src/server/__integration__/storage/delete.test.ts`

**Step 1: Write storage tests**

```typescript
// src/server/__integration__/storage/upload.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getR2 } from '../setup'
import { createTestScenario } from '../fixtures'

describe('Storage Upload Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('POST /api/storage/upload-url', () => {
    it('should generate presigned upload URL', async () => {
      const { headers } = await createTestScenario()

      const res = await app.request('/api/storage/upload-url', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test-file.pdf',
          contentType: 'application/pdf',
        }),
      }, getEnv())

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.uploadUrl).toBeDefined()
      expect(body.key).toBeDefined()
      expect(body.expiresAt).toBeDefined()
    })

    it('should include account ID in storage key', async () => {
      const { headers, account } = await createTestScenario()

      const res = await app.request('/api/storage/upload-url', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      }, getEnv())

      const body = await res.json()
      expect(body.key).toContain(account.id)
    })
  })

  describe('PUT /api/storage/upload/:key', () => {
    it('should upload file to R2', async () => {
      const { headers } = await createTestScenario()

      const fileContent = 'Test file content'
      const key = 'test-upload-key.txt'

      const res = await app.request(`/api/storage/upload/${key}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'text/plain',
        },
        body: fileContent,
      }, getEnv())

      expect(res.status).toBe(201)

      // Verify file in R2
      const r2 = getR2()
      const obj = await r2.get(key)
      expect(obj).not.toBeNull()
      expect(await obj?.text()).toBe(fileContent)
    })
  })
})
```

```typescript
// src/server/__integration__/storage/delete.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestApp, getEnv, getR2 } from '../setup'
import { createTestScenario } from '../fixtures'

describe('Storage Delete Integration', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(() => {
    app = createTestApp()
  })

  describe('DELETE /api/storage/:key', () => {
    it('should delete file from R2', async () => {
      const { headers } = await createTestScenario()
      const r2 = getR2()

      // First upload a file
      const key = 'file-to-delete.txt'
      await r2.put(key, 'content to delete')

      // Verify it exists
      expect(await r2.get(key)).not.toBeNull()

      // Delete it
      const res = await app.request(`/api/storage/${key}`, {
        method: 'DELETE',
        headers,
      }, getEnv())

      expect(res.status).toBe(204)

      // Verify it's gone
      expect(await r2.get(key)).toBeNull()
    })

    it('should return 404 for non-existent file', async () => {
      const { headers } = await createTestScenario()

      const res = await app.request('/api/storage/non-existent-file.txt', {
        method: 'DELETE',
        headers,
      }, getEnv())

      expect(res.status).toBe(404)
    })

    it('should prevent deletion of files from other accounts', async () => {
      const scenario1 = await createTestScenario()
      const scenario2 = await createTestScenario()
      const r2 = getR2()

      // Upload file with account1's context
      const key = `${scenario1.account.id}/private-file.txt`
      await r2.put(key, 'private content')

      // Try to delete with account2's headers
      const res = await app.request(`/api/storage/${key}`, {
        method: 'DELETE',
        headers: scenario2.headers,
      }, getEnv())

      expect([403, 404]).toContain(res.status)

      // Verify file still exists
      expect(await r2.get(key)).not.toBeNull()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:integration -- storage/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/__integration__/storage/
git commit -m "test: add storage integration tests"
```

---

## Task 14: Run Full Integration Test Suite

**Step 1: Run all integration tests**

Run: `npm run test:integration`
Expected: All tests pass

**Step 2: Generate coverage report**

Run: `npm run test:integration -- --coverage`
Expected: Coverage report generated

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "test: complete integration test suite"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Infrastructure setup | `setup.ts`, `vitest.config.ts`, `package.json` |
| 2 | Test fixtures | `fixtures/*.ts` |
| 3 | Health check tests | `health/health.test.ts` |
| 4 | Session tests | `auth/session.test.ts` |
| 5 | Logout tests | `auth/logout.test.ts` |
| 6 | List users tests | `users/list.test.ts` |
| 7 | Users CRUD tests | `users/*.test.ts` |
| 8 | Accounts CRUD tests | `accounts/*.test.ts` |
| 9 | Invitations tests | `invitations/*.test.ts` |
| 10 | Audit logs tests | `audits/list.test.ts` |
| 11 | Role hierarchy tests | `authorization/roles.test.ts` |
| 12 | Multi-tenancy tests | `authorization/multi-tenancy.test.ts` |
| 13 | Storage tests | `storage/*.test.ts` |
| 14 | Full suite run | N/A |

## Test Coverage Matrix

| Feature | Unit | Integration | E2E |
|---------|------|-------------|-----|
| Health Check | - | ✓ | ✓ |
| Google OAuth | ✓ (mocked) | ✓ (mocked) | Manual |
| Session Management | ✓ | ✓ | ✓ |
| Users CRUD | ✓ | ✓ | ✓ |
| Accounts CRUD | ✓ | ✓ | ✓ |
| Invitations | ✓ | ✓ | ✓ |
| Audit Logging | ✓ | ✓ | - |
| Storage (R2) | ✓ | ✓ | Manual |
| Role Hierarchy | ✓ | ✓ | - |
| Multi-Tenancy | ✓ | ✓ | ✓ |
| Permissions | ✓ | ✓ | - |

## Dependencies Added

```json
{
  "devDependencies": {
    "better-sqlite3": "^11.0.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```
