# Design: Backend Middleware Features

**Date:** 2025-12-23
**Status:** Approved

## Overview

Add 4 backend middleware features to the Hono boilerplate: Global Error Handler, Transaction Support, Request Logger, and Configurable CORS.

## Decisions

| Feature | Approach |
|---------|----------|
| Global Error Handler | Detailed format with code, message, status, timestamp |
| Transaction Support | Wrapper function `withTransaction()` |
| Request Logger | Structured JSON with transactionId |
| CORS | List of origins via ENV variable |

---

## 1. Global Error Handler

### File: `src/server/middleware/error-handler.ts`

### Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string           // "NOT_FOUND", "VALIDATION_ERROR", etc.
    message: string        // Human-readable message
    status: number         // HTTP status code
    timestamp: string      // ISO timestamp
    details?: unknown      // Extra details (validation errors, etc.)
  }
}
```

### Error Code Mapping

| Class | Code | Status |
|-------|------|--------|
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `InternalError` | `INTERNAL_ERROR` | 500 |
| Unknown error | `INTERNAL_ERROR` | 500 |

### Usage

Applied globally via `app.onError()` in index.ts

---

## 2. Transaction Support

### File: `src/server/lib/transaction.ts`

### API

```typescript
async function withTransaction<T>(
  db: Database,
  callback: (tx: Transaction) => Promise<T>
): Promise<T>
```

### Behavior

- Callback succeeds → automatic commit
- Callback throws → automatic rollback
- Returns callback result

### Example

```typescript
const result = await withTransaction(db, async (tx) => {
  const [account] = await tx.insert(accounts).values({ name: 'Acme' }).returning()
  const [user] = await tx.insert(users).values({ email: 'admin@acme.com' }).returning()
  await tx.insert(userAccounts).values({ userId: user.id, accountId: account.id })
  return { account, user }
})
```

### Note on D1

Cloudflare D1 supports transactions via Drizzle's transaction API. The wrapper abstracts this transparently.

---

## 3. Request Logger

### File: `src/server/middleware/request-logger.ts`

### Log Format

```typescript
interface RequestLog {
  level: 'info' | 'warn' | 'error'
  method: string          // GET, POST, etc.
  path: string            // /api/users/123
  status: number          // 200, 404, 500
  duration: number        // ms
  transactionId: string   // correlation ID
  ip: string
  userAgent: string
  userId?: string         // if authenticated
  timestamp: string       // ISO
}
```

### Log Levels

- `info` for status < 400
- `warn` for status 400-499
- `error` for status >= 500

### Example Output

```json
{"level":"info","method":"GET","path":"/api/users","status":200,"duration":45,"transactionId":"0192a1b2-...","timestamp":"2025-12-23T..."}
```

---

## 4. Configurable CORS

### Files

- `src/server/middleware/cors.ts`
- `src/server/env.ts` (add CORS_ORIGINS)

### Environment Variable

```bash
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

### Logic

```typescript
// If CORS_ORIGINS defined → use list
// If not defined → use APP_URL as fallback
const allowedOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map(o => o.trim())
  : [env.APP_URL]
```

### Configuration

- Exact origin matching (no wildcards for security)
- Always `credentials: true` for cookies
- Allowed headers: `Content-Type, Authorization, Account-ID`

### Example

```bash
# Production
CORS_ORIGINS=https://app.mysite.com,https://admin.mysite.com

# Development (optional, uses APP_URL)
APP_URL=http://localhost:5173
```

---

## 5. File Structure

```
src/server/
├── middleware/
│   ├── error-handler.ts    # NEW - Global error handler
│   ├── request-logger.ts   # NEW - JSON structured logger
│   ├── cors.ts             # NEW - Configurable CORS
│   ├── request-context.ts  # Existing
│   ├── auth.ts             # Existing
│   └── account.ts          # Existing
├── lib/
│   ├── transaction.ts      # NEW - Transaction wrapper
│   ├── errors.ts           # MODIFY (add error codes)
│   └── ...
├── env.ts                  # MODIFY (add CORS_ORIGINS)
└── index.ts                # MODIFY (use new middlewares)
```

## 6. Middleware Order in index.ts

```typescript
app.onError(errorHandler)           // 1. Error handler (global)
app.use('*', requestLogger())       // 2. Logger (first to measure duration)
app.use('*', configurableCors())    // 3. CORS
app.use('*', secureHeaders())       // 4. Security headers
app.use('*', requestContext())      // 5. Transaction ID, IP, etc.
app.use('*', dbMiddleware())        // 6. Database
```

## 7. Implementation Order

1. `lib/errors.ts` - Add error codes to existing classes
2. `middleware/error-handler.ts` - Global error handler
3. `lib/transaction.ts` - Transaction wrapper
4. `middleware/request-logger.ts` - Structured logger
5. `env.ts` + `middleware/cors.ts` - Configurable CORS
6. `index.ts` - Integrate all middlewares
