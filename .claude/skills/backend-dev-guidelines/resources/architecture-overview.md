# Architecture Overview - Hono.js on Cloudflare Workers

Complete guide to the layered architecture pattern used in this Hono.js boilerplate.

## Table of Contents

- [Layered Architecture](#layered-architecture)
- [Request Lifecycle](#request-lifecycle)
- [Middleware Stack](#middleware-stack)
- [HonoEnv Type System](#honoenv-type-system)
- [ServiceContext Pattern](#servicecontext-pattern)
- [Directory Structure](#directory-structure)
- [Separation of Concerns](#separation-of-concerns)

---

## Layered Architecture

### The Three Layers

```
┌─────────────────────────────────────┐
│         HTTP Request                │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  MIDDLEWARE STACK                   │
│  - errorHandler (global)            │
│  - requestContext (transactionId)   │
│  - requestLogger                    │
│  - cors, secureHeaders, rateLimit   │
│  - sessionMiddleware (KV)           │
│  - sessionAuth (route-level)        │
│  - accountMiddleware                │
│  - requireRole guards               │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 1: ROUTES + HANDLERS         │
│  - OpenAPI route definitions        │
│  - Request/response handling        │
│  - Input validation (c.req.valid)   │
│  - Call services                    │
│  - Format responses (c.json)        │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 2: SERVICES                  │
│  - Business logic                   │
│  - Multi-tenancy filtering          │
│  - Audit logging integration        │
│  - No HTTP knowledge                │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 3: DATABASE (D1)             │
│  - SQL helper functions             │
│  - Row mapping to domain types      │
│  - Audited update/delete            │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│         Cloudflare D1 (SQLite)      │
└─────────────────────────────────────┘
```

### Why This Architecture?

**Testability:**
- Handlers test HTTP concerns (status codes, headers)
- Services test business logic in isolation
- SQL helpers test data access without HTTP

**Multi-Tenancy:**
- ServiceContext carries accountId automatically
- Services filter data by account
- Guards enforce RBAC per route

**Auditability:**
- All changes tracked via audit_logs table
- transactionId links related operations
- auditedUpdate/Delete handle logging automatically

**Cloudflare Workers Optimized:**
- No ORMs or heavy abstractions
- Direct D1 SQL for performance
- KV-backed sessions for edge distribution

---

## Request Lifecycle

### Complete Flow Example

```typescript
// 1. HTTP GET /api/users/123
//    ↓
// 2. Middleware stack executes in order:
//    - errorHandler registered (catches all errors)
//    - requestContext sets transactionId, ip, userAgent
//    - requestLogger logs request
//    - cors, secureHeaders, rateLimit
//    - database middleware creates D1 connection
//    - sessionMiddleware reads session from KV
//    ↓
// 3. API router applies auth middleware:
//    - sessionAuth validates user is authenticated
//    - accountMiddleware resolves account-id header to role
//    ↓
// 4. Route matches getUserRoute definition
//    ↓
// 5. Guard executes (if any):
//    - requireRole('VIEWER') checks user role
//    ↓
// 6. Handler executes:
//    - Extracts validated params: c.req.valid('param')
//    - Builds ServiceContext from Hono context
//    - Calls service: usersService.findById(db, ctx, id)
//    ↓
// 7. Service executes business logic:
//    - Runs SQL query with tenant filtering
//    - Maps row to domain type
//    - Returns User object
//    ↓
// 8. Handler formats response:
//    - return c.json({ data: user }, 200)
//    ↓
// 9. Response sent to client
```

### Handler to Service Flow

```typescript
// handlers.ts
export const getUserHandler: RouteHandler<typeof getUserRoute, HonoEnv> = async (c) => {
  // Extract validated input
  const { id } = c.req.valid('param')

  // Get database from context
  const db = c.get('db')
  if (!db) throw new HTTPException(500, { message: 'Database unavailable' })

  // Build ServiceContext from Hono context
  const ctx: ServiceContext = {
    accountId: c.get('accountId') ?? '',
    user: c.get('user')!,
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }

  // Call service (no HTTP knowledge)
  const user = await usersService.findById(db, ctx, id)

  // Return response
  return c.json({ data: user }, 200)
}
```

---

## Middleware Stack

### Registration Order (Critical!)

The middleware stack in `src/server/index.ts` executes in registration order:

```typescript
const app = new Hono<HonoEnv>()

// 1. Global error handler - catches all errors
app.onError(errorHandler)

// 2. Request context - MUST be first for logging
//    Sets: transactionId, ip, userAgent
app.use('*', requestContext)

// 3. Environment validation - fail fast
app.use('*', async (c, next) => {
  validateEnv(c.env)
  await next()
})

// 4. Request logger - uses transactionId
app.use('*', requestLogger())

// 5. CORS - configurable origins
app.use('*', configurableCors(...))

// 6. Security headers
app.use('*', secureHeaders())

// 7. Rate limiting - global (100 req/min)
app.use('*', rateLimit())

// 8. Auth rate limiting - login endpoints only (10 req/min)
app.use('/auth/*', loginRateLimiter)

// 9. Database middleware - creates D1 connection
app.use('*', async (c, next) => {
  if (c.env.DB) c.set('db', createDb(c.env.DB))
  await next()
})

// 10. Session middleware - reads from KV
app.use('*', sessionMiddleware())

// Mount routes after middleware
app.route('/health', health)
app.route('/auth', auth)
app.route('/api', api)
```

### API Router Middleware

The `/api` router applies additional middleware:

```typescript
// src/server/routes/index.ts
const api = new OpenAPIHono<HonoEnv>()

// Auth required for all API routes (except /api/doc, /api/swagger)
api.use('/*', sessionAuth)

// Account context required
api.use('/*', accountMiddleware)

// Mount feature routers
api.route('/users', users)
api.route('/accounts', accounts)
```

### Route-Level Guards

Individual routes apply RBAC guards:

```typescript
// src/server/routes/users/index.ts
const users = new OpenAPIHono<HonoEnv>()

// Public endpoint (within API - requires auth)
users.openapi(getUserRoute, getUserHandler)

// Protected endpoint (requires MANAGER role)
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Protected endpoint (requires ADMIN role)
users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)
```

---

## HonoEnv Type System

### Definition

```typescript
// src/server/types/index.ts
export interface HonoEnv {
  // Cloudflare Workers bindings (from wrangler.json)
  Bindings: Env  // DB, SESSIONS, R2_BUCKET, etc.

  // Request-scoped variables
  Variables: {
    // Set by requestContext middleware
    transactionId?: string
    ip?: string
    userAgent?: string

    // Set by auth middleware
    user: User | null

    // Set by account middleware
    accountId?: string
    userRole: Role | null
    isSystemAdminAccess: boolean

    // Set by database middleware
    db?: D1Database

    // Set by session middleware
    sessionId?: string
    sessionData?: SessionData
    sessionCookies?: string[]
  }
}
```

### Usage in Handlers

```typescript
// Type-safe context access
export const myHandler: RouteHandler<typeof myRoute, HonoEnv> = async (c) => {
  // Bindings (Cloudflare resources)
  const env = c.env              // { DB, SESSIONS, R2_BUCKET, ... }

  // Variables (request context)
  const db = c.get('db')         // D1Database | undefined
  const user = c.get('user')     // User | null
  const accountId = c.get('accountId')  // string | undefined
  const txId = c.get('transactionId')   // string | undefined

  // ...
}
```

### Variable Lifecycle

| Variable | Set By | When |
|----------|--------|------|
| `transactionId` | requestContext | First middleware |
| `ip`, `userAgent` | requestContext | First middleware |
| `db` | database middleware | After env validation |
| `sessionId`, `sessionData` | sessionMiddleware | After database |
| `user` | sessionAuth | API routes only |
| `accountId`, `userRole` | accountMiddleware | API routes only |

---

## ServiceContext Pattern

### Definition

```typescript
// src/server/types/index.ts
export interface ServiceContext {
  accountId: string      // Current account (tenant)
  user: User             // Authenticated user
  userRole?: Role | null // User's role in account
  transactionId?: string // Request correlation ID
  ip?: string            // Client IP address
  userAgent?: string     // Client user agent
}
```

### Purpose

ServiceContext decouples services from HTTP concerns:

1. **No Request/Response** - Services don't know about HTTP
2. **Tenant Isolation** - accountId ensures data filtering
3. **Audit Trail** - user, ip, transactionId for logging
4. **Role Awareness** - userRole for business logic decisions

### Building ServiceContext

```typescript
// In handler - build from Hono context
const ctx: ServiceContext = {
  accountId: c.get('accountId') ?? '',
  user: c.get('user')!,
  userRole: c.get('userRole'),
  transactionId: c.get('transactionId'),
  ip: c.get('ip'),
  userAgent: c.get('userAgent'),
}

// Pass to service
const result = await usersService.findAll(db, ctx, pagination)
```

### Usage in Services

```typescript
// services/users.ts
async function findAllSql(
  db: D1Database,
  ctx: ServiceContext,
  pagination: PaginationQuery
): Promise<PaginatedResponse<User>> {
  const whereClauses: string[] = ['u.deleted_at IS NULL']

  // Multi-tenancy: filter by account unless super admin
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('u.id IN (SELECT user_id FROM user_accounts WHERE account_id = ?)')
    params.push(ctx.accountId)
  }

  // ... execute query
}
```

---

## Directory Structure

```
src/server/
├── index.ts              # App entry, middleware stack
├── env.ts                # Environment validation (Zod)
├── types/                # TypeScript types
│   ├── index.ts          # HonoEnv, ServiceContext, domain types
│   └── auth.ts           # Auth-specific types
├── routes/
│   ├── index.ts          # API router with OpenAPI
│   ├── openapi.ts        # OpenAPI config
│   ├── schemas.ts        # Shared Zod schemas
│   ├── auth/             # OAuth routes (login, callback, logout)
│   ├── users/            # User CRUD
│   │   ├── index.ts      # Router + guards
│   │   ├── routes.ts     # OpenAPI route definitions
│   │   ├── handlers.ts   # Handler implementations
│   │   └── schemas.ts    # Zod schemas
│   ├── accounts/         # Account management
│   ├── invitations/      # Team invites
│   ├── audits/           # Audit log queries
│   ├── storage/          # R2 file operations
│   └── health/           # Health checks
├── services/             # Business logic layer
│   ├── users.ts
│   ├── accounts.ts
│   ├── invitations.ts
│   └── audits.ts
├── middleware/           # Hono middleware
│   ├── index.ts          # Exports all middleware
│   ├── request-context.ts
│   ├── auth.ts           # sessionAuth, jwtAuth
│   ├── account.ts        # accountMiddleware
│   ├── error-handler.ts
│   ├── request-logger.ts
│   ├── cors.ts
│   └── rate-limit.ts
├── auth/                 # RBAC system
│   ├── roles.ts          # Role hierarchy
│   ├── permissions.ts    # Permission matrix
│   └── guards.ts         # requireRole, requirePermission
├── lib/                  # Utilities
│   ├── session.ts        # KV session management
│   ├── oauth.ts          # Google OAuth helpers
│   ├── audit.ts          # Audit logging
│   ├── audited-db.ts     # auditedUpdate, auditedDelete
│   ├── pagination.ts     # Pagination helpers
│   └── errors.ts         # Custom error classes
└── db/                   # Database layer
    ├── client.ts         # D1 client factory
    ├── sql.ts            # SQL helpers (queryOne, queryAll, execute)
    ├── records.ts        # DB record types
    └── schema/           # SQL schema files
```

---

## Separation of Concerns

### What Goes Where

**Routes (OpenAPI Definitions):**
- Route path, method, tags
- Request/response schemas
- OpenAPI metadata
- **NO** implementation logic

**Handlers:**
- Extract validated input (`c.req.valid()`)
- Build ServiceContext
- Call services
- Format responses (`c.json()`)
- **NO** business logic
- **NO** direct SQL

**Services:**
- Business logic and rules
- Multi-tenant data filtering
- Audit integration
- Orchestrate database calls
- **NO** HTTP knowledge (Request/Response)
- **NO** Hono context

**Database Layer:**
- SQL queries via helpers
- Row mapping to domain types
- Audited operations
- **NO** business logic
- **NO** HTTP knowledge

### Example: User Update

**Route Definition:**
```typescript
// routes.ts
export const updateUserRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Users'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: UpdateUserSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: UserResponseSchema } } },
  },
})
```

**Handler:**
```typescript
// handlers.ts
export const updateUserHandler: RouteHandler<typeof updateUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')!

  const ctx: ServiceContext = {
    accountId: c.get('accountId') ?? '',
    user: c.get('user')!,
    // ...
  }

  const user = await usersService.update(db, ctx, id, data)
  return c.json({ data: user }, 200)
}
```

**Service:**
```typescript
// services/users.ts
async update(db: D1Database, ctx: ServiceContext, id: string, input: UpdateUserInput) {
  // Verify user exists and belongs to account
  await this.findById(db, ctx, id)

  // Build updates object
  const updates = {
    ...input,
    updated_at: new Date().toISOString(),
    updated_by_id: ctx.user.id,
  }

  // Audited update (logs changes automatically)
  const results = await auditedUpdate(db, ctx, 'users', updates, {
    clause: 'id = ?',
    params: [id]
  })

  return toUser(mapUserRow(results[0]))
}
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [routing-and-handlers.md](routing-and-handlers.md) - Routes and handlers details
- [services-layer.md](services-layer.md) - Service patterns
- [middleware-guide.md](middleware-guide.md) - Middleware details
