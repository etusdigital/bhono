# Middleware Examples

Examples of custom Hono middleware for Cloudflare Workers.

## Files

| File | Purpose |
|------|---------|
| `rate-limiter.ts` | KV-based rate limiting with headers |
| `request-logger.ts` | Structured JSON logging |
| `header-validator.ts` | Request validation middleware |

## Middleware Pattern

All middleware follows the same pattern:

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@server/types'

export function myMiddleware(config: Config) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    // Before handler
    // ...

    await next()

    // After handler
    // ...
  })
}
```

## Middleware Ordering

Order matters! Register middleware in this sequence:

```typescript
// 1. Error handler (first - catches all errors)
app.onError(errorHandler)

// 2. Request context (transaction ID, IP, etc.)
app.use('/*', requestContext)

// 3. CORS
app.use('/*', cors())

// 4. Logging
app.use('/*', requestLogger())

// 5. Rate limiting
app.use('/*', rateLimiter({ limit: 1000, windowSeconds: 60 }))

// 6. Authentication
app.use('/api/*', sessionAuth)

// 7. Account resolution
app.use('/api/*', accountMiddleware)

// 8. Guards (applied per-route)
app.use('/api/admin/*', requireRole('ADMIN'))

// 9. Routes
app.route('/api', apiRouter)
```

## Key Patterns

### Factory Functions

Create configurable middleware with factory functions:

```typescript
export function rateLimiter(config: RateLimitConfig) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    // Use config here
  })
}
```

### Context Storage

Store data for downstream handlers:

```typescript
// In middleware
c.set('userId', userId)
c.set('transactionId', requestId)

// In handler
const userId = c.get('userId')
```

### Error Throwing

Throw HTTPException to halt processing:

```typescript
if (!authorized) {
  throw new HTTPException(403, {
    message: 'Forbidden',
    cause: { reason: 'Insufficient permissions' },
  })
}
```

### Response Headers

Add headers for client information:

```typescript
c.header('X-RateLimit-Remaining', remaining.toString())
c.header('X-Request-Id', transactionId)
```

## Cloudflare Workers Considerations

1. **No file system** - Use KV/R2 for persistence
2. **No long-running processes** - Rate limits expire via KV TTL
3. **console.log outputs JSON** - Use structured logging
4. **Each request is isolated** - No shared in-memory state
