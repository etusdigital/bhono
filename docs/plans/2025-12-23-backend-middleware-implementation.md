# Backend Middleware Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 middleware features: Global Error Handler, Transaction Support, Request Logger, and Configurable CORS.

**Architecture:** Each feature is a standalone module following Hono's middleware patterns. Error classes get codes, new middleware files are created, and index.ts integrates everything.

**Tech Stack:** Hono, Drizzle ORM, Cloudflare Workers, TypeScript

---

## Task 1: Add Error Codes to Error Classes

**Files:**
- Modify: `src/server/lib/errors.ts`
- Test: `src/server/lib/errors.test.ts` (create)

**Step 1: Write the failing tests**

Create `src/server/lib/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
  getErrorCode,
} from './errors'

describe('Error Classes', () => {
  describe('getErrorCode', () => {
    it('returns VALIDATION_ERROR for ValidationError', () => {
      const error = new ValidationError('Invalid input')
      expect(getErrorCode(error)).toBe('VALIDATION_ERROR')
    })

    it('returns UNAUTHORIZED for UnauthorizedError', () => {
      const error = new UnauthorizedError()
      expect(getErrorCode(error)).toBe('UNAUTHORIZED')
    })

    it('returns FORBIDDEN for ForbiddenError', () => {
      const error = new ForbiddenError()
      expect(getErrorCode(error)).toBe('FORBIDDEN')
    })

    it('returns NOT_FOUND for NotFoundError', () => {
      const error = new NotFoundError('User')
      expect(getErrorCode(error)).toBe('NOT_FOUND')
    })

    it('returns CONFLICT for ConflictError', () => {
      const error = new ConflictError()
      expect(getErrorCode(error)).toBe('CONFLICT')
    })

    it('returns INTERNAL_ERROR for InternalError', () => {
      const error = new InternalError()
      expect(getErrorCode(error)).toBe('INTERNAL_ERROR')
    })

    it('returns INTERNAL_ERROR for unknown errors', () => {
      const error = new Error('Unknown')
      expect(getErrorCode(error)).toBe('INTERNAL_ERROR')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/lib/errors.test.ts`
Expected: FAIL - getErrorCode not exported

**Step 3: Add error codes to errors.ts**

Modify `src/server/lib/errors.ts`:

```typescript
import { HTTPException } from 'hono/http-exception'

// Error codes for each error type
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export class ValidationError extends HTTPException {
  readonly code = ERROR_CODES.VALIDATION_ERROR
  constructor(message: string, details?: unknown) {
    super(400, { message, cause: details })
  }
}

export class UnauthorizedError extends HTTPException {
  readonly code = ERROR_CODES.UNAUTHORIZED
  constructor(message = 'Unauthorized') {
    super(401, { message })
  }
}

export class ForbiddenError extends HTTPException {
  readonly code = ERROR_CODES.FORBIDDEN
  constructor(message = 'Forbidden') {
    super(403, { message })
  }
}

export class NotFoundError extends HTTPException {
  readonly code = ERROR_CODES.NOT_FOUND
  constructor(resource = 'Resource') {
    super(404, { message: `${resource} not found` })
  }
}

export class ConflictError extends HTTPException {
  readonly code = ERROR_CODES.CONFLICT
  constructor(message = 'Resource already exists') {
    super(409, { message })
  }
}

export class InternalError extends HTTPException {
  readonly code = ERROR_CODES.INTERNAL_ERROR
  constructor(message = 'Internal server error') {
    super(500, { message })
  }
}

// Helper to get error code from any error
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof ValidationError) return ERROR_CODES.VALIDATION_ERROR
  if (error instanceof UnauthorizedError) return ERROR_CODES.UNAUTHORIZED
  if (error instanceof ForbiddenError) return ERROR_CODES.FORBIDDEN
  if (error instanceof NotFoundError) return ERROR_CODES.NOT_FOUND
  if (error instanceof ConflictError) return ERROR_CODES.CONFLICT
  if (error instanceof InternalError) return ERROR_CODES.INTERNAL_ERROR
  return ERROR_CODES.INTERNAL_ERROR
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/lib/errors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/lib/errors.ts src/server/lib/errors.test.ts
git commit -m "feat: add error codes to error classes"
```

---

## Task 2: Create Global Error Handler

**Files:**
- Create: `src/server/middleware/error-handler.ts`
- Test: `src/server/middleware/error-handler.test.ts`

**Step 1: Write the failing tests**

Create `src/server/middleware/error-handler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from './error-handler'
import { ValidationError, NotFoundError, InternalError } from '../lib/errors'

describe('errorHandler', () => {
  const createApp = () => {
    const app = new Hono()
    app.onError(errorHandler)
    return app
  }

  it('handles ValidationError with correct format', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new ValidationError('Invalid email', { field: 'email' })
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('Invalid email')
    expect(body.error.status).toBe(400)
    expect(body.error.timestamp).toBeDefined()
    expect(body.error.details).toEqual({ field: 'email' })
  })

  it('handles NotFoundError', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new NotFoundError('User')
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('User not found')
  })

  it('handles unknown errors as INTERNAL_ERROR', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new Error('Something went wrong')
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('Internal server error')
  })

  it('includes timestamp in ISO format', async () => {
    const app = createApp()
    app.get('/test', () => {
      throw new NotFoundError('Resource')
    })

    const res = await app.request('/test')
    const body = await res.json()

    expect(() => new Date(body.error.timestamp)).not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/middleware/error-handler.test.ts`
Expected: FAIL - module not found

**Step 3: Create error handler middleware**

Create `src/server/middleware/error-handler.ts`:

```typescript
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getErrorCode, type ErrorCode } from '../lib/errors'

interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    status: number
    timestamp: string
    details?: unknown
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  const message = err instanceof HTTPException ? err.message : 'Internal server error'
  const code = getErrorCode(err)
  const details = err instanceof HTTPException ? err.cause : undefined

  const response: ErrorResponse = {
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(details !== undefined && { details }),
    },
  }

  return c.json(response, status)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/middleware/error-handler.test.ts`
Expected: PASS

**Step 5: Export from middleware index**

Modify `src/server/middleware/index.ts`:

```typescript
export { requestContext } from './request-context'
export { jwtAuth } from './auth'
export { accountMiddleware } from './account'
export { errorHandler } from './error-handler'
```

**Step 6: Commit**

```bash
git add src/server/middleware/error-handler.ts src/server/middleware/error-handler.test.ts src/server/middleware/index.ts
git commit -m "feat: add global error handler middleware"
```

---

## Task 3: Create Transaction Wrapper

**Files:**
- Create: `src/server/lib/transaction.ts`
- Test: `src/server/lib/transaction.test.ts`

**Step 1: Write the failing tests**

Create `src/server/lib/transaction.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { withTransaction } from './transaction'

describe('withTransaction', () => {
  it('returns result from successful callback', async () => {
    const mockTx = { insert: vi.fn(), update: vi.fn() }
    const mockDb = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    }

    const result = await withTransaction(mockDb as any, async (tx) => {
      return { id: '123', name: 'Test' }
    })

    expect(result).toEqual({ id: '123', name: 'Test' })
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
  })

  it('propagates errors from callback', async () => {
    const mockDb = {
      transaction: vi.fn(async (cb) => cb({})),
    }

    await expect(
      withTransaction(mockDb as any, async () => {
        throw new Error('Database error')
      })
    ).rejects.toThrow('Database error')
  })

  it('passes transaction to callback', async () => {
    const mockTx = { insert: vi.fn(), update: vi.fn() }
    const mockDb = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    }

    let receivedTx: any
    await withTransaction(mockDb as any, async (tx) => {
      receivedTx = tx
      return null
    })

    expect(receivedTx).toBe(mockTx)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/lib/transaction.test.ts`
Expected: FAIL - module not found

**Step 3: Create transaction wrapper**

Create `src/server/lib/transaction.ts`:

```typescript
import type { Database } from '../db/client'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Execute a callback within a database transaction.
 * - Callback succeeds → automatic commit
 * - Callback throws → automatic rollback
 *
 * @example
 * const result = await withTransaction(db, async (tx) => {
 *   const [account] = await tx.insert(accounts).values({ name: 'Acme' }).returning()
 *   const [user] = await tx.insert(users).values({ email: 'admin@acme.com' }).returning()
 *   return { account, user }
 * })
 */
export async function withTransaction<T>(
  db: Database,
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(callback)
}

export type { Transaction }
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/lib/transaction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/lib/transaction.ts src/server/lib/transaction.test.ts
git commit -m "feat: add transaction wrapper for database operations"
```

---

## Task 4: Create Request Logger Middleware

**Files:**
- Create: `src/server/middleware/request-logger.ts`
- Test: `src/server/middleware/request-logger.test.ts`

**Step 1: Write the failing tests**

Create `src/server/middleware/request-logger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { requestLogger } from './request-logger'

describe('requestLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  const createApp = () => {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('transactionId', 'test-tx-id')
      c.set('user', null)
      await next()
    })
    app.use('*', requestLogger())
    return app
  }

  it('logs successful requests with info level', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ ok: true }))

    await app.request('/api/users')

    expect(consoleSpy).toHaveBeenCalled()
    const logArg = consoleSpy.mock.calls[0][0]
    const log = JSON.parse(logArg)

    expect(log.level).toBe('info')
    expect(log.method).toBe('GET')
    expect(log.path).toBe('/api/users')
    expect(log.status).toBe(200)
    expect(log.transactionId).toBe('test-tx-id')
    expect(typeof log.duration).toBe('number')
  })

  it('logs 4xx as warn level', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ error: 'Not found' }, 404))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(log.level).toBe('warn')
    expect(log.status).toBe(404)
  })

  it('logs 5xx as error level', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ error: 'Server error' }, 500))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(log.level).toBe('error')
    expect(log.status).toBe(500)
  })

  it('includes userId when authenticated', async () => {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('transactionId', 'test-tx-id')
      c.set('user', { id: 'user-123' })
      await next()
    })
    app.use('*', requestLogger())
    app.get('/api/users', (c) => c.json({ ok: true }))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(log.userId).toBe('user-123')
  })

  it('includes timestamp in ISO format', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ ok: true }))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(() => new Date(log.timestamp)).not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/middleware/request-logger.test.ts`
Expected: FAIL - module not found

**Step 3: Create request logger middleware**

Create `src/server/middleware/request-logger.ts`:

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types'

interface RequestLog {
  level: 'info' | 'warn' | 'error'
  method: string
  path: string
  status: number
  duration: number
  transactionId: string
  ip: string
  userAgent: string
  userId?: string
  timestamp: string
}

function getLogLevel(status: number): 'info' | 'warn' | 'error' {
  if (status >= 500) return 'error'
  if (status >= 400) return 'warn'
  return 'info'
}

export const requestLogger = () =>
  createMiddleware<HonoEnv>(async (c, next) => {
    const start = Date.now()

    await next()

    const duration = Date.now() - start
    const status = c.res.status
    const user = c.get('user')

    const log: RequestLog = {
      level: getLogLevel(status),
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      transactionId: c.get('transactionId') || 'unknown',
      ip: c.get('ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.get('userAgent') || c.req.header('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    }

    if (user?.id) {
      log.userId = user.id
    }

    console.log(JSON.stringify(log))
  })
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/middleware/request-logger.test.ts`
Expected: PASS

**Step 5: Export from middleware index**

Modify `src/server/middleware/index.ts`:

```typescript
export { requestContext } from './request-context'
export { jwtAuth } from './auth'
export { accountMiddleware } from './account'
export { errorHandler } from './error-handler'
export { requestLogger } from './request-logger'
```

**Step 6: Commit**

```bash
git add src/server/middleware/request-logger.ts src/server/middleware/request-logger.test.ts src/server/middleware/index.ts
git commit -m "feat: add structured JSON request logger middleware"
```

---

## Task 5: Add CORS_ORIGINS to Env

**Files:**
- Modify: `src/server/env.ts`
- Test: `src/server/env.test.ts` (already exists, add test)

**Step 1: Write the failing test**

Add to `src/server/env.test.ts`:

```typescript
describe('getEnv', () => {
  // ... existing tests ...

  it('parses CORS_ORIGINS into array', () => {
    const result = getEnv({
      CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
      // ... other required env vars
    } as any)

    expect(result.CORS_ORIGINS_LIST).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ])
  })

  it('returns empty array when CORS_ORIGINS not set', () => {
    const result = getEnv({
      // ... other required env vars without CORS_ORIGINS
    } as any)

    expect(result.CORS_ORIGINS_LIST).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/env.test.ts`
Expected: FAIL - CORS_ORIGINS_LIST not defined

**Step 3: Add CORS_ORIGINS to env.ts**

Modify `src/server/env.ts`:

```typescript
export interface Env {
  // D1 Database
  DB: D1Database

  // Static Assets
  ASSETS: Fetcher

  // R2 Storage
  R2_BUCKET: R2Bucket
  R2_PUBLIC_URL: string

  // Environment
  ENVIRONMENT: string

  // App URL
  APP_URL: string

  // CORS Origins (comma-separated list)
  CORS_ORIGINS?: string

  // JWT
  JWT_SECRET: string
  JWT_EXPIRY_MINUTES: string

  // Google OAuth
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string

  // Refresh Token
  REFRESH_TOKEN_EXPIRY_DAYS: string

  // SendGrid
  SENDGRID_API_KEY: string
  SENDGRID_FROM_EMAIL: string
}

// Helper to get env with defaults
export function getEnv(env: Env) {
  return {
    ...env,
    JWT_EXPIRY_MINUTES: parseInt(env.JWT_EXPIRY_MINUTES || '15', 10),
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10),
    CORS_ORIGINS_LIST: env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [],
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/env.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/env.ts src/server/env.test.ts
git commit -m "feat: add CORS_ORIGINS env variable support"
```

---

## Task 6: Create Configurable CORS Middleware

**Files:**
- Create: `src/server/middleware/cors.ts`
- Test: `src/server/middleware/cors.test.ts`

**Step 1: Write the failing tests**

Create `src/server/middleware/cors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { configurableCors } from './cors'

describe('configurableCors', () => {
  it('allows origin from CORS_ORIGINS list', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com', 'https://admin.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://app.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
  })

  it('rejects origin not in CORS_ORIGINS list', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://malicious.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('uses APP_URL when CORS_ORIGINS is empty', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: [],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://default.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://default.example.com')
  })

  it('sets credentials to true', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.get('/api/test', (c) => c.json({ ok: true }))

    const res = await app.request('/api/test', {
      headers: { Origin: 'https://app.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('allows required headers', async () => {
    const app = new Hono()
    app.use('*', configurableCors({
      corsOrigins: ['https://app.example.com'],
      appUrl: 'https://default.example.com',
    }))
    app.options('/api/test', (c) => c.text(''))

    const res = await app.request('/api/test', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })

    const allowedHeaders = res.headers.get('Access-Control-Allow-Headers')
    expect(allowedHeaders).toContain('Content-Type')
    expect(allowedHeaders).toContain('Authorization')
    expect(allowedHeaders).toContain('Account-ID')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/middleware/cors.test.ts`
Expected: FAIL - module not found

**Step 3: Create configurable CORS middleware**

Create `src/server/middleware/cors.ts`:

```typescript
import { cors } from 'hono/cors'

interface CorsConfig {
  corsOrigins: string[]
  appUrl: string
}

/**
 * Configurable CORS middleware.
 * Uses CORS_ORIGINS list if provided, otherwise falls back to APP_URL.
 */
export const configurableCors = (config: CorsConfig) => {
  const allowedOrigins = config.corsOrigins.length > 0
    ? config.corsOrigins
    : [config.appUrl]

  return cors({
    origin: (origin) => {
      if (!origin) return null
      return allowedOrigins.includes(origin) ? origin : null
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'Account-ID'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/middleware/cors.test.ts`
Expected: PASS

**Step 5: Export from middleware index**

Modify `src/server/middleware/index.ts`:

```typescript
export { requestContext } from './request-context'
export { jwtAuth } from './auth'
export { accountMiddleware } from './account'
export { errorHandler } from './error-handler'
export { requestLogger } from './request-logger'
export { configurableCors } from './cors'
```

**Step 6: Commit**

```bash
git add src/server/middleware/cors.ts src/server/middleware/cors.test.ts src/server/middleware/index.ts
git commit -m "feat: add configurable CORS middleware"
```

---

## Task 7: Integrate All Middlewares in index.ts

**Files:**
- Modify: `src/server/index.ts`

**Step 1: Read current index.ts**

Already read - see file content above.

**Step 2: Update index.ts with new middleware order**

Modify `src/server/index.ts`:

```typescript
// src/server/index.ts
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { Env, getEnv } from './env'
import { createDb } from './db/client'
import { auth } from './routes/auth'
import { api } from './routes'
import {
  errorHandler,
  requestLogger,
  configurableCors,
  requestContext,
} from './middleware'

// Hono app with bindings
const app = new Hono<{ Bindings: Env }>()

// 1. Global error handler
app.onError(errorHandler)

// 2. Request context (transactionId, IP, userAgent) - must be first for logging
app.use('*', requestContext)

// 3. Request logger (uses transactionId from context)
app.use('*', requestLogger())

// 4. Configurable CORS
app.use('*', async (c, next) => {
  const env = c.env
  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : []
  return configurableCors({
    corsOrigins,
    appUrl: env.APP_URL,
  })(c, next)
})

// 5. Security headers
app.use('*', secureHeaders())

// 6. Database middleware - create db instance per request
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  await next()
})

// Mount routes
app.route('/auth', auth)
app.route('/api', api)

export default app
```

**Step 3: Verify application builds**

Run: `npm run typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: integrate all new middlewares in app"
```

---

## Task 8: Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Verify lint**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones)

**Step 4: Final commit if any fixes needed**

---

## Summary

| Task | Feature | Files |
|------|---------|-------|
| 1 | Error codes | `lib/errors.ts` |
| 2 | Error handler | `middleware/error-handler.ts` |
| 3 | Transaction wrapper | `lib/transaction.ts` |
| 4 | Request logger | `middleware/request-logger.ts` |
| 5 | CORS env | `env.ts` |
| 6 | CORS middleware | `middleware/cors.ts` |
| 7 | Integration | `index.ts` |
| 8 | Verification | All |
