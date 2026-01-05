# Error Handling - HTTPException and Custom Errors

Complete guide to error handling patterns in Hono.js on Cloudflare Workers.

## Table of Contents

- [Overview](#overview)
- [HTTPException](#httpexception)
- [Custom Error Classes](#custom-error-classes)
- [Error Codes](#error-codes)
- [Global Error Handler](#global-error-handler)
- [Error Response Format](#error-response-format)
- [Throwing Errors](#throwing-errors)
- [Error Logging](#error-logging)
- [Async Error Handling](#async-error-handling)

---

## Overview

### Hono Error Handling

Hono uses a single global error handler registered with `app.onError()`. All errors thrown in handlers and middleware are caught here.

```
Handler/Middleware throws error
    ↓
Error propagates up
    ↓
Global errorHandler catches
    ↓
JSON error response returned
```

### Key Differences from Express

| Aspect | Express | Hono |
|--------|---------|------|
| Error type | Custom Error classes | HTTPException |
| Error propagation | `next(error)` | `throw` |
| Error handler | Middleware with 4 params | `app.onError()` |
| Status code | `error.statusCode` | `error.status` |

---

## HTTPException

### Basic Usage

```typescript
import { HTTPException } from 'hono/http-exception'

// Throw with status and message
throw new HTTPException(400, {
  message: 'Invalid input',
})

// With additional details
throw new HTTPException(400, {
  message: 'Validation failed',
  cause: {
    field: 'email',
    reason: 'Invalid email format',
  },
})
```

### HTTPException Properties

```typescript
interface HTTPException {
  status: number        // HTTP status code
  message: string       // Error message
  cause?: unknown       // Additional details
}
```

### Common Status Codes

```typescript
throw new HTTPException(400, { message: 'Bad Request' })
throw new HTTPException(401, { message: 'Unauthorized' })
throw new HTTPException(403, { message: 'Forbidden' })
throw new HTTPException(404, { message: 'Not Found' })
throw new HTTPException(409, { message: 'Conflict' })
throw new HTTPException(500, { message: 'Internal Server Error' })
```

---

## Custom Error Classes

### Location

```
src/server/lib/errors.ts
```

### Available Errors

```typescript
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
} from '@server/lib/errors'
```

### Error Class Definitions

```typescript
// src/server/lib/errors.ts
import { HTTPException } from 'hono/http-exception'

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
```

### Usage

```typescript
// Not found
if (!user) throw new NotFoundError('User')
// Message: "User not found"

// Validation error with details
throw new ValidationError('Invalid input', {
  email: 'Invalid format',
  name: 'Required field',
})

// Conflict
throw new ConflictError('Email already in use')

// Forbidden
throw new ForbiddenError('Requires ADMIN role')
```

---

## Error Codes

### Available Codes

```typescript
// src/server/lib/errors.ts
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
```

### Getting Error Code

```typescript
import { getErrorCode } from '@server/lib/errors'

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

---

## Global Error Handler

### Location

```
src/server/middleware/error-handler.ts
```

### Implementation

```typescript
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getErrorCode, type ErrorCode } from '@server/lib/errors'

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

  // Log for debugging
  console.log(JSON.stringify({
    _tag: 'ERROR_HANDLER',
    status,
    code,
    message,
    name: err.name,
    stack: err.stack?.substring(0, 500),
    cause: String((err as Error & { cause?: unknown }).cause),
  }))

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

### Registration

```typescript
// src/server/index.ts
import { Hono } from 'hono'
import { errorHandler } from '@server/middleware/error-handler'

const app = new Hono<HonoEnv>()

// MUST be registered first
app.onError(errorHandler)

// ... rest of middleware and routes
```

---

## Error Response Format

### Standard Response Structure

```typescript
interface ErrorResponse {
  error: {
    code: string        // Error code (VALIDATION_ERROR, NOT_FOUND, etc.)
    message: string     // Human-readable message
    status: number      // HTTP status code
    timestamp: string   // ISO 8601 timestamp
    details?: unknown   // Optional additional details
  }
}
```

### Example Responses

**404 Not Found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "status": 404,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**400 Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "status": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "details": {
      "email": "Invalid email format",
      "name": "Required field"
    }
  }
}
```

**403 Forbidden:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Requires ADMIN role or higher",
    "status": 403,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Throwing Errors

### In Handlers

```typescript
// handlers.ts
export const getUserHandler: RouteHandler<typeof getUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')

  if (!db) {
    throw new HTTPException(500, { message: 'Database unavailable' })
  }

  const ctx = buildServiceContext(c)
  const user = await usersService.findById(db, ctx, id)

  // Service throws NotFoundError if not found
  return c.json({ data: user }, 200)
}
```

### In Services

```typescript
// services/users.ts
async function findById(db: D1Database, ctx: ServiceContext, id: string) {
  const row = await queryOne(
    db,
    `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('User')
  }

  // Check tenant access
  if (!ctx.user.isSuperAdmin) {
    const hasAccess = await checkAccountAccess(db, id, ctx.accountId)
    if (!hasAccess) {
      throw new ForbiddenError('User does not belong to this account')
    }
  }

  return mapUserRow(row)
}

async function create(db: D1Database, ctx: ServiceContext, input: CreateUserInput) {
  // Check for duplicate
  const existing = await queryOne(
    db,
    `SELECT 1 FROM users WHERE email = ? LIMIT 1`,
    [input.email]
  )

  if (existing) {
    throw new ConflictError('Email already in use')
  }

  // ... create user
}
```

### In Middleware

```typescript
// middleware/auth.ts
export const sessionAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const session = getSession(c)

  if (!session) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  const user = await queryOne(db, '...', [session.userId])

  if (!user) {
    throw new HTTPException(401, { message: 'User not found' })
  }

  if (user.status !== 'active') {
    throw new HTTPException(401, { message: 'User account is not active' })
  }

  c.set('user', mapUserRow(user))
  await next()
})
```

---

## Error Logging

### Structured Logging

Cloudflare Workers use `console.log` for logging. Output is JSON for easy parsing:

```typescript
// In error handler
console.log(JSON.stringify({
  _tag: 'ERROR_HANDLER',
  status,
  code,
  message,
  name: err.name,
  stack: err.stack?.substring(0, 500),
  cause: String((err as Error & { cause?: unknown }).cause),
}))
```

### Log Levels by Status

```typescript
function getLogLevel(status: number): 'info' | 'warn' | 'error' {
  if (status >= 500) return 'error'
  if (status >= 400) return 'warn'
  return 'info'
}
```

### Transaction ID for Tracing

Include `transactionId` in logs for request correlation:

```typescript
console.log(JSON.stringify({
  _tag: 'ERROR',
  transactionId: c.get('transactionId'),
  // ... other fields
}))
```

---

## Async Error Handling

### No Try-Catch Needed in Handlers

Hono automatically catches async errors:

```typescript
// ✅ CORRECT - Hono catches this automatically
export const handler: RouteHandler = async (c) => {
  const data = await service.getData()  // If throws, caught by errorHandler
  return c.json({ data })
}

// ❌ UNNECESSARY - Don't wrap in try-catch unless needed
export const handler: RouteHandler = async (c) => {
  try {
    const data = await service.getData()
    return c.json({ data })
  } catch (error) {
    // This is handled by global errorHandler anyway
    throw error
  }
}
```

### When Try-Catch Is Useful

```typescript
// Transforming errors
export const handler: RouteHandler = async (c) => {
  try {
    const data = await externalApi.fetch()
    return c.json({ data })
  } catch (error) {
    // Transform external API error to our format
    throw new InternalError('External service unavailable')
  }
}

// Partial failure handling
export const handler: RouteHandler = async (c) => {
  const results = await Promise.allSettled([
    service1.getData(),
    service2.getData(),
  ])

  const errors = results.filter(r => r.status === 'rejected')
  if (errors.length > 0) {
    // Log but continue
    console.log(JSON.stringify({ partialErrors: errors.length }))
  }

  const data = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)

  return c.json({ data, hasPartialErrors: errors.length > 0 })
}
```

### Parallel Operations

```typescript
// All succeed or all fail
const [users, accounts] = await Promise.all([
  usersService.findAll(db, ctx),
  accountsService.findAll(db, ctx),
])

// Individual error handling
const results = await Promise.allSettled([
  usersService.findAll(db, ctx),
  accountsService.findAll(db, ctx),
])

results.forEach((result, index) => {
  if (result.status === 'rejected') {
    console.log(JSON.stringify({
      error: 'Partial operation failed',
      index,
      reason: result.reason,
    }))
  }
})
```

---

## Common Patterns

### Database Error Handling

```typescript
async function update(db: D1Database, ctx: ServiceContext, id: string, input: UpdateInput) {
  // Check exists
  const existing = await this.findById(db, ctx, id)
  // findById throws NotFoundError if not found

  try {
    await execute(db, 'UPDATE ...', params)
  } catch (error) {
    // D1 constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      throw new ConflictError('Value already exists')
    }
    throw error  // Re-throw unknown errors
  }
}
```

### Validation Errors

```typescript
// Manual validation with details
const errors: Record<string, string> = {}

if (!input.email.includes('@')) {
  errors.email = 'Invalid email format'
}
if (input.name.length < 2) {
  errors.name = 'Name must be at least 2 characters'
}

if (Object.keys(errors).length > 0) {
  throw new ValidationError('Validation failed', errors)
}
```

### Error Classification

```typescript
function classifyError(error: unknown): {
  isOperational: boolean
  shouldRetry: boolean
} {
  if (error instanceof HTTPException) {
    return {
      isOperational: true,
      shouldRetry: error.status >= 500,
    }
  }

  return {
    isOperational: false,
    shouldRetry: true,
  }
}
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [middleware-guide.md](middleware-guide.md) - Error handler middleware
- [services-layer.md](services-layer.md) - Error handling in services
- [validation-and-openapi.md](validation-and-openapi.md) - Validation errors
