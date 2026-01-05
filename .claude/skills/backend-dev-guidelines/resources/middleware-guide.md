# Middleware Guide - Hono Middleware Patterns

Complete guide to creating and using middleware in Hono.js on Cloudflare Workers.

## Table of Contents

- [Overview](#overview)
- [createMiddleware Pattern](#createmiddleware-pattern)
- [Middleware Stack](#middleware-stack)
- [Built-in Middleware](#built-in-middleware)
- [Custom Middleware Examples](#custom-middleware-examples)
- [Middleware Ordering](#middleware-ordering)
- [Route-Level Middleware](#route-level-middleware)

---

## Overview

### Hono Middleware vs Express

Hono middleware is similar to Express but with important differences:

| Aspect | Express | Hono |
|--------|---------|------|
| Creation | Function with `(req, res, next)` | `createMiddleware<HonoEnv>()` |
| Context | `req`, `res` objects | Single `c` context object |
| Variables | `res.locals` | `c.get()` / `c.set()` |
| Error handling | `next(error)` | Throw `HTTPException` |
| Type safety | Manual | Built-in with HonoEnv |

### Basic Structure

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@server/types'

export const myMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  // Before handler
  c.set('someValue', 'data')

  await next()

  // After handler (optional)
  const status = c.res.status
})
```

---

## createMiddleware Pattern

### Type-Safe Middleware

Always use `createMiddleware<HonoEnv>` for type safety:

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@server/types'

// ✅ Type-safe - access to HonoEnv Variables and Bindings
export const middleware = createMiddleware<HonoEnv>(async (c, next) => {
  const db = c.get('db')           // Type: D1Database | undefined
  const user = c.get('user')       // Type: User | null
  const env = c.env                // Type: Env (Cloudflare bindings)

  await next()
})

// ❌ Not type-safe - no access to custom variables
import { createMiddleware } from 'hono/factory'
export const middleware = createMiddleware(async (c, next) => {
  const db = c.get('db')  // Type: unknown
  await next()
})
```

### Setting Context Variables

```typescript
export const requestContext = createMiddleware<HonoEnv>(async (c, next) => {
  // Set values before handler runs
  c.set('transactionId', uuidv7())
  c.set('ip', c.req.header('x-forwarded-for') ?? 'unknown')
  c.set('userAgent', c.req.header('user-agent') ?? 'unknown')

  // Initialize optional values
  c.set('user', null)
  c.set('accountId', '')
  c.set('userRole', null)

  await next()
})
```

### Reading Headers and Bindings

```typescript
export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  // Access Cloudflare bindings
  const db = c.env.DB              // D1 database
  const sessions = c.env.SESSIONS  // KV namespace
  const secret = c.env.JWT_SECRET  // Secret from wrangler.json

  // Access request headers
  const authHeader = c.req.header('Authorization')
  const accountId = c.req.header('account-id')

  // Access context variables (set by earlier middleware)
  const existingDb = c.get('db')

  await next()
})
```

### Post-Handler Processing

```typescript
export const requestLogger = () =>
  createMiddleware<HonoEnv>(async (c, next) => {
    const start = Date.now()

    await next()  // Handler runs here

    // After handler - access response
    const duration = Date.now() - start
    const status = c.res.status
    const user = c.get('user')

    console.log(JSON.stringify({
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      userId: user?.id,
    }))
  })
```

---

## Middleware Stack

### Application-Level Middleware

Registered in `src/server/index.ts`:

```typescript
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import {
  requestContext,
  requestLogger,
  configurableCors,
  rateLimit,
  authRateLimit,
  errorHandler,
} from '@server/middleware'

const app = new Hono<HonoEnv>()

// 1. Global error handler (catches all errors)
app.onError(errorHandler)

// 2. Request context (MUST be first for transactionId)
app.use('*', requestContext)

// 3. Environment validation
app.use('*', async (c, next) => {
  validateEnv(c.env)
  await next()
})

// 4. Request logging
app.use('*', requestLogger())

// 5. CORS
app.use('*', configurableCors({
  corsOrigins: (c.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  appUrl: c.env.APP_URL ?? '',
}))

// 6. Security headers
app.use('*', secureHeaders())

// 7. Global rate limiting (100 req/min)
app.use('*', rateLimit())

// 8. Auth-specific rate limiting (10 req/min)
app.use('/auth/*', authRateLimit())

// 9. Database middleware
app.use('*', async (c, next) => {
  if (c.env.DB) c.set('db', c.env.DB)
  await next()
})

// 10. Session middleware
app.use('*', sessionMiddleware())

// Mount routes
app.route('/health', health)
app.route('/auth', auth)
app.route('/api', api)
```

### Router-Level Middleware

Applied to specific route groups in `src/server/routes/index.ts`:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import { sessionAuth, accountMiddleware } from '@server/middleware'

const api = new OpenAPIHono<HonoEnv>()

// Apply auth to all /api/* routes
api.use('/*', sessionAuth)

// Apply account context to all /api/* routes
api.use('/*', accountMiddleware)

// Mount feature routers
api.route('/users', users)
api.route('/accounts', accounts)
```

---

## Built-in Middleware

### Security Headers

```typescript
import { secureHeaders } from 'hono/secure-headers'

app.use('*', secureHeaders())
// Sets: X-Content-Type-Options, X-Frame-Options, etc.
```

### CORS

```typescript
import { cors } from 'hono/cors'

// Simple CORS
app.use('*', cors())

// Configurable CORS
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

---

## Custom Middleware Examples

### Request Context Middleware

Sets transaction ID, IP, and user agent for tracing:

```typescript
// src/server/middleware/request-context.ts
import { createMiddleware } from 'hono/factory'
import { uuidv7 } from 'uuidv7'
import type { HonoEnv } from '@server/types'

export const requestContext = createMiddleware<HonoEnv>(async (c, next) => {
  // Transaction ID for request tracing
  c.set('transactionId', uuidv7())

  // IP address (from proxy headers)
  const forwardedFor = c.req.header('x-forwarded-for')
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : (c.req.header('x-real-ip') ?? 'unknown')
  c.set('ip', ip)

  // User agent
  c.set('userAgent', c.req.header('user-agent') ?? 'unknown')

  // Initialize user context (set by auth middleware)
  c.set('user', null)
  c.set('accountId', '')
  c.set('userRole', null)
  c.set('isSystemAdminAccess', false)

  await next()
})
```

### Session Auth Middleware

Validates session cookie and loads user:

```typescript
// src/server/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '@server/types'
import { getSession } from '@server/lib/session'
import { queryOne } from '@server/db/sql'

export const sessionAuth = createMiddleware<HonoEnv>(async (c, next) => {
  // Get session from cookie
  const session = getSession(c)

  if (!session) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  // Lookup user in database
  const db = c.env.DB ?? c.get('db')
  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  const user = await queryOne(
    db,
    `SELECT id, email, name, status, is_super_admin as isSuperAdmin
     FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [session.userId]
  )

  if (!user) {
    throw new HTTPException(401, { message: 'User not found' })
  }

  if (user.status !== 'active') {
    throw new HTTPException(401, { message: 'User account is not active' })
  }

  // Set user in context
  c.set('user', mapUserRow(user))

  await next()
})
```

### Account Middleware

Resolves account-id header and checks membership:

```typescript
// src/server/middleware/account.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '@server/types'
import type { Role } from '@server/auth/roles'
import { queryOne } from '@server/db/sql'

export const accountMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  // Required header
  const accountId = c.req.header('account-id')
  if (!accountId) {
    throw new HTTPException(400, { message: 'Missing account-id header' })
  }

  // User must be authenticated
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  // Super-admin bypass
  if (user.isSuperAdmin) {
    c.set('accountId', accountId)
    c.set('userRole', 'ADMIN' as Role)
    c.set('isSystemAdminAccess', true)
    await next()
    return
  }

  // Check user-account membership
  const db = c.env.DB ?? c.get('db')
  const membership = await queryOne<{ role: Role }>(
    db!,
    `SELECT role FROM user_accounts
     WHERE user_id = ? AND account_id = ? LIMIT 1`,
    [user.id, accountId]
  )

  if (!membership) {
    throw new HTTPException(403, {
      message: 'User does not have access to this account',
    })
  }

  // Set context
  c.set('accountId', accountId)
  c.set('userRole', membership.role)
  c.set('isSystemAdminAccess', false)

  await next()
})
```

### Rate Limiting Middleware

```typescript
// src/server/middleware/rate-limit.ts
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@server/types'

export interface RateLimitOptions {
  windowMs?: number  // Default: 60000 (1 minute)
  max?: number       // Default: 100 requests
  message?: string
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,
    max = 100,
    message = 'Too many requests, please try again later',
  } = options

  return createMiddleware<HonoEnv>(async (c, next) => {
    const key = `ratelimit:${c.get('ip') ?? 'unknown'}`
    const record = store.increment(key, windowMs)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)))

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - Date.now()) / 1000)
      c.header('Retry-After', String(Math.max(1, retryAfter)))

      return c.json({
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
      }, 429)
    }

    await next()
  })
}

// Stricter limit for auth endpoints
export function authRateLimit() {
  return rateLimit({
    windowMs: 60000,
    max: 10,  // 10 requests per minute
    message: 'Too many authentication attempts',
  })
}
```

### Request Logger Middleware

```typescript
// src/server/middleware/request-logger.ts
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@server/types'

export const requestLogger = () =>
  createMiddleware<HonoEnv>(async (c, next) => {
    const start = Date.now()

    await next()

    const duration = Date.now() - start
    const status = c.res.status
    const user = c.get('user')

    console.log(JSON.stringify({
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      transactionId: c.get('transactionId') ?? 'unknown',
      ip: c.get('ip') ?? 'unknown',
      userAgent: c.get('userAgent') ?? 'unknown',
      userId: user?.id,
      timestamp: new Date().toISOString(),
    }))
  })
```

---

## Middleware Ordering

### Critical Order Rules

Middleware executes in registration order. This order is critical:

```
1. errorHandler       - Must be first (app.onError)
2. requestContext     - Sets transactionId for all logging
3. envValidation      - Fail fast on bad config
4. requestLogger      - Uses transactionId from step 2
5. cors               - Before any responses
6. secureHeaders      - Security headers
7. rateLimit          - Before processing
8. database           - Set D1 connection
9. session            - Read session from KV
10. routes            - Match and execute
```

### Common Mistakes

```typescript
// ❌ WRONG - Logger before requestContext (no transactionId)
app.use('*', requestLogger())
app.use('*', requestContext)

// ✅ CORRECT - requestContext sets transactionId first
app.use('*', requestContext)
app.use('*', requestLogger())

// ❌ WRONG - Auth before session (no session data)
api.use('/*', sessionAuth)
api.use('/*', sessionMiddleware())

// ✅ CORRECT - Session loads before auth checks it
app.use('*', sessionMiddleware())
// ... then in router:
api.use('/*', sessionAuth)
```

---

## Route-Level Middleware

### Applying to Specific Routes

```typescript
// src/server/routes/users/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { requireRole } from '@server/auth/guards'
import { toHonoPath } from '../openapi'
import { getUserRoute, updateUserRoute, deleteUserRoute } from './routes'
import { getUserHandler, updateUserHandler, deleteUserHandler } from './handlers'

const users = new OpenAPIHono<HonoEnv>()

// Public route (within API - requires auth via parent router)
users.openapi(getUserRoute, getUserHandler)

// Protected routes - apply guard middleware before handler
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)

export { users }
```

### Path Matching

```typescript
// Match specific path
users.use('/admin/*', adminMiddleware)

// Match exact path with params
users.use('/:id', logAccessMiddleware)

// Convert OpenAPI path to Hono path
const honoPath = toHonoPath('/{id}')  // Returns '/:id'
users.use(honoPath, middleware)
```

### Conditional Middleware

```typescript
// Skip middleware for certain paths
export function skipPaths(middleware: MiddlewareHandler, paths: string[]) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    if (paths.some(path => c.req.path.startsWith(path))) {
      await next()
      return
    }
    return middleware(c, next)
  })
}

// Usage
app.use('*', skipPaths(sessionAuth, ['/health', '/api/doc', '/api/swagger']))
```

---

## Error Handling in Middleware

### Throwing HTTPException

```typescript
import { HTTPException } from 'hono/http-exception'

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const token = c.req.header('Authorization')

  if (!token) {
    // Throw HTTPException - caught by global errorHandler
    throw new HTTPException(401, {
      message: 'Missing authorization header',
    })
  }

  // Include additional details
  throw new HTTPException(403, {
    message: 'Forbidden',
    cause: { requiredRole: 'ADMIN', userRole: 'VIEWER' },
  })

  await next()
})
```

### Global Error Handler

```typescript
// src/server/middleware/error-handler.ts
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getErrorCode } from '@server/lib/errors'

export const errorHandler: ErrorHandler = (err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  const message = err instanceof HTTPException ? err.message : 'Internal server error'
  const code = getErrorCode(err)
  const details = err instanceof HTTPException ? err.cause : undefined

  // Log for debugging
  console.log(JSON.stringify({
    _tag: 'ERROR_HANDLER',
    status,
    code,
    message,
    stack: err.stack?.substring(0, 500),
  }))

  return c.json({
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    },
  }, status)
}

// Register as error handler
app.onError(errorHandler)
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [architecture-overview.md](architecture-overview.md) - Middleware stack details
- [auth-and-guards.md](auth-and-guards.md) - RBAC guards
- [error-handling.md](error-handling.md) - Error patterns
