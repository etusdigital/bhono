# Auth and Guards - RBAC for Multi-Tenant Access

Complete guide to authentication, authorization, and role-based access control (RBAC).

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [Role System](#role-system)
- [Permission System](#permission-system)
- [Guards](#guards)
- [Multi-Tenancy](#multi-tenancy)
- [Super-Admin Access](#super-admin-access)
- [Common Patterns](#common-patterns)

---

## Overview

### Auth Architecture

```
User authenticates
    ↓
Session created in KV
    ↓
sessionAuth middleware validates session
    ↓
accountMiddleware resolves account + role
    ↓
Guards check role/permission per route
    ↓
Handler executes with ServiceContext
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Session** | Cookie-based, stored in Cloudflare KV |
| **User** | Global identity across all accounts |
| **Account** | Tenant/workspace (multi-tenancy) |
| **Role** | User's role within a specific account |
| **Permission** | Specific action allowed by a role |
| **Super-Admin** | System-wide admin (`isSuperAdmin` flag) |

---

## Authentication Flow

### OAuth Login Flow

```
1. User visits /auth/login
    ↓
2. Redirect to Google OAuth
    ↓
3. Google redirects to /auth/callback
    ↓
4. Create/update user in database
    ↓
5. Create session in KV
    ↓
6. Set session cookie (__Host-sid)
    ↓
7. Redirect to app
```

### Session Cookie

```typescript
// Cookie name (secure prefix)
const COOKIE_NAME = '__Host-sid'

// Cookie options
{
  httpOnly: true,      // Not accessible via JS
  secure: true,        // HTTPS only
  sameSite: 'Lax',     // CSRF protection
  path: '/',           // Available site-wide
  maxAge: 86400 * 30,  // 30 days
}
```

### Session Data Structure

```typescript
interface SessionData {
  userId: string
  email: string
  createdAt: number
  expiresAt: number
}
```

---

## Role System

### Available Roles

```typescript
// src/server/auth/roles.ts
export const Role = {
  ADMIN: 'ADMIN',       // Account administrator
  MANAGER: 'MANAGER',   // Team manager
  EDITOR: 'EDITOR',     // Content editor
  AUTHOR: 'AUTHOR',     // Content creator
  VIEWER: 'VIEWER',     // Read-only access
  BILLING: 'BILLING',   // Billing access only
  ANALYTICS: 'ANALYTICS', // Analytics access only
} as const

export type Role = (typeof Role)[keyof typeof Role]
```

### Role Hierarchy

Hierarchical roles (lower number = higher privilege):

```
ADMIN (0)     - Full account control
    ↓
MANAGER (1)   - Team and workflow management
    ↓
EDITOR (2)    - Edit and publish any content
    ↓
AUTHOR (3)    - Create and edit own content
    ↓
VIEWER (4)    - Read-only access
```

Non-hierarchical roles (level -1):

```
BILLING       - Billing/subscription only
ANALYTICS     - Analytics/reports only
```

### Role Hierarchy Logic

```typescript
// src/server/auth/roles.ts
export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 0,
  MANAGER: 1,
  EDITOR: 2,
  AUTHOR: 3,
  VIEWER: 4,
  BILLING: -1,    // Non-hierarchical
  ANALYTICS: -1,  // Non-hierarchical
}

export function hasMinimumRole(
  userRole: Role,
  requiredRole: Role,
  additionalRoles: Role[] = []
): boolean {
  // Check additional roles first (for non-hierarchical access)
  if (additionalRoles.includes(userRole)) {
    return true
  }

  const userLevel = ROLE_HIERARCHY[userRole]
  const requiredLevel = ROLE_HIERARCHY[requiredRole]

  // Non-hierarchical roles can only match exactly
  if (userLevel === -1 || requiredLevel === -1) {
    return userRole === requiredRole
  }

  // Lower level = higher privilege
  return userLevel <= requiredLevel
}
```

### Role Checks

```typescript
import { hasMinimumRole, isHierarchicalRole } from '@server/auth/roles'

// Check hierarchical access
hasMinimumRole('EDITOR', 'VIEWER')     // true (EDITOR > VIEWER)
hasMinimumRole('VIEWER', 'EDITOR')     // false (VIEWER < EDITOR)
hasMinimumRole('ADMIN', 'VIEWER')      // true (ADMIN > all)

// Non-hierarchical roles only match exactly
hasMinimumRole('BILLING', 'VIEWER')    // false
hasMinimumRole('BILLING', 'BILLING')   // true

// Allow additional roles
hasMinimumRole('BILLING', 'VIEWER', ['BILLING'])  // true
```

---

## Permission System

### Available Permissions

```typescript
// src/server/auth/permissions.ts
export const Permission = {
  // System Management
  MANAGE_SYSTEM_SETTINGS: 'MANAGE_SYSTEM_SETTINGS',

  // Tenant/Organization Management
  MANAGE_TENANT_SETTINGS: 'MANAGE_TENANT_SETTINGS',

  // User & Role Management
  MANAGE_ALL_USERS: 'MANAGE_ALL_USERS',
  MANAGE_TEAM_USERS: 'MANAGE_TEAM_USERS',
  VIEW_ALL_USERS: 'VIEW_ALL_USERS',

  // Billing & Subscription Management
  MANAGE_BILLING: 'MANAGE_BILLING',
  VIEW_BILLING: 'VIEW_BILLING',

  // Content Management
  CREATE_CONTENT: 'CREATE_CONTENT',
  EDIT_OWN_CONTENT: 'EDIT_OWN_CONTENT',
  EDIT_ALL_CONTENT: 'EDIT_ALL_CONTENT',
  PUBLISH_CONTENT: 'PUBLISH_CONTENT',
  UNPUBLISH_CONTENT: 'UNPUBLISH_CONTENT',
  DELETE_CONTENT: 'DELETE_CONTENT',

  // Media/Assets Management
  MANAGE_ASSETS: 'MANAGE_ASSETS',

  // Categories/Tags Management
  MANAGE_CATEGORIES_TAGS: 'MANAGE_CATEGORIES_TAGS',

  // Comments/Community Management
  MANAGE_COMMENTS: 'MANAGE_COMMENTS',

  // Content Viewing
  VIEW_CONTENT: 'VIEW_CONTENT',
  VIEW_OWN_CONTENT: 'VIEW_OWN_CONTENT',
  VIEW_PUBLISHED_CONTENT: 'VIEW_PUBLISHED_CONTENT',

  // Analytics & Reports
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  EXPORT_REPORTS: 'EXPORT_REPORTS',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]
```

### Role-Permission Matrix

| Role | Key Permissions |
|------|-----------------|
| ADMIN | All permissions except MANAGE_SYSTEM_SETTINGS |
| MANAGER | Team management, all content, analytics |
| EDITOR | All content operations |
| AUTHOR | Create/edit own content only |
| VIEWER | View published content only |
| BILLING | MANAGE_BILLING, VIEW_BILLING only |
| ANALYTICS | VIEW_ANALYTICS, EXPORT_REPORTS only |

### Permission Checks

```typescript
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@server/auth/permissions'

// Single permission
hasPermission('EDITOR', 'PUBLISH_CONTENT')  // true
hasPermission('AUTHOR', 'PUBLISH_CONTENT')  // false

// Any permission (OR logic)
hasAnyPermission('AUTHOR', ['CREATE_CONTENT', 'PUBLISH_CONTENT'])  // true

// All permissions (AND logic)
hasAllPermissions('ADMIN', ['MANAGE_ALL_USERS', 'MANAGE_BILLING'])  // true
```

---

## Guards

### Location

Guards are middleware that protect routes based on role or permission.

```
src/server/auth/guards.ts
```

### requireRole Guard

Requires minimum role level:

```typescript
// src/server/auth/guards.ts
export const requireRole = (minRole: Role, additionalRoles: Role[] = []) => {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, {
        message: 'Unauthorized: User not authenticated',
      })
    }

    // Super-admin bypass
    if (c.get('isSystemAdminAccess')) {
      await next()
      return
    }

    const userRole = c.get('userRole')

    if (!userRole) {
      throw new HTTPException(403, {
        message: 'Forbidden: No role assigned for this account',
      })
    }

    if (!hasMinimumRole(userRole, minRole, additionalRoles)) {
      throw new HTTPException(403, {
        message: `Forbidden: Requires ${minRole} role or higher`,
      })
    }

    await next()
  })
}
```

### requirePermission Guard

Requires specific permission:

```typescript
export const requirePermission = (permission: Permission) => {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    // Super-admin bypass
    if (c.get('isSystemAdminAccess')) {
      await next()
      return
    }

    const userRole = c.get('userRole')

    if (!userRole) {
      throw new HTTPException(403, { message: 'No role assigned' })
    }

    if (!hasPermission(userRole, permission)) {
      throw new HTTPException(403, {
        message: `Forbidden: Requires ${permission} permission`,
      })
    }

    await next()
  })
}
```

### Applying Guards to Routes

```typescript
// src/server/routes/users/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { requireRole, requirePermission } from '@server/auth/guards'
import { toHonoPath } from '../openapi'

const users = new OpenAPIHono<HonoEnv>()

// Public route (within API - auth required via parent)
users.openapi(getUserRoute, getUserHandler)

// Requires MANAGER role
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Requires ADMIN role
users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)

// Requires specific permission
users.use('/bulk', requirePermission('MANAGE_ALL_USERS'))
users.openapi(bulkUpdateRoute, bulkUpdateHandler)

// Requires VIEWER + additional non-hierarchical role
users.use('/billing', requireRole('VIEWER', ['BILLING']))
users.openapi(billingRoute, billingHandler)
```

---

## Multi-Tenancy

### Account Header

Every API request requires `account-id` header:

```http
GET /api/users HTTP/1.1
account-id: 550e8400-e29b-41d4-a716-446655440000
```

### User-Account Relationship

Users can belong to multiple accounts with different roles:

```sql
-- user_accounts table
CREATE TABLE user_accounts (
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, account_id)
);
```

### Account Middleware Flow

```typescript
// src/server/middleware/account.ts
export const accountMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  // 1. Require account-id header
  const accountId = c.req.header('account-id')
  if (!accountId) {
    throw new HTTPException(400, { message: 'Missing account-id header' })
  }

  const user = c.get('user')

  // 2. Super-admin bypass
  if (user?.isSuperAdmin) {
    c.set('accountId', accountId)
    c.set('userRole', 'ADMIN')
    c.set('isSystemAdminAccess', true)
    await next()
    return
  }

  // 3. Check user-account membership
  const membership = await queryOne(db,
    `SELECT role FROM user_accounts
     WHERE user_id = ? AND account_id = ? LIMIT 1`,
    [user!.id, accountId]
  )

  if (!membership) {
    throw new HTTPException(403, {
      message: 'User does not have access to this account',
    })
  }

  // 4. Set context
  c.set('accountId', accountId)
  c.set('userRole', membership.role)
  c.set('isSystemAdminAccess', false)

  await next()
})
```

### Multi-Tenancy in Services

Services use `ctx.accountId` for data filtering:

```typescript
// services/products.ts
async function findAll(db: D1Database, ctx: ServiceContext, pagination: PaginationQuery) {
  const whereClauses: string[] = ['deleted_at IS NULL']
  const params: SqlParams = []

  // Multi-tenant filtering
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('account_id = ?')
    params.push(ctx.accountId)
  }

  // ... rest of query
}
```

---

## Super-Admin Access

### isSuperAdmin Flag

Super-admins are marked by `isSuperAdmin` flag on the user record:

```sql
-- users table
is_super_admin INTEGER NOT NULL DEFAULT 0
```

### Super-Admin Privileges

- **Bypass all guards** - No role/permission checks
- **Access any account** - Can use any account-id header
- **Full data visibility** - No tenant filtering in queries
- **System settings** - Only super-admins have MANAGE_SYSTEM_SETTINGS

### Detecting Super-Admin Access

```typescript
// In middleware
if (user.isSuperAdmin) {
  c.set('isSystemAdminAccess', true)
  // ...
}

// In services
if (ctx.user.isSuperAdmin) {
  // Skip tenant filtering
}

// In handlers
const isSystemAdmin = c.get('isSystemAdminAccess')
```

---

## Common Patterns

### Building ServiceContext

```typescript
// handlers.ts
const ctx: ServiceContext = {
  accountId: c.get('accountId') ?? '',
  user: c.get('user')!,
  userRole: c.get('userRole'),
  transactionId: c.get('transactionId'),
  ip: c.get('ip'),
  userAgent: c.get('userAgent'),
}
```

### Role-Based Business Logic

```typescript
// In service
async function canEditContent(ctx: ServiceContext, contentOwnerId: string): boolean {
  // Super-admin can edit anything
  if (ctx.user.isSuperAdmin) return true

  // Check role-based permissions
  if (!ctx.userRole) return false

  // EDITOR+ can edit all content
  if (hasMinimumRole(ctx.userRole, 'EDITOR')) return true

  // AUTHOR can only edit own content
  if (ctx.userRole === 'AUTHOR' && contentOwnerId === ctx.user.id) return true

  return false
}
```

### Conditional Data Access

```typescript
async function findAll(db: D1Database, ctx: ServiceContext) {
  let query = `SELECT * FROM content WHERE account_id = ? AND deleted_at IS NULL`
  const params: SqlParams = [ctx.accountId]

  // Authors only see own content
  if (ctx.userRole === 'AUTHOR') {
    query += ' AND created_by_id = ?'
    params.push(ctx.user.id)
  }

  // Viewers only see published content
  if (ctx.userRole === 'VIEWER') {
    query += ' AND status = ?'
    params.push('published')
  }

  return queryAll(db, query, params)
}
```

### Route Protection Summary

```typescript
// No guard - requires auth only (via parent router)
users.openapi(listUsersRoute, listUsersHandler)

// Role guard - minimum role level
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))

// Permission guard - specific permission
users.use(toHonoPath(adminRoute.path), requirePermission('MANAGE_ALL_USERS'))

// Role + additional roles
users.use(toHonoPath(billingRoute.path), requireRole('ADMIN', ['BILLING']))
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [middleware-guide.md](middleware-guide.md) - Auth middleware details
- [services-layer.md](services-layer.md) - Using ServiceContext
- [routing-and-handlers.md](routing-and-handlers.md) - Applying guards
