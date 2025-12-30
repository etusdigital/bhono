# Implementation: Boilerplate Features (Revised)

**Date:** 2025-12-24
**Last Updated:** 2025-12-30
**Status:** Phase 1 Ready (Health Checks + Restore)
**Design Doc:** `2025-12-24-advanced-features-design.md`

## Feature Scope Analysis

This document was revised to distinguish between **necessary boilerplate features** and **overengineering** based on production requirements.

### 🎯 Current Scope: Phase 1 ONLY

| Feature | Status | Why |
|---------|--------|-----|
| **Health Checks** | ✅ IMPLEMENTING | Essential for Kubernetes/monitoring/load balancers |
| **Soft Delete Recovery** | ✅ IMPLEMENTING | Complements existing soft delete, adds value |
| **Advanced Search** | ❌ DEFERRED | MVP needs basic search only |
| **Bulk Operations** | ❌ DEFERRED | Premature optimization, implement on demand |
| **Data Export** | ❌ DEFERRED | Implement when stakeholders request it |
| **Image Processing** | ❌ DEFERRED | Domain-specific, not all projects need it |
| **API Versioning** | ❌ DEFERRED | Antipattern - version when you have breaking changes |

### Why We're Trimming Scope

A boilerplate should be **lean** and serve all projects equally:
- ✅ Auth, RBAC, audit logging, soft delete, pagination
- ❌ Domain-specific features (avatars, complex exports, versioning)
- ❌ Premature optimization (bulk ops, advanced query builders)

See **Future Features** section below for when to add these.

---

## Phase 1: Foundation

### 1.1 Health Checks

#### Step 1: Create Health Routes

**File:** `src/server/routes/health/routes.ts`

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { createRoute } from '@hono/zod-openapi'
import type { Context } from 'hono'
import type { Env } from '../../types'

const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  checks: z.object({
    database: z.enum(['up', 'down']),
    storage: z.enum(['up', 'down'])
  }),
  uptime: z.number()
}).openapi('HealthResponse')

const ReadyResponseSchema = z.object({
  ready: z.boolean()
}).openapi('ReadyResponse')

const LiveResponseSchema = z.object({
  alive: z.boolean()
}).openapi('LiveResponse')

// Route definitions
export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Overall health check',
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponseSchema } },
      description: 'System health status'
    }
  }
})

export const readyRoute = createRoute({
  method: 'get',
  path: '/health/ready',
  tags: ['Health'],
  summary: 'Readiness check',
  responses: {
    200: {
      content: { 'application/json': { schema: ReadyResponseSchema } },
      description: 'System is ready'
    },
    503: {
      content: { 'application/json': { schema: ReadyResponseSchema } },
      description: 'System is not ready'
    }
  }
})

export const liveRoute = createRoute({
  method: 'get',
  path: '/health/live',
  tags: ['Health'],
  summary: 'Liveness check',
  responses: {
    200: {
      content: { 'application/json': { schema: LiveResponseSchema } },
      description: 'System is alive'
    }
  }
})
```

#### Step 2: Create Health Handlers

**File:** `src/server/routes/health/handlers.ts`

```typescript
import type { Context } from 'hono'
import type { Env } from '../../types'
import { sql } from 'drizzle-orm'

async function checkDatabase(c: Context<Env>): Promise<'up' | 'down'> {
  try {
    const db = c.get('db')
    await db.execute(sql`SELECT 1`)
    return 'up'
  } catch {
    return 'down'
  }
}

async function checkStorage(c: Context<Env>): Promise<'up' | 'down'> {
  try {
    // Test R2 access
    const r2 = c.env.R2
    await r2.list({ limit: 1 })
    return 'up'
  } catch {
    return 'down'
  }
}

export const handleHealth = async (c: Context<Env>) => {
  const startTime = Date.now()

  // Run checks with timeout
  const checkPromises = [
    Promise.race([
      checkDatabase(c),
      new Promise<'down'>((resolve) => setTimeout(() => resolve('down'), 5000))
    ]),
    Promise.race([
      checkStorage(c),
      new Promise<'down'>((resolve) => setTimeout(() => resolve('down'), 5000))
    ])
  ]

  const [database, storage] = await Promise.all(checkPromises)

  const status = database === 'up' && storage === 'up' ? 'healthy' : 'unhealthy'

  const response = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      storage
    },
    uptime: Math.floor(process.uptime())
  }

  const statusCode = status === 'healthy' ? 200 : 503

  return c.json(response, statusCode)
}

export const handleReady = async (c: Context<Env>) => {
  try {
    const dbStatus = await Promise.race([
      checkDatabase(c),
      new Promise<'down'>((resolve) => setTimeout(() => resolve('down'), 5000))
    ])

    if (dbStatus === 'up') {
      return c.json({ ready: true }, 200)
    } else {
      return c.json({ ready: false }, 503)
    }
  } catch {
    return c.json({ ready: false }, 503)
  }
}

export const handleLive = (c: Context<Env>) => {
  return c.json({ alive: true }, 200)
}
```

#### Step 3: Create Health Index

**File:** `src/server/routes/health/index.ts`

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types'
import { healthRoute, readyRoute, liveRoute } from './routes'
import { handleHealth, handleReady, handleLive } from './handlers'

const health = new OpenAPIHono<Env>()

health.openapi(healthRoute, handleHealth)
health.openapi(readyRoute, handleReady)
health.openapi(liveRoute, handleLive)

export { health }
```

#### Step 4: Mount Health Routes

**File:** `src/server/routes/index.ts` (modify)

```typescript
import { health } from './health'

// ... existing code ...

// Mount health routes (no auth required)
api.route('/', health)

// ... rest of routes ...
```

#### Step 5: Test Health Endpoints

```bash
# Test health
curl http://localhost:5173/health

# Test ready
curl http://localhost:5173/health/ready

# Test live
curl http://localhost:5173/health/live
```

---

### 1.2 Soft Delete Recovery

#### Step 1: Add Restore Method to Services

**File:** `src/server/services/users.ts` (add method)

```typescript
import { isNotNull } from 'drizzle-orm'

async restore(ctx: ServiceContext, id: string) {
  const db = ctx.db

  // 1. Find deleted record
  const [record] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.id, id),
      eq(users.accountId, ctx.accountId),
      isNotNull(users.deletedAt)
    ))
    .limit(1)

  if (!record) {
    throw new NotFoundError('User not found or not deleted')
  }

  // 2. Restore
  const [restored] = await db
    .update(users)
    .set({
      deletedAt: null,
      deletedById: null,
      updatedAt: new Date().toISOString(),
      updatedById: ctx.user.id
    })
    .where(eq(users.id, id))
    .returning()

  // 3. Audit log
  await logAudit(db, {
    transactionId: ctx.transactionId,
    accountId: ctx.accountId,
    userId: ctx.user.id,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent
  }, 'User', id, 'UPDATE', {
    deletedAt: { from: record.deletedAt, to: null },
    deletedById: { from: record.deletedById, to: null }
  })

  return restored
}
```

**File:** `src/server/services/accounts.ts` (add method)

```typescript
async restore(ctx: ServiceContext, id: string) {
  const db = ctx.db

  const [record] = await db
    .select()
    .from(accounts)
    .where(and(
      eq(accounts.id, id),
      isNotNull(accounts.deletedAt)
    ))
    .limit(1)

  if (!record) {
    throw new NotFoundError('Account not found or not deleted')
  }

  // Super admin only for accounts
  if (!ctx.user.isSuperAdmin) {
    throw new ForbiddenError('Only super admins can restore accounts')
  }

  const [restored] = await db
    .update(accounts)
    .set({
      deletedAt: null,
      deletedById: null,
      updatedAt: new Date().toISOString(),
      updatedById: ctx.user.id
    })
    .where(eq(accounts.id, id))
    .returning()

  await logAudit(db, {
    transactionId: ctx.transactionId,
    accountId: id,
    userId: ctx.user.id,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent
  }, 'Account', id, 'UPDATE', {
    deletedAt: { from: record.deletedAt, to: null }
  })

  return restored
}
```

#### Step 2: Add Restore Routes

**File:** `src/server/routes/users/routes.ts` (add route)

```typescript
export const restoreUser = createRoute({
  method: 'post',
  path: '/users/{id}/restore',
  tags: ['Users'],
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserSchema } },
      description: 'User restored successfully'
    },
    404: {
      description: 'User not found or not deleted'
    },
    403: {
      description: 'Forbidden - insufficient role'
    }
  }
})
```

**File:** `src/server/routes/accounts/routes.ts` (add route)

```typescript
export const restoreAccount = createRoute({
  method: 'post',
  path: '/accounts/{id}/restore',
  tags: ['Accounts'],
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AccountSchema } },
      description: 'Account restored successfully'
    },
    404: {
      description: 'Account not found or not deleted'
    },
    403: {
      description: 'Forbidden - only super admins'
    }
  }
})
```

#### Step 3: Add Restore Handlers

**File:** `src/server/routes/users/handlers.ts` (add handler)

```typescript
import { requireRole } from '../../auth/guards'

export const handleRestore = async (c: Context<Env>) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  const user = await usersService.restore(ctx, id)

  return c.json(user, 200)
}
```

**File:** `src/server/routes/accounts/handlers.ts` (add handler)

```typescript
export const handleRestore = async (c: Context<Env>) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  const account = await accountsService.restore(ctx, id)

  return c.json(account, 200)
}
```

#### Step 4: Mount Restore Routes

**File:** `src/server/routes/users/index.ts` (add route)

```typescript
import { requireRole } from '../../auth/guards'

users.openapi(restoreUser, requireRole('ADMIN'), handleRestore)
```

**File:** `src/server/routes/accounts/index.ts` (add route)

```typescript
accounts.openapi(restoreAccount, handleRestore)  // Super admin check in service
```

#### Step 5: Test Restore

```bash
# Delete a user
curl -X DELETE http://localhost:5173/users/USER_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "account-id: ACCOUNT_ID"

# Restore the user
curl -X POST http://localhost:5173/users/USER_ID/restore \
  -H "Authorization: Bearer TOKEN" \
  -H "account-id: ACCOUNT_ID"
```

---

## Future Features (Deferred)

These features should be implemented when project requirements demand them, not as part of the boilerplate:

### Phase 2: Data Operations (Deferred)
**When to implement:** When you need complex filtering or bulk operations
- Advanced Search/Filtering with query builders
- Bulk Operations (create, update, delete)

### Phase 3: Export & Uploads (Deferred)
**When to implement:** When stakeholders request data export or file handling is project-specific
- Data Export (CSV, XLSX, JSON)
- File Upload with Image Processing

### Phase 4: API Versioning (Deferred)
**When to implement:** Only when you have actual breaking changes to introduce
- API versioning (v1, v2 structure)

**Note:** Current basic file upload (R2 storage) is sufficient for boilerplate.

---

## Implementation Checklist

### Phase 1: Foundation (Now)

- [ ] **1.1 Health Checks**
  - [ ] Create health routes (routes.ts)
  - [ ] Create health handlers (handlers.ts)
  - [ ] Create health index (index.ts)
  - [ ] Mount health routes in api
  - [ ] Test health endpoints

- [ ] **1.2 Soft Delete Recovery**
  - [ ] Add restore method to Users service
  - [ ] Add restore method to Accounts service
  - [ ] Add restore route to Users
  - [ ] Add restore route to Accounts
  - [ ] Add restore handler to Users
  - [ ] Add restore handler to Accounts
  - [ ] Mount restore routes
  - [ ] Test restore endpoints

### Testing Checklist (Phase 1)

Health Checks:
- [ ] `/health` responds with status and checks
- [ ] `/health/ready` returns 200 when DB is up
- [ ] `/health/ready` returns 503 when DB is down
- [ ] `/health/live` responds immediately
- [ ] Health checks timeout after 5 seconds

Restore:
- [ ] Restore works for soft-deleted users
- [ ] Restore works for soft-deleted accounts
- [ ] Restore fails for non-deleted records
- [ ] Restore requires ADMIN role (users)
- [ ] Restore requires super admin (accounts)
- [ ] Audit logs created for restore

---

## ~~Phase 2: Data Operations~~ (DEFERRED)

Details available in `/docs/plans/2025-12-24-advanced-features-design.md` for when you need them.

---

## ~~Phase 3: Export & Uploads~~ (DEFERRED)

Details available in `/docs/plans/2025-12-24-advanced-features-design.md` for when you need them.

---

## ~~Phase 4: API Versioning~~ (DEFERRED)

Details available in `/docs/plans/2025-12-24-advanced-features-design.md` for when you need them.

---

## Success Criteria (Phase 1)

✅ All health check endpoints responding correctly
✅ Restore functionality working for both users and accounts
✅ Proper role-based access control enforced
✅ Audit logs created for all restore operations
✅ All tests passing
✅ OpenAPI documentation updated
