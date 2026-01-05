# Testing Guide - Vitest and Playwright

Complete guide to testing strategies using Vitest for unit/integration tests and Playwright for E2E.

> **⚠️ FOR E2E/PLAYWRIGHT TESTS**: Use the **`playwright-e2e-testing`** skill instead!
> Run `/playwright-e2e-testing` for writing, debugging, or running E2E tests.
> This guide covers unit and integration tests only.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [E2E Tests](#e2e-tests)
- [Test Fixtures](#test-fixtures)
- [Mocking Strategies](#mocking-strategies)
- [Coverage Targets](#coverage-targets)
- [Test Commands](#test-commands)

---

## Overview

### Testing Stack

| Type | Framework | Location | Run |
|------|-----------|----------|-----|
| Unit | Vitest | `tests/unit/` | `pnpm test` |
| Integration | Vitest | `tests/integration/` | `pnpm test:integration` |
| E2E | Playwright | `tests/e2e/` | `pnpm test:e2e` |

### Test Pyramid

```
           ┌─────┐
           │ E2E │  ~40 tests (user journeys)
          ─┴─────┴─
         ┌─────────┐
         │Integration│  ~80 tests (API + DB)
        ─┴───────────┴─
       ┌───────────────┐
       │    Unit       │  ~200 tests (logic)
       └───────────────┘
```

---

## Test Structure

### Directory Layout

```
tests/
├── unit/
│   ├── server/
│   │   ├── auth/           # Guard and role tests
│   │   ├── lib/            # Utility tests
│   │   ├── middleware/     # Middleware tests
│   │   ├── routes/         # Handler tests
│   │   │   └── users/
│   │   │       └── handlers.test.ts
│   │   └── services/       # Service tests
│   │       └── users.test.ts
│   └── shared/
│       └── schemas.test.ts
│
├── integration/
│   ├── setup.ts            # D1/KV/R2 mocks
│   ├── fixtures.ts         # Data seeding
│   ├── vitest.config.ts    # Config
│   ├── auth/               # Auth flow tests
│   ├── users/              # User API tests
│   └── security/           # Security tests
│
├── e2e/
│   ├── auth.setup.ts       # Auth setup project
│   ├── fixtures.ts         # Custom fixtures
│   ├── journeys/           # User journey tests
│   ├── crud/               # CRUD tests
│   ├── api/                # API tests
│   ├── a11y/               # Accessibility tests
│   ├── visual/             # Visual regression
│   └── mobile/             # Responsive tests
│
└── fixtures/
    └── server.ts           # Shared fixtures
```

---

## Unit Tests

### Basic Structure

```typescript
// tests/unit/server/services/users.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { usersService } from '@server/services/users'
import { NotFoundError } from '@server/lib/errors'
import type { ServiceContext } from '@server/types'
import { createUserFixture, createSuperAdminFixture } from '@tests/fixtures/server'

// Mock dependencies
vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  toStringValue: (v: unknown) => String(v ?? ''),
}))

import { queryOne, queryAll } from '@server/db/sql'

describe('usersService', () => {
  let ctx: ServiceContext
  const db = {} as D1Database

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = createMockContext()
  })

  describe('findById', () => {
    it('should throw NotFound when user missing', async () => {
      ;(queryOne as Mock).mockResolvedValueOnce(null)

      await expect(usersService.findById(db, ctx, 'missing')).rejects.toThrow(NotFoundError)
    })

    it('should return user when found', async () => {
      const user = createUserFixture({ id: 'user-1' })
      ;(queryOne as Mock).mockResolvedValueOnce(user)

      const result = await usersService.findById(db, ctx, user.id)

      expect(result.id).toBe(user.id)
    })
  })
})
```

### ServiceContext Mock

```typescript
function createMockContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
  const user = createUserFixture({
    id: 'ctx-user-123',
    email: 'context@example.com',
  })

  return {
    accountId: 'account-123',
    user,
    userRole: 'ADMIN',
    transactionId: 'tx-123',
    ip: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  }
}
```

### Handler Tests

```typescript
// tests/unit/server/routes/users/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import { createUserFixture } from '@tests/fixtures/server'

vi.mock('@server/services/users', () => ({
  usersService: {
    findById: vi.fn(),
    findAll: vi.fn(),
  },
}))

import { usersService } from '@server/services/users'

describe('User Handlers', () => {
  let app: Hono<HonoEnv>

  beforeEach(() => {
    vi.clearAllMocks()
    app = createTestApp()
  })

  describe('GET /users/:id', () => {
    it('should return user data', async () => {
      const user = createUserFixture({ id: 'user-1' })
      vi.mocked(usersService.findById).mockResolvedValueOnce(user)

      const res = await app.request('/api/users/user-1', {
        headers: createAuthHeaders(),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe('user-1')
    })
  })
})
```

---

## Integration Tests

### Setup File

The integration setup creates:
- In-memory SQLite database (D1-compatible)
- Mock KV store for sessions
- Mock R2 bucket for storage
- Mocked external services (Google OAuth, SendGrid)

```typescript
// tests/integration/setup.ts - provides:
export function getEnv(): TestEnv
export function getDb(): D1Database
export function getSqlite(): Database.Database
export function getKV(): MockKVStore
export function getR2(): MockR2Store
export async function createSession(userId: string, data?: Partial<SessionData>)
export async function clearDatabase(): Promise<void>
export async function seedUser(userData: {...})
export async function seedAccount(accountData: {...})
export async function seedUserAccount(data: {...})
```

### Integration Test Example

```typescript
// tests/integration/users/crud.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import { createTestScenario, createUser, addUserToAccount } from '../fixtures'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import type { HonoEnv } from '../../../src/server/types'

describe('Users CRUD Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    app.onError(errorHandler)

    // Inject test environment
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      c.set('db', getDb())
      c.set('transactionId', crypto.randomUUID())
      await next()
    })

    app.route('/api', api)
  })

  describe('GET /api/users/:id', () => {
    it('should return 401 without session', async () => {
      const res = await app.request(`/api/users/${crypto.randomUUID()}`)

      expect(res.status).toBe(401)
    })

    it('should return 200 for authorized request', async () => {
      const scenario = await createTestScenario({
        userName: 'Test User',
        userEmail: 'test@example.com',
        role: 'VIEWER',
      })

      const res = await app.request(`/api/users/${scenario.user.id}`, {
        headers: {
          ...scenario.headers,
          'account-id': scenario.account.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(scenario.user.id)
    })
  })
})
```

### Fixtures Helper

```typescript
// tests/integration/fixtures.ts
import { getKV, seedUser, seedAccount, seedUserAccount } from './setup'

export async function createTestScenario(options: {
  userName: string
  userEmail: string
  role: Role
}) {
  const user = await seedUser({
    email: options.userEmail,
    name: options.userName,
  })

  const account = await seedAccount({
    name: 'Test Account',
  })

  await seedUserAccount({
    userId: user.id,
    accountId: account.id,
    role: options.role,
  })

  const { sessionId } = await createSession(user.id, {
    email: user.email,
    name: user.name,
  })

  return {
    user,
    account,
    sessionId,
    headers: {
      Cookie: `sid=${sessionId}`,
    },
  }
}
```

---

## E2E Tests

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,

  projects: [
    // Auth setup (runs first)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Main tests (depend on setup)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.unauth\.spec\.ts/],
      grepInvert: /@visual|@a11y|@mobile/,
    },

    // Unauthenticated tests
    {
      name: 'chromium-unauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.unauth\.spec\.ts/,
    },

    // Visual regression
    {
      name: 'visual',
      grep: /@visual/,
      dependencies: ['setup'],
    },

    // Accessibility
    {
      name: 'a11y',
      grep: /@a11y/,
      dependencies: ['setup'],
    },

    // Mobile
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grep: /@mobile/,
    },
  ],
})
```

### Auth Setup

```typescript
// tests/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')
const accountFile = path.join(__dirname, '.auth/account.json')

setup('authenticate', async ({ page, context }) => {
  // Use test-login endpoint in development
  const response = await page.request.post('/auth/test-login', {
    data: {
      email: 'e2e-test@example.com',
      name: 'E2E Test User',
    },
  })

  if (!response.ok()) {
    console.log('Test login failed - running unauthenticated')
    await context.storageState({ path: authFile })
    return
  }

  // Save accountId for API tests
  const { accountId } = await response.json()
  if (accountId) {
    fs.writeFileSync(accountFile, JSON.stringify({ accountId }))
  }

  // Verify authentication
  const meResponse = await page.request.get('/auth/me')
  expect(meResponse.ok()).toBeTruthy()

  // Navigate to protected route
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/login/)

  // Save authenticated state
  await context.storageState({ path: authFile })
})
```

### Custom Fixtures

```typescript
// tests/e2e/fixtures.ts
import { test as base, expect } from '@playwright/test'
import * as fs from 'fs'

type CustomFixtures = {
  authedPage: Page
  accountId: string | null
  api: {
    get: (url: string) => Promise<Response>
    post: (url: string, data?: unknown) => Promise<Response>
    patch: (url: string, data?: unknown) => Promise<Response>
    delete: (url: string) => Promise<Response>
  }
}

export const test = base.extend<CustomFixtures>({
  // Verified authenticated page
  authedPage: async ({ page }, use) => {
    await page.goto('/dashboard')
    if (page.url().includes('/login')) {
      throw new Error('Authentication failed')
    }
    await use(page)
  },

  // Account ID from setup
  accountId: async ({}, use) => {
    const file = './tests/e2e/.auth/account.json'
    const data = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf-8'))
      : null
    await use(data?.accountId ?? null)
  },

  // API helper with account-id header
  api: async ({ request, accountId }, use) => {
    const headers = accountId ? { 'account-id': accountId } : {}
    await use({
      get: (url) => request.get(url, { headers }),
      post: (url, data) => request.post(url, { data, headers }),
      patch: (url, data) => request.patch(url, { data, headers }),
      delete: (url) => request.delete(url, { headers }),
    })
  },
})

export { expect }
```

### E2E Test Example

```typescript
// tests/e2e/journeys/critical-flows.spec.ts
import { test, expect, isAuthenticated, waitForNavigation } from '../fixtures'

test.describe('Critical User Journeys @critical', () => {
  test.describe('Authenticated Journeys', () => {
    test.beforeEach(async ({ page }) => {
      const authenticated = await isAuthenticated(page)
      test.skip(!authenticated, 'No authenticated session')
    })

    test('should navigate dashboard to settings', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).not.toHaveURL(/login/)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await settingsLink.click()

      await waitForNavigation(page, '/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    })

    test('should complete team invitation flow', async ({ page }) => {
      await page.goto('/team')

      // Open invite dialog
      await page.getByRole('button', { name: 'Invite Member' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Fill email
      await page.getByLabel(/email/i).fill('newmember@example.com')

      // Select role
      await page.getByRole('button', { name: /^admin$/i }).click()

      // Verify button enabled
      await expect(page.getByRole('button', { name: /send invitation/i })).toBeEnabled()

      // Cancel (avoid test data pollution)
      await page.getByRole('button', { name: /cancel/i }).click()
    })
  })
})
```

### Test Tags

| Tag | Purpose | Project |
|-----|---------|---------|
| `@critical` | Must-pass flows | chromium, firefox |
| `@visual` | Visual regression | visual |
| `@a11y` | Accessibility | a11y |
| `@mobile` | Responsive tests | mobile-chrome |
| `.unauth.spec.ts` | No auth required | chromium-unauth |

---

## Test Fixtures

### Server Fixtures

```typescript
// tests/fixtures/server.ts
import type { User, Account, SessionData } from '@server/types'
import type { Role } from '@server/auth/roles'

export function createUserFixture(options: UserFixtureOptions = {}): User {
  const id = options.id ?? generateTestId()
  return {
    id,
    email: options.email ?? `user-${id}@example.com`,
    name: options.name ?? `Test User ${id}`,
    avatarUrl: options.avatarUrl ?? null,
    status: options.status ?? 'active',
    providerIds: options.providerIds ?? ['google'],
    isSuperAdmin: options.isSuperAdmin ?? false,
    createdAt: options.createdAt ?? new Date().toISOString(),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    deletedAt: options.deletedAt ?? null,
  }
}

export function createSuperAdminFixture(options = {}): User {
  return createUserFixture({ isSuperAdmin: true, ...options })
}

export function createAccountFixture(options: AccountFixtureOptions = {}): Account {
  const id = options.id ?? generateTestId()
  return {
    id,
    name: options.name ?? `Test Account ${id}`,
    description: options.description ?? 'Test account',
    domain: options.domain ?? null,
    createdAt: options.createdAt ?? new Date().toISOString(),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    deletedAt: options.deletedAt ?? null,
  }
}

export function createSessionFixture(options = {}): SessionData {
  const userId = options.userId ?? generateTestId()
  return {
    userId,
    email: options.email ?? `session-${userId}@example.com`,
    name: options.name ?? `Session User`,
    avatarUrl: options.avatarUrl ?? null,
    isSuperAdmin: options.isSuperAdmin ?? false,
    fingerprint: options.fingerprint ?? {
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
    },
  }
}
```

### Database Record Fixtures

```typescript
// For mocking D1 responses
export function createUserRecord(options = {}): Record<string, unknown> {
  const user = createUserFixture(options)
  return {
    id: user.id,
    google_id: `google-${user.id}`,
    email: user.email,
    name: user.name,
    avatar_url: user.avatarUrl,
    status: user.status,
    provider_ids: JSON.stringify(user.providerIds),
    is_super_admin: user.isSuperAdmin ? 1 : 0,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    deleted_at: user.deletedAt,
  }
}
```

---

## Mocking Strategies

### Mock SQL Helpers

```typescript
vi.mock('@server/db/sql', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  executeBatch: vi.fn(),
  toStringValue: (v: unknown) => String(v ?? ''),
  toNullableString: (v: unknown) => v == null ? null : String(v),
}))
```

### Mock Services

```typescript
vi.mock('@server/services/users', () => ({
  usersService: {
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
```

### Mock Audit Helpers

```typescript
vi.mock('@server/lib/audited-db', () => ({
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}))

vi.mock('@server/lib/audit', () => ({
  logAudit: vi.fn(),
}))
```

### Mock External Services

```typescript
// In integration setup - mocks Google OAuth and SendGrid
function createMockedFetch() {
  return vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url

    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({
        access_token: 'mock_token',
        refresh_token: 'mock_refresh',
      }))
    }

    if (url.includes('api.sendgrid.com')) {
      return new Response(null, { status: 202 })
    }

    return originalFetch(input)
  })
}
```

---

## Coverage Targets

### Thresholds

| Type | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| Unit (Server) | 85% | 80% | 85% | 85% |
| Integration | 90% | 80% | 90% | 90% |

### Coverage Commands

```bash
# Unit test coverage
pnpm test:coverage

# Integration coverage
pnpm test:integration:coverage

# E2E coverage (Istanbul instrumentation)
E2E_COVERAGE=true pnpm test:e2e
```

### Coverage Reports

Reports generated in:
- `.test-output/coverage/unit-server/`
- `.test-output/coverage/integration/`
- `.test-output/coverage/e2e/`

---

## Test Commands

### Unit Tests

```bash
pnpm test              # Watch mode
pnpm test:run          # Single run
pnpm test:coverage     # With coverage
```

### Integration Tests

```bash
pnpm test:integration              # Run all
pnpm test:integration -- auth      # Filter by path
pnpm test:integration:coverage     # With coverage
```

### E2E Tests

```bash
pnpm test:e2e                      # Run all
pnpm test:e2e:ui                   # Interactive UI
pnpm test:e2e -- --grep @critical  # Filter by tag
pnpm test:e2e -- --project=visual  # Specific project
```

### Debug E2E

```bash
# Run with browser visible
HEADED=true pnpm test:e2e

# Debug single test
pnpm test:e2e -- --debug

# Run specific test file
pnpm test:e2e -- tests/e2e/journeys/critical-flows.spec.ts
```

---

## Common Patterns

### Testing Guards

```typescript
describe('requireRole guard', () => {
  it('should allow user with sufficient role', async () => {
    const ctx = createMockContext({ userRole: 'ADMIN' })
    // Test passes through middleware
  })

  it('should reject user with insufficient role', async () => {
    const ctx = createMockContext({ userRole: 'VIEWER' })
    // Test throws 403
  })
})
```

### Testing Error Handling

```typescript
it('should handle not found error', async () => {
  ;(queryOne as Mock).mockResolvedValueOnce(null)

  await expect(service.findById(db, ctx, 'missing'))
    .rejects.toThrow(NotFoundError)
})

it('should handle validation error', async () => {
  const res = await app.request('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid' }),
  })

  expect(res.status).toBe(400)
  const body = await res.json()
  expect(body.error.code).toBe('VALIDATION_ERROR')
})
```

### Testing Pagination

```typescript
it('should return paginated results', async () => {
  ;(queryOne as Mock).mockResolvedValueOnce({ count: 25 })
  ;(queryAll as Mock).mockResolvedValueOnce([/* 10 items */])

  const result = await service.findAll(db, ctx, { page: 1, limit: 10 })

  expect(result.data).toHaveLength(10)
  expect(result.meta.totalItems).toBe(25)
  expect(result.meta.totalPages).toBe(3)
})
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [services-layer.md](services-layer.md) - Service patterns to test
- [error-handling.md](error-handling.md) - Error patterns
- [auth-and-guards.md](auth-and-guards.md) - Guards to test
