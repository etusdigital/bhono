# Hono Boilerplate Plan

This document outlines a plan to create a new backend boilerplate using Hono.js, preserving the core concepts from the NestJS boilerplate while leveraging Hono's lightweight, type-safe approach.

## Key Hono Features to Leverage

| Feature | Benefit |
|---------|---------|
| `@hono/zod-openapi` | Schema validation + auto-generated OpenAPI docs in one |
| `OpenAPIHono` | Extended Hono class with built-in OpenAPI support |
| `createRoute()` | Type-safe route definitions with request/response schemas |
| RPC mode | End-to-end type safety if frontend consumes the API |
| `createFactory()` | Centralized type definitions, reduces boilerplate |
| `c.set()`/`c.get()` | Built-in request-scoped context (replaces nestjs-cls) |
| JWT helper | Native JWT verify/sign/decode with multiple algorithms |

## Project Structure

```
src/
├── index.ts                 # Entry point with serve()
├── app.ts                   # OpenAPIHono app factory
├── env.ts                   # Zod schema for env validation
│
├── middleware/
│   ├── auth.ts              # JWT validation middleware
│   ├── account.ts           # account-id header + membership check
│   ├── request-context.ts   # Sets user, requestId, ip in context
│   └── error-handler.ts     # defaultHook for validation errors
│
├── routes/
│   ├── index.ts             # app.route() aggregation + OpenAPI doc
│   ├── users/
│   │   ├── index.ts         # OpenAPIHono sub-app
│   │   ├── routes.ts        # createRoute() definitions
│   │   ├── handlers.ts      # Handler implementations
│   │   └── schemas.ts       # Zod schemas with .openapi()
│   └── accounts/
│       └── ...
│
├── db/
│   ├── client.ts            # Drizzle client
│   ├── schema/
│   │   ├── users.ts
│   │   ├── accounts.ts
│   │   ├── user-accounts.ts
│   │   └── audit-logs.ts
│   ├── migrations/
│   └── seed.ts
│
├── services/
│   ├── users.ts             # Business logic
│   ├── accounts.ts
│   ├── audit.ts
│   └── identity-provider.ts # Auth0 abstraction
│
├── auth/
│   ├── permissions.ts       # Permission enum + matrix
│   ├── roles.ts             # Role enum + helpers
│   └── guards.ts            # requireRole(), requirePermission()
│
├── lib/
│   ├── pagination.ts        # Pagination helpers
│   ├── errors.ts            # Custom error classes
│   └── result.ts            # Result<T, E> type (optional)
│
└── types/
    └── index.ts             # Shared types, Env definition
```

## Core Dependencies

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "@hono/zod-openapi": "^0.x",
    "@hono/swagger-ui": "^0.x",
    "drizzle-orm": "^0.x",
    "better-sqlite3": "^11.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "drizzle-kit": "^0.x",
    "typescript": "^5.x",
    "@types/node": "^22.x",
    "@types/better-sqlite3": "^7.x"
  }
}
```

## Implementation Details

### 1. App Factory with Typed Environment

```typescript
// app.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'

export type Env = {
  Variables: {
    requestId: string
    user: User | null
    accountId: string
    userRole: Role | null
  }
}

export const createApp = () => {
  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({
          error: 'Validation Error',
          details: result.error.flatten()
        }, 400)
      }
    }
  })

  return app
}
```

### 2. Route Definitions with `createRoute()`

```typescript
// routes/users/routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import { UserSchema, CreateUserSchema } from './schemas'

export const listUsers = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(50),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PaginatedUsersSchema } },
      description: 'List of users',
    },
    401: { description: 'Unauthorized' },
  },
})

export const createUser = createRoute({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  middleware: [requireRole('ADMIN')],  // Inline guard
  request: {
    body: { content: { 'application/json': { schema: CreateUserSchema } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: UserSchema } },
      description: 'User created',
    },
  },
})
```

### 3. Schemas with OpenAPI Metadata

```typescript
// routes/users/schemas.ts
import { z } from '@hono/zod-openapi'

export const UserSchema = z.object({
  id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().openapi({ example: 'John Doe' }),
  status: z.enum(['active', 'inactive']).openapi({ example: 'active' }),
  isSuperAdmin: z.boolean().openapi({ example: false }),
  createdAt: z.string().datetime(),
}).openapi('User')

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  accountIds: z.array(z.string().uuid()).optional(),
}).openapi('CreateUserInput')
```

### 4. Handlers with Typed Context

```typescript
// routes/users/handlers.ts
import type { Context } from 'hono'
import type { Env } from '../../app'

export const handleListUsers = async (c: Context<Env>) => {
  const { page, limit } = c.req.valid('query')  // Typed from route schema
  const user = c.get('user')                    // From middleware
  const accountId = c.get('accountId')

  const result = await usersService.findAll({ page, limit, accountId })
  return c.json(result, 200)
}

export const handleCreateUser = async (c: Context<Env>) => {
  const body = c.req.valid('json')  // Typed as CreateUserSchema
  const actor = c.get('user')

  const user = await usersService.create(body, actor)
  return c.json(user, 201)
}
```

### 5. Route Module Assembly

```typescript
// routes/users/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { listUsers, createUser } from './routes'
import { handleListUsers, handleCreateUser } from './handlers'
import type { Env } from '../../app'

const users = new OpenAPIHono<Env>()

users.openapi(listUsers, handleListUsers)
users.openapi(createUser, handleCreateUser)

export { users }
```

### 6. Main App with Swagger UI

```typescript
// routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { users } from './users'
import { accounts } from './accounts'
import type { Env } from '../app'

const api = new OpenAPIHono<Env>()

api.route('/users', users)
api.route('/accounts', accounts)

// OpenAPI JSON endpoint
api.doc('/doc', {
  openapi: '3.1.0',
  info: { title: 'Etus API', version: '1.0.0' },
  security: [{ Bearer: [] }],
})

// Swagger UI
api.get('/docs', swaggerUI({ url: '/doc' }))

export { api }
```

### 7. Drizzle Schema (Preserving Entity Model)

```typescript
// db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).default('active'),
  providerIds: text('provider_ids', { mode: 'json' }).$type<string[]>().default([]),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).default(false),

  // Soft delete + audit fields
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
  createdById: text('created_by_id').references(() => users.id),
  updatedById: text('updated_by_id').references(() => users.id),
  deletedById: text('deleted_by_id').references(() => users.id),
})
```

```typescript
// db/schema/accounts.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  domain: text('domain').unique(),

  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
})
```

```typescript
// db/schema/user-accounts.ts
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { accounts } from './accounts'

export const userAccounts = sqliteTable('user_accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  role: text('role', {
    enum: ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS']
  }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.accountId] }),
}))
```

```typescript
// db/schema/audit-logs.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { accounts } from './accounts'

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id').notNull(),
  accountId: text('account_id').references(() => accounts.id),
  userId: text('user_id').references(() => users.id),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action', { enum: ['INSERT', 'UPDATE', 'DELETE'] }).notNull(),
  changes: text('changes', { mode: 'json' }).$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`),
})
```

### 8. Role Guard Middleware

```typescript
// auth/guards.ts
import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'
import { hasMinimumRole, Role } from './roles'

export const requireRole = (minRole: Role) => {
  return createMiddleware<Env>(async (c, next) => {
    const user = c.get('user')
    const userRole = c.get('userRole')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Super-admin bypass
    if (user.isSuperAdmin) {
      return next()
    }

    if (!userRole || !hasMinimumRole(userRole, minRole)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return next()
  })
}

export const requirePermission = (permission: Permission) => {
  return createMiddleware<Env>(async (c, next) => {
    const user = c.get('user')
    const userRole = c.get('userRole')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (user.isSuperAdmin) {
      return next()
    }

    if (!userRole || !hasPermission(userRole, permission)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return next()
  })
}
```

### 9. Roles and Permissions

```typescript
// auth/roles.ts
export const Role = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
  VIEWER: 'VIEWER',
  BILLING: 'BILLING',
  ANALYTICS: 'ANALYTICS',
} as const

export type Role = typeof Role[keyof typeof Role]

const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 0,
  MANAGER: 1,
  EDITOR: 2,
  AUTHOR: 3,
  VIEWER: 4,
  BILLING: -1,    // Non-hierarchical
  ANALYTICS: -1,  // Non-hierarchical
}

export const hasMinimumRole = (userRole: Role, requiredRole: Role): boolean => {
  const userLevel = ROLE_HIERARCHY[userRole]
  const requiredLevel = ROLE_HIERARCHY[requiredRole]

  // Non-hierarchical roles can only match exactly
  if (userLevel === -1 || requiredLevel === -1) {
    return userRole === requiredRole
  }

  return userLevel <= requiredLevel
}
```

```typescript
// auth/permissions.ts
export const Permission = {
  MANAGE_SYSTEM_SETTINGS: 'MANAGE_SYSTEM_SETTINGS',
  MANAGE_ALL_USERS: 'MANAGE_ALL_USERS',
  MANAGE_TEAM_USERS: 'MANAGE_TEAM_USERS',
  VIEW_ALL_USERS: 'VIEW_ALL_USERS',
  CREATE_CONTENT: 'CREATE_CONTENT',
  EDIT_ALL_CONTENT: 'EDIT_ALL_CONTENT',
  EDIT_OWN_CONTENT: 'EDIT_OWN_CONTENT',
  DELETE_CONTENT: 'DELETE_CONTENT',
  PUBLISH_CONTENT: 'PUBLISH_CONTENT',
  VIEW_CONTENT: 'VIEW_CONTENT',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  MANAGE_BILLING: 'MANAGE_BILLING',
  VIEW_BILLING: 'VIEW_BILLING',
} as const

export type Permission = typeof Permission[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    Permission.MANAGE_SYSTEM_SETTINGS,
    Permission.MANAGE_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
  ],
  MANAGER: [
    Permission.MANAGE_TEAM_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.VIEW_ANALYTICS,
  ],
  EDITOR: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
  ],
  AUTHOR: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.VIEW_CONTENT,
  ],
  VIEWER: [
    Permission.VIEW_CONTENT,
  ],
  BILLING: [
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
  ],
  ANALYTICS: [
    Permission.VIEW_ANALYTICS,
  ],
}

export const hasPermission = (role: Role, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
```

### 10. JWT Auth Middleware

```typescript
// middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import type { Env } from '../app'

export const jwtAuth = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    // For Auth0 with RS256, you'd use JWKS validation
    // This is simplified for HS256
    const payload = await verify(token, process.env.JWT_SECRET!)

    c.set('user', {
      id: payload.sub as string,
      email: payload.email as string,
      isSuperAdmin: payload.isSuperAdmin as boolean ?? false,
    })

    return next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
```

### 11. Account Middleware

```typescript
// middleware/account.ts
import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'
import { db } from '../db/client'
import { userAccounts } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export const accountMiddleware = createMiddleware<Env>(async (c, next) => {
  const accountId = c.req.header('account-id')
  const user = c.get('user')

  if (!accountId) {
    return c.json({ error: 'account-id header required' }, 400)
  }

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Super-admin can access any account
  if (user.isSuperAdmin) {
    c.set('accountId', accountId)
    c.set('userRole', 'ADMIN')  // Treat as admin for super-admin
    return next()
  }

  // Check user belongs to account
  const [membership] = await db
    .select()
    .from(userAccounts)
    .where(and(
      eq(userAccounts.userId, user.id),
      eq(userAccounts.accountId, accountId)
    ))
    .limit(1)

  if (!membership) {
    return c.json({ error: 'Forbidden: No access to this account' }, 403)
  }

  c.set('accountId', accountId)
  c.set('userRole', membership.role)

  return next()
})
```

### 12. Entry Point

```typescript
// index.ts
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { api } from './routes'
import { jwtAuth } from './middleware/auth'
import { accountMiddleware } from './middleware/account'
import { requestContext } from './middleware/request-context'

const app = createApp()

// Global middleware
app.use('*', requestContext)

// Protected routes
app.use('/users/*', jwtAuth, accountMiddleware)
app.use('/accounts/*', jwtAuth, accountMiddleware)

// Mount API routes
app.route('/', api)

// Health check (unprotected)
app.get('/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.PORT ?? '3000')

console.log(`Server running on http://localhost:${port}`)
console.log(`API docs available at http://localhost:${port}/docs`)

serve({ fetch: app.fetch, port })
```

## What's Preserved from NestJS Boilerplate

| Concept | Status | Notes |
|---------|--------|-------|
| Entity model (User, Account, UserAccount, AuditLog) | Preserved | Same fields and relationships |
| Multi-tenant via `account-id` header | Preserved | Same pattern |
| Role hierarchy + permissions | Preserved | Same logic, lighter implementation |
| Super-admin bypass | Preserved | Same behavior |
| Soft deletes | Preserved | Drizzle columns instead of TypeORM |
| Request context | Preserved | `c.set()`/`c.get()` instead of CLS |
| JWT auth flow | Preserved | Hono's native JWT helper |
| OpenAPI docs | Preserved | `@hono/zod-openapi` + Swagger UI |
| Validation | Preserved | Zod instead of class-validator |
| Pagination contract | Preserved | Same query params and response shape |

## What's Different

| Aspect | NestJS | Hono |
|--------|--------|------|
| Framework weight | Heavy (~50+ deps) | Lightweight (zero deps core) |
| Route definition | Decorators | `createRoute()` function |
| Dependency injection | Built-in DI container | Direct imports / factory functions |
| Validation | class-validator | Zod schemas |
| ORM | TypeORM | Drizzle ORM |
| Context passing | CLS (implicit) | `c.set()`/`c.get()` (explicit) |
| Modules | NestJS modules | File-based organization |
| Guards | Guard classes | Middleware functions |
| OpenAPI | @nestjs/swagger decorators | `@hono/zod-openapi` schemas |

---

# Architecture & System Design Patterns Reference

This section documents all architectural patterns from the NestJS boilerplate that MUST be preserved in any Hono implementation. Use this as the definitive reference for system design decisions.

---

## 1. Entity Design Patterns

### 1.1 Base Entity Hierarchy

The boilerplate uses a two-tier entity inheritance pattern for consistent temporal and audit fields:

```
SoftDeleteEntity (base)
├── createdAt: Date
├── updatedAt: Date
└── deletedAt: Date | null

InteractiveEntity (extends SoftDeleteEntity)
├── createdById: string | null
├── updatedById: string | null
└── deletedById: string | null
```

**Hono/Drizzle Implementation:**

```typescript
// lib/schema-helpers.ts
import { text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const softDeleteFields = {
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: text('deleted_at'),
}

export const interactiveFields = (usersTable: any) => ({
  ...softDeleteFields,
  createdById: text('created_by_id').references(() => usersTable.id),
  updatedById: text('updated_by_id').references(() => usersTable.id),
  deletedById: text('deleted_by_id').references(() => usersTable.id),
})
```

**Rules:**
- ALL entities must include `softDeleteFields` at minimum
- Entities that track user actions must include `interactiveFields`
- NEVER use hard deletes; always set `deletedAt`
- `updatedAt` must be updated on every modification

### 1.2 Soft Delete Pattern

**Implementation Requirements:**

1. Every query MUST filter out soft-deleted records:
```typescript
// Always include this in WHERE clauses
.where(isNull(table.deletedAt))
```

2. Delete operations set `deletedAt` instead of removing:
```typescript
await db
  .update(users)
  .set({
    deletedAt: new Date().toISOString(),
    deletedById: actor.id
  })
  .where(eq(users.id, id))
```

3. Unique constraints must account for soft deletes:
```typescript
// Use partial unique index (PostgreSQL) or application-level check
```

### 1.3 Entity Relationships

**User <-> Account (Many-to-Many via UserAccount):**

```
User (1) --> (M) UserAccount (M) <-- (1) Account
                    |
                    └── role: Role (per-account role)
```

**Key Characteristics:**
- A user can belong to multiple accounts
- Each user-account pair has its own role
- Composite primary key on (userId, accountId)
- CASCADE delete on both foreign keys

**Audit Log Relationships:**

```
AuditLog
├── accountId -> Account (which tenant)
├── userId -> User (who did it)
├── entity: string (what type)
├── entityId: string (which record)
└── changes: JSON (what changed)
```

---

## 2. Authentication & Authorization Architecture

### 2.1 Two-Tier Privilege System

The system uses TWO independent authorization layers:

**Tier 1: Account-Level Roles (via UserAccount table)**
- Stored per user-account relationship
- Hierarchical: ADMIN > MANAGER > EDITOR > AUTHOR > VIEWER
- Non-hierarchical: BILLING, ANALYTICS (special access only)

**Tier 2: System Admin (isSuperAdmin flag on User)**
- Boolean flag on User entity
- Bypasses ALL role and permission checks
- Bypasses account-id validation
- Access to all accounts without UserAccount entries
- Should be granted to 1-2 platform administrators only

### 2.2 Role Hierarchy

```typescript
const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 0,      // Highest privilege
  MANAGER: 1,
  EDITOR: 2,
  AUTHOR: 3,
  VIEWER: 4,     // Lowest privilege
  BILLING: -1,   // Non-hierarchical (special)
  ANALYTICS: -1, // Non-hierarchical (special)
}
```

**Hierarchy Rules:**
- Lower number = higher privilege
- ADMIN (0) has all permissions of MANAGER (1), EDITOR (2), etc.
- Non-hierarchical roles (-1) can ONLY be granted via `additionalRoles` option
- Non-hierarchical roles CANNOT access hierarchical endpoints

**Check Function:**

```typescript
function hasMinimumRole(
  userRole: Role,
  minimumRole: Role,
  additionalRoles: Role[] = []
): boolean {
  // Check additional roles first (for non-hierarchical access)
  if (additionalRoles.includes(userRole)) {
    return true
  }

  const userLevel = ROLE_HIERARCHY[userRole]
  const requiredLevel = ROLE_HIERARCHY[minimumRole]

  // Non-hierarchical roles can't access hierarchical endpoints
  if (userLevel === -1 || requiredLevel === -1) {
    return false
  }

  // Lower or equal level = higher or equal privilege
  return userLevel <= requiredLevel
}
```

### 2.3 Permission Matrix

Permissions are statically mapped to roles:

```typescript
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'MANAGE_TENANT_SETTINGS',
    'MANAGE_ALL_USERS',
    'MANAGE_TEAM_USERS',
    'CREATE_CONTENT',
    'EDIT_OWN_CONTENT',
    'EDIT_ANY_CONTENT',
    'PUBLISH_CONTENT',
    'UNPUBLISH_DELETE_CONTENT',
    'MANAGE_ASSETS',
    'MANAGE_CATEGORIES_TAGS',
    'MANAGE_COMMENTS',
    'VIEW_ALL_CONTENT',
    'VIEW_OWN_CONTENT',
    'VIEW_PUBLISHED_CONTENT',
    'VIEW_ANALYTICS',
    'EXPORT_REPORTS',
  ],
  MANAGER: [
    'MANAGE_TEAM_USERS',
    'CREATE_CONTENT',
    'EDIT_ANY_CONTENT',
    'PUBLISH_CONTENT',
    'MANAGE_ASSETS',
    'MANAGE_CATEGORIES_TAGS',
    'VIEW_ALL_CONTENT',
    'VIEW_ANALYTICS',
  ],
  EDITOR: [
    'CREATE_CONTENT',
    'EDIT_ANY_CONTENT',
    'PUBLISH_CONTENT',
    'MANAGE_ASSETS',
    'VIEW_ALL_CONTENT',
  ],
  AUTHOR: [
    'CREATE_CONTENT',
    'EDIT_OWN_CONTENT',
    'VIEW_OWN_CONTENT',
    'VIEW_PUBLISHED_CONTENT',
  ],
  VIEWER: [
    'VIEW_PUBLISHED_CONTENT',
  ],
  BILLING: [
    'MANAGE_BILLING',
    'VIEW_BILLING',
  ],
  ANALYTICS: [
    'VIEW_ANALYTICS',
    'EXPORT_REPORTS',
  ],
}
```

**Helper Functions:**

```typescript
function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}
```

### 2.4 JWT Validation Flow

```
Request with Authorization: Bearer <token>
    |
    v
┌─────────────────────────────────────┐
│ 1. Extract token from header        │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 2. Validate signature via JWKS      │
│    (RS256 with Auth0)               │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 3. Verify claims:                   │
│    - iss (issuer)                   │
│    - aud (audience)                 │
│    - exp (expiration)               │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 4. Extract user info from payload:  │
│    - sub (provider ID)              │
│    - email                          │
│    - custom claims (roles, perms)   │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 5. Fetch user from DB by providerID │
│    (includes userAccounts)          │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 6. Store user in request context    │
└─────────────────────────────────────┘
```

### 2.5 Super-Admin Bypass Mechanism

**When isSuperAdmin is true:**
1. Skip account-id header validation
2. Skip role hierarchy checks
3. Skip permission checks
4. Grant access to all accounts
5. Treat as ADMIN for audit purposes
6. Log with 'SYSTEM_ADMIN' marker

**Implementation:**

```typescript
// In account middleware
if (user.isSuperAdmin) {
  c.set('accountId', accountId)
  c.set('userRole', 'ADMIN')  // Treat as admin
  c.set('isSystemAdminAccess', true)  // Mark for audit
  return next()
}

// In role guard
if (user.isSuperAdmin) {
  return next()  // Bypass all checks
}
```

### 2.6 Middleware Execution Order

```
Request
    |
    v
┌─────────────────────────────────────┐
│ 1. requestContext middleware        │
│    - Generate transactionId (UUIDv7)│
│    - Capture IP, userAgent          │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 2. jwtAuth middleware               │
│    - Validate JWT                   │
│    - Fetch user from DB             │
│    - Set user in context            │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 3. accountMiddleware                │
│    - Validate account-id header     │
│    - Check user-account membership  │
│    - Set accountId, userRole        │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 4. requireRole() middleware         │
│    - Check role hierarchy           │
│    - Return 403 if insufficient     │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 5. Route Handler                    │
│    - Business logic                 │
└─────────────────────────────────────┘
    |
    v
┌─────────────────────────────────────┐
│ 6. Audit logging (on DB operations) │
│    - Capture changes with context   │
└─────────────────────────────────────┘
```

---

## 3. Multi-Tenancy Implementation

### 3.1 Account Isolation Strategy

**Core Principle:** Every database operation MUST be scoped to an accountId.

**Isolation Layers:**

1. **Header Level:** `account-id` header required on all protected endpoints
2. **Middleware Level:** Validate user has access to requested account
3. **Query Level:** All queries filtered by accountId
4. **Audit Level:** All changes logged with account context

### 3.2 Account-ID Header Flow

```
Client Request
    |
    ├── Header: account-id: <uuid>
    |
    v
┌─────────────────────────────────────┐
│ accountMiddleware                   │
│                                     │
│ 1. Extract account-id header        │
│ 2. If missing -> 400 Bad Request    │
│ 3. If super-admin -> allow any      │
│ 4. Query userAccounts table         │
│ 5. If no membership -> 403 Forbidden│
│ 6. Set accountId in context         │
│ 7. Set userRole from membership     │
└─────────────────────────────────────┘
```

### 3.3 Query Filtering Pattern

**Every service method must:**

1. Get accountId from context
2. Include accountId in WHERE clause
3. Filter out soft-deleted records

**Example:**

```typescript
async findAll(pagination: PaginationQuery) {
  const accountId = c.get('accountId')
  const user = c.get('user')

  // Super-admin sees all
  if (user.isSuperAdmin) {
    return db
      .select()
      .from(entities)
      .where(isNull(entities.deletedAt))
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit)
  }

  // Regular users filtered by account
  return db
    .select()
    .from(entities)
    .where(and(
      eq(entities.accountId, accountId),
      isNull(entities.deletedAt)
    ))
    .limit(pagination.limit)
    .offset((pagination.page - 1) * pagination.limit)
}
```

### 3.4 User-Account Relationship

**Schema:**

```typescript
userAccounts = sqliteTable('user_accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ROLES }).notNull().default('VIEWER'),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.accountId] }),
}))
```

**Key Points:**
- Composite primary key prevents duplicate assignments
- Role is stored PER relationship (user can be ADMIN in Account A, VIEWER in Account B)
- CASCADE delete on both sides
- No soft delete on junction table (delete means removal of access)

---

## 4. Audit System Design

### 4.1 Audit Log Structure

```typescript
auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id').notNull(),  // Groups related changes
  accountId: text('account_id').references(() => accounts.id),
  userId: text('user_id').references(() => users.id),
  entity: text('entity').notNull(),           // e.g., "User", "Account"
  entityId: text('entity_id').notNull(),      // Primary key of affected record
  action: text('action', { enum: ['INSERT', 'UPDATE', 'DELETE'] }).notNull(),
  changes: text('changes', { mode: 'json' }).$type<AuditChanges>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`).notNull(),
})
```

### 4.2 What Gets Captured

| Field | Source | Description |
|-------|--------|-------------|
| transactionId | UUIDv7 from context | Groups all changes in one request |
| accountId | Context | Which tenant was affected |
| userId | Context | Who made the change |
| entity | Table name | What type of record |
| entityId | Record PK | Which specific record |
| action | Operation type | INSERT, UPDATE, or DELETE |
| changes | JSON diff | What changed (for UPDATE) or full record (for INSERT/DELETE) |
| ipAddress | Request | Client IP for forensics |
| userAgent | Request | Client info for forensics |
| timestamp | Server | When it happened |

### 4.3 Audit Logging Implementation

Since Hono/Drizzle doesn't have TypeORM-style subscribers, implement audit logging via service layer:

```typescript
// lib/audit.ts
type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

interface AuditContext {
  transactionId: string
  accountId: string
  userId: string
  ipAddress: string
  userAgent: string
}

async function logAudit(
  ctx: AuditContext,
  entity: string,
  entityId: string,
  action: AuditAction,
  changes: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    transactionId: ctx.transactionId,
    accountId: ctx.accountId,
    userId: ctx.userId,
    entity,
    entityId,
    action,
    changes,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  })
}

// Usage in service
async function createUser(data: CreateUserInput, c: Context<Env>) {
  const [user] = await db.insert(users).values(data).returning()

  await logAudit(
    getAuditContext(c),
    'User',
    user.id,
    'INSERT',
    user
  )

  return user
}
```

### 4.4 Transaction ID Propagation

**UUIDv7 for sortability:**

```typescript
// middleware/request-context.ts
import { uuidv7 } from 'uuidv7'

export const requestContext = createMiddleware<Env>(async (c, next) => {
  c.set('transactionId', uuidv7())
  c.set('ip', c.req.header('x-forwarded-for') || 'unknown')
  c.set('userAgent', c.req.header('user-agent') || 'unknown')
  await next()
})
```

**Benefits of UUIDv7:**
- Time-ordered (sortable)
- Unique across requests
- Can group related audit entries
- Efficient for time-range queries

---

## 5. Request Context Management

### 5.1 Context Variables

The following must be available throughout the request lifecycle:

```typescript
type Env = {
  Variables: {
    // Request tracking
    transactionId: string        // UUIDv7 for audit correlation
    ip: string                   // Client IP
    userAgent: string            // Client user agent

    // Authentication
    user: User | null            // Full user entity from DB

    // Authorization
    accountId: string            // Current account context
    userRole: Role | null        // User's role in current account
    isSystemAdminAccess: boolean // Super-admin flag
  }
}
```

### 5.2 Context Flow

```
┌─────────────────────────────────────────────────────────────┐
│ requestContext middleware                                   │
│ Sets: transactionId, ip, userAgent                          │
└─────────────────────────────────────────────────────────────┘
                              |
                              v
┌─────────────────────────────────────────────────────────────┐
│ jwtAuth middleware                                          │
│ Sets: user (fetched from DB with userAccounts)              │
└─────────────────────────────────────────────────────────────┘
                              |
                              v
┌─────────────────────────────────────────────────────────────┐
│ accountMiddleware                                           │
│ Sets: accountId, userRole, isSystemAdminAccess              │
└─────────────────────────────────────────────────────────────┘
                              |
                              v
┌─────────────────────────────────────────────────────────────┐
│ Route Handler / Services                                    │
│ Reads: All context variables via c.get()                    │
└─────────────────────────────────────────────────────────────┘
                              |
                              v
┌─────────────────────────────────────────────────────────────┐
│ Audit Logging                                               │
│ Uses: transactionId, accountId, user.id, ip, userAgent      │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Accessing Context in Handlers

```typescript
// In route handlers
export const handleCreateUser = async (c: Context<Env>) => {
  const body = c.req.valid('json')

  // Access all context
  const user = c.get('user')              // Actor
  const accountId = c.get('accountId')    // Tenant
  const transactionId = c.get('transactionId')  // For audit

  // Pass to service
  const result = await usersService.create(body, {
    actor: user,
    accountId,
    transactionId,
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  })

  return c.json(result, 201)
}
```

---

## 6. API Design Patterns

### 6.1 Standard Endpoint Structure

Every resource should follow this pattern:

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /{resource} | MANAGER+ | List with pagination |
| GET | /{resource}/:id | MANAGER+ | Get single by ID |
| POST | /{resource} | ADMIN+ | Create new |
| PUT | /{resource}/:id | ADMIN+ | Update existing |
| DELETE | /{resource}/:id | ADMIN+ | Soft delete |

### 6.2 Pagination Contract

**Request Query Parameters:**

```typescript
const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  query: z.string().optional(),  // Search term
})
```

**Response Shape:**

```typescript
const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      currentPage: z.number(),
      limit: z.number(),
      totalItems: z.number(),
      totalPages: z.number(),
      hasPreviousPage: z.boolean(),
      hasNextPage: z.boolean(),
    }),
  })
```

**Helper Function:**

```typescript
function createPaginationMeta(
  totalItems: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit)
  return {
    currentPage: page,
    limit,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  }
}
```

### 6.3 Error Response Format

**Standard Error Shape:**

```typescript
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.unknown().optional(),
  statusCode: z.number(),
})
```

**HTTP Status Codes:**

| Code | Usage |
|------|-------|
| 400 | Validation errors, malformed request |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient role/permission |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate email) |
| 500 | Unexpected server error |

**Error Handler:**

```typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
      statusCode: err.status,
    }, err.status)
  }

  console.error(err)
  return c.json({
    error: 'Internal Server Error',
    statusCode: 500,
  }, 500)
})
```

### 6.4 OpenAPI Documentation

Every route must include:

```typescript
const createUserRoute = createRoute({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  summary: 'Create a new user',
  description: 'Creates a new user and sends Auth0 invitation',
  security: [{ Bearer: [] }],
  request: {
    headers: z.object({
      'account-id': z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': { schema: CreateUserSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: { 'application/json': { schema: UserSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden - insufficient role' },
    409: { description: 'User already exists' },
  },
})
```

---

## 7. Service Layer Patterns

### 7.1 Service Structure

Each service should:
- Accept context as parameter (not read from global)
- Handle business logic
- Call other services when needed
- Trigger audit logging

```typescript
// services/users.ts
export function createUsersService(db: Database) {
  return {
    async findAll(ctx: ServiceContext, pagination: PaginationQuery) {
      // Implementation
    },

    async findById(ctx: ServiceContext, id: string) {
      // Implementation
    },

    async create(ctx: ServiceContext, data: CreateUserInput) {
      // Implementation with audit logging
    },

    async update(ctx: ServiceContext, id: string, data: UpdateUserInput) {
      // Implementation with audit logging
    },

    async delete(ctx: ServiceContext, id: string) {
      // Soft delete with audit logging
    },
  }
}
```

### 7.2 Service Context

```typescript
interface ServiceContext {
  accountId: string
  user: User
  transactionId: string
  ip: string
  userAgent: string
}

function getServiceContext(c: Context<Env>): ServiceContext {
  return {
    accountId: c.get('accountId'),
    user: c.get('user')!,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}
```

### 7.3 External Service Integration

Abstract external services behind interfaces:

```typescript
// services/identity-provider.ts
interface IdentityProvider {
  sendInvitation(email: string, name: string): Promise<{ userId: string }>
  getUserByEmail(email: string): Promise<ExternalUser | null>
  deleteUser(userId: string): Promise<void>
}

// Implementation for Auth0
export function createAuth0Provider(config: Auth0Config): IdentityProvider {
  return {
    async sendInvitation(email, name) {
      // Auth0 Management API call
    },
    async getUserByEmail(email) {
      // Auth0 Management API call
    },
    async deleteUser(userId) {
      // Auth0 Management API call
    },
  }
}
```

---

## 8. Database Patterns

### 8.1 Migration Strategy

**Rules:**
- NEVER use auto-sync/synchronize in production
- Every schema change requires a migration
- Migrations must be reversible (up and down)
- Test migrations on a copy of production data

**Drizzle Migration Commands:**

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Drop all and recreate (dev only!)
pnpm drizzle-kit push
```

### 8.2 Seed Data

**Structure:**

```typescript
// db/seed.ts
async function seed() {
  // 1. Create default account
  const [account] = await db.insert(accounts).values({
    name: 'Default',
    domain: 'default.local',
  }).returning()

  // 2. Create super admin user
  const [superAdmin] = await db.insert(users).values({
    email: 'admin@example.com',
    name: 'Super Admin',
    isSuperAdmin: true,
    status: 'active',
  }).returning()

  // 3. Create test users with different roles
  const testUsers = [
    { email: 'manager@example.com', role: 'MANAGER' },
    { email: 'editor@example.com', role: 'EDITOR' },
    { email: 'viewer@example.com', role: 'VIEWER' },
  ]

  for (const { email, role } of testUsers) {
    const [user] = await db.insert(users).values({
      email,
      name: email.split('@')[0],
      status: 'active',
    }).returning()

    await db.insert(userAccounts).values({
      userId: user.id,
      accountId: account.id,
      role,
    })
  }
}
```

### 8.3 Query Patterns

**Always Include:**

```typescript
// 1. Account filtering (for multi-tenant queries)
.where(eq(table.accountId, ctx.accountId))

// 2. Soft delete filtering
.where(isNull(table.deletedAt))

// 3. Combined
.where(and(
  eq(table.accountId, ctx.accountId),
  isNull(table.deletedAt)
))
```

**Pagination:**

```typescript
async function findWithPagination<T>(
  query: SelectQueryBuilder<T>,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit

  const [data, countResult] = await Promise.all([
    query.limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(query.as('subquery')),
  ])

  return {
    data,
    meta: createPaginationMeta(countResult[0].count, page, limit),
  }
}
```

---

## 9. Security Patterns Summary

### 9.1 Defense in Depth

| Layer | Protection | Implementation |
|-------|------------|----------------|
| Network | HTTPS only | Infrastructure |
| Header | account-id required | accountMiddleware |
| Token | JWT validation | jwtAuth middleware |
| Membership | User-account check | accountMiddleware |
| Role | Hierarchy check | requireRole middleware |
| Permission | Granular check | requirePermission middleware |
| Query | Account filtering | Service layer |
| Audit | Change logging | Audit service |

### 9.2 Input Validation

- ALL input validated via Zod schemas
- Schemas defined once, used for validation AND OpenAPI docs
- Whitelist approach (reject unknown fields)
- Type coercion handled by Zod

### 9.3 SQL Injection Prevention

- NEVER use string concatenation for queries
- Always use Drizzle's parameterized queries
- Use `sql` template literal for raw SQL

```typescript
// GOOD
db.select().from(users).where(eq(users.email, email))

// GOOD (when raw SQL needed)
db.execute(sql`SELECT * FROM users WHERE email = ${email}`)

// BAD - Never do this
db.execute(`SELECT * FROM users WHERE email = '${email}'`)
```

---

## 10. Configuration & Environment

### 10.1 Required Environment Variables

```typescript
// env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().default('db.sqlite'),

  // Auth0
  JWKS_URI: z.string().url(),
  IDP_ISSUER: z.string().url(),
  IDP_AUDIENCE: z.string(),
  AUTH0_DOMAIN: z.string(),
  AUTH0_CLIENT_ID: z.string(),
  AUTH0_CLIENT_SECRET: z.string(),
  AUTH0_ROLES_CLAIM: z.string().default('https://app.example.com/roles'),

  // Optional
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = envSchema.parse(process.env)
```

### 10.2 Startup Validation

```typescript
// index.ts
import { env } from './env'  // Throws if invalid

// Only reached if env is valid
console.log(`Starting server on port ${env.PORT}...`)
```

---

## 11. Quick Reference: Pattern Mapping

| NestJS Pattern | Hono Equivalent |
|----------------|-----------------|
| `@Controller()` | `new OpenAPIHono()` sub-app |
| `@Get()`, `@Post()`, etc. | `createRoute()` + `app.openapi()` |
| `@UseGuards(JwtAuthGuard)` | `jwtAuth` middleware |
| `@MinRole(Role.ADMIN)` | `requireRole('ADMIN')` middleware |
| `@Body() dto: CreateDto` | `c.req.valid('json')` with Zod schema |
| `@Param('id')` | `c.req.valid('param').id` |
| `@Query() query: PaginationDto` | `c.req.valid('query')` |
| `ClsService.get('user')` | `c.get('user')` |
| `@InjectRepository(User)` | Direct import of `db` client |
| TypeORM `Repository` | Drizzle query builder |
| `class-validator` decorators | Zod schema methods |
| `@ApiProperty()` | `.openapi({ example: ... })` |
| `@ApiTags('users')` | `tags: ['Users']` in route |
| TypeORM subscriber | Manual audit logging in service |

---

## References

- [Hono Documentation](https://hono.dev/docs/)
- [Zod OpenAPI Example](https://hono.dev/examples/zod-openapi)
- [@hono/zod-openapi](https://www.npmjs.com/package/@hono/zod-openapi)
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)
- [Hono JWT Helper](https://hono.dev/docs/helpers/jwt)
- [Hono Node.js Guide](https://hono.dev/docs/getting-started/nodejs)
- [Drizzle ORM](https://orm.drizzle.team/)
