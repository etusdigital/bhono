# Hono Boilerplate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-tenant Hono.js API boilerplate with JWT auth, role-based access control, Drizzle ORM, and OpenAPI documentation.

**Architecture:** Layered architecture with middleware for auth/context, services for business logic, Drizzle schemas for persistence, and OpenAPIHono for type-safe routes with auto-generated docs.

**Tech Stack:** Hono, @hono/zod-openapi, Drizzle ORM, better-sqlite3, Zod, TypeScript

---

## Phase 1: Project Setup

### Task 1: Initialize Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Initialize npm project**

Run: `cd /Users/albertoandre/Dropbox/aa-projects/Github/etus-nest-boilerplate/boilerplate-hono && npm init -y`
Expected: package.json created

**Step 2: Update package.json with dependencies and scripts**

```json
{
  "name": "hono-boilerplate",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "@hono/zod-openapi": "^0.18.0",
    "@hono/swagger-ui": "^0.5.0",
    "drizzle-orm": "^0.36.0",
    "better-sqlite3": "^11.6.0",
    "zod": "^3.24.0",
    "uuidv7": "^1.0.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.10.0",
    "@types/better-sqlite3": "^7.6.12",
    "vitest": "^2.1.0"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.sqlite
*.sqlite-journal
.env
.env.local
.DS_Store
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: node_modules created, package-lock.json generated

**Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore package-lock.json
git commit -m "chore: initialize hono boilerplate project"
```

---

### Task 2: Create Directory Structure

**Files:**
- Create: `src/index.ts` (placeholder)
- Create: directories for all modules

**Step 1: Create all directories**

Run:
```bash
mkdir -p src/{middleware,routes/users,routes/accounts,db/schema,db/migrations,services,auth,lib,types}
```
Expected: Directory structure created

**Step 2: Create placeholder index.ts**

```typescript
// src/index.ts
console.log('Hono Boilerplate - Setup in progress')
```

**Step 3: Verify build works**

Run: `npm run build`
Expected: dist/index.js created

**Step 4: Commit**

```bash
git add src/
git commit -m "chore: create project directory structure"
```

---

## Phase 2: Core Types and Environment

### Task 3: Create Environment Configuration

**Files:**
- Create: `src/env.ts`
- Create: `.env.example`

**Step 1: Write the test for env validation**

Create `src/env.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should use default values when optional vars not set', async () => {
    process.env.JWT_SECRET = 'test-secret'
    const { env } = await import('./env')

    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.DATABASE_URL).toBe('db.sqlite')
  })

  it('should parse PORT as number', async () => {
    process.env.JWT_SECRET = 'test-secret'
    process.env.PORT = '4000'
    const { env } = await import('./env')

    expect(env.PORT).toBe(4000)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/env.test.ts`
Expected: FAIL - Cannot find module './env'

**Step 3: Create env.ts**

```typescript
// src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().default('db.sqlite'),

  // JWT (required for auth)
  JWT_SECRET: z.string().min(32).default('development-secret-key-min-32-chars'),

  // Optional
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/env.test.ts`
Expected: PASS

**Step 5: Create .env.example**

```
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=db.sqlite

# JWT Secret (min 32 characters)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# Optional
CORS_ORIGINS=*
LOG_LEVEL=info
```

**Step 6: Commit**

```bash
git add src/env.ts src/env.test.ts .env.example
git commit -m "feat: add environment configuration with Zod validation"
```

---

### Task 4: Create Core Types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create types file**

```typescript
// src/types/index.ts
import type { Role } from '../auth/roles'

export interface User {
  id: string
  email: string
  name: string
  status: 'active' | 'inactive'
  providerIds: string[]
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Account {
  id: string
  name: string
  description: string | null
  domain: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface UserAccount {
  userId: string
  accountId: string
  role: Role
}

export interface AuditLog {
  id: string
  transactionId: string
  accountId: string | null
  userId: string | null
  entity: string
  entityId: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changes: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
}

export interface ServiceContext {
  accountId: string
  user: User
  transactionId: string
  ip: string
  userAgent: string
}

export interface PaginationQuery {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  query?: string
}

export interface PaginationMeta {
  currentPage: number
  limit: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Hono Environment type
export type HonoEnv = {
  Variables: {
    transactionId: string
    ip: string
    userAgent: string
    user: User | null
    accountId: string
    userRole: Role | null
    isSystemAdminAccess: boolean
  }
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core type definitions"
```

---

## Phase 3: Auth System (Roles & Permissions)

### Task 5: Create Roles Module

**Files:**
- Create: `src/auth/roles.ts`
- Create: `src/auth/roles.test.ts`

**Step 1: Write the test for role hierarchy**

```typescript
// src/auth/roles.test.ts
import { describe, it, expect } from 'vitest'
import { Role, hasMinimumRole } from './roles'

describe('roles', () => {
  describe('hasMinimumRole', () => {
    it('ADMIN should have access to ADMIN-required endpoints', () => {
      expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
    })

    it('ADMIN should have access to VIEWER-required endpoints', () => {
      expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
    })

    it('VIEWER should NOT have access to ADMIN-required endpoints', () => {
      expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
    })

    it('MANAGER should have access to EDITOR-required endpoints', () => {
      expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
    })

    it('BILLING (non-hierarchical) should only match BILLING', () => {
      expect(hasMinimumRole('BILLING', 'BILLING')).toBe(true)
      expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
      expect(hasMinimumRole('ADMIN', 'BILLING')).toBe(false)
    })

    it('ANALYTICS (non-hierarchical) should only match ANALYTICS', () => {
      expect(hasMinimumRole('ANALYTICS', 'ANALYTICS')).toBe(true)
      expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)
    })

    it('should allow access via additionalRoles', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN', ['BILLING'])).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/auth/roles.test.ts`
Expected: FAIL - Cannot find module './roles'

**Step 3: Create roles.ts**

```typescript
// src/auth/roles.ts
export const Role = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
  VIEWER: 'VIEWER',
  BILLING: 'BILLING',
  ANALYTICS: 'ANALYTICS',
} as const

export type Role = (typeof Role)[keyof typeof Role]

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 0,
  MANAGER: 1,
  EDITOR: 2,
  AUTHOR: 3,
  VIEWER: 4,
  BILLING: -1,
  ANALYTICS: -1,
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

  // Lower or equal level = higher or equal privilege
  return userLevel <= requiredLevel
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/auth/roles.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/auth/roles.ts src/auth/roles.test.ts
git commit -m "feat: add role hierarchy with hasMinimumRole check"
```

---

### Task 6: Create Permissions Module

**Files:**
- Create: `src/auth/permissions.ts`
- Create: `src/auth/permissions.test.ts`

**Step 1: Write the test for permissions**

```typescript
// src/auth/permissions.test.ts
import { describe, it, expect } from 'vitest'
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from './permissions'

describe('permissions', () => {
  describe('hasPermission', () => {
    it('ADMIN should have MANAGE_SYSTEM_SETTINGS', () => {
      expect(hasPermission('ADMIN', 'MANAGE_SYSTEM_SETTINGS')).toBe(true)
    })

    it('VIEWER should NOT have MANAGE_SYSTEM_SETTINGS', () => {
      expect(hasPermission('VIEWER', 'MANAGE_SYSTEM_SETTINGS')).toBe(false)
    })

    it('VIEWER should have VIEW_CONTENT', () => {
      expect(hasPermission('VIEWER', 'VIEW_CONTENT')).toBe(true)
    })

    it('BILLING should have MANAGE_BILLING', () => {
      expect(hasPermission('BILLING', 'MANAGE_BILLING')).toBe(true)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      expect(hasAnyPermission('EDITOR', ['MANAGE_BILLING', 'CREATE_CONTENT'])).toBe(true)
    })

    it('should return false if user has none of the permissions', () => {
      expect(hasAnyPermission('VIEWER', ['MANAGE_BILLING', 'CREATE_CONTENT'])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      expect(hasAllPermissions('ADMIN', ['CREATE_CONTENT', 'VIEW_CONTENT'])).toBe(true)
    })

    it('should return false if user is missing any permission', () => {
      expect(hasAllPermissions('VIEWER', ['CREATE_CONTENT', 'VIEW_CONTENT'])).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/auth/permissions.test.ts`
Expected: FAIL - Cannot find module './permissions'

**Step 3: Create permissions.ts**

```typescript
// src/auth/permissions.ts
import type { Role } from './roles'

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

export type Permission = (typeof Permission)[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    Permission.MANAGE_SYSTEM_SETTINGS,
    Permission.MANAGE_ALL_USERS,
    Permission.MANAGE_TEAM_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.EDIT_OWN_CONTENT,
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
    Permission.EDIT_OWN_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.VIEW_ANALYTICS,
  ],
  EDITOR: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.EDIT_OWN_CONTENT,
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

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/auth/permissions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/auth/permissions.ts src/auth/permissions.test.ts
git commit -m "feat: add permissions matrix with role-based access"
```

---

## Phase 4: Database Layer

### Task 7: Create Drizzle Configuration

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/client.ts`

**Step 1: Create drizzle.config.ts**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'db.sqlite',
  },
})
```

**Step 2: Create database client**

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { env } from '../env'
import * as schema from './schema'

const sqlite = new Database(env.DATABASE_URL)
export const db = drizzle(sqlite, { schema })

export type Database = typeof db
```

**Step 3: Commit**

```bash
git add drizzle.config.ts src/db/client.ts
git commit -m "feat: add Drizzle ORM configuration and client"
```

---

### Task 8: Create Schema Helpers

**Files:**
- Create: `src/lib/schema-helpers.ts`

**Step 1: Create schema helpers**

```typescript
// src/lib/schema-helpers.ts
import { text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const softDeleteFields = {
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  deletedAt: text('deleted_at'),
}

export const createInteractiveFields = (usersTableRef: () => any) => ({
  ...softDeleteFields,
  createdById: text('created_by_id').references(usersTableRef),
  updatedById: text('updated_by_id').references(usersTableRef),
  deletedById: text('deleted_by_id').references(usersTableRef),
})
```

**Step 2: Commit**

```bash
git add src/lib/schema-helpers.ts
git commit -m "feat: add schema helper functions for soft delete fields"
```

---

### Task 9: Create Users Schema

**Files:**
- Create: `src/db/schema/users.ts`

**Step 1: Create users schema**

```typescript
// src/db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] })
    .default('active')
    .notNull(),
  providerIds: text('provider_ids', { mode: 'json' })
    .$type<string[]>()
    .default([]),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' })
    .default(false)
    .notNull(),

  // Soft delete + audit fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  deletedAt: text('deleted_at'),
  createdById: text('created_by_id').references(() => users.id),
  updatedById: text('updated_by_id').references(() => users.id),
  deletedById: text('deleted_by_id').references(() => users.id),
})

export type UserRecord = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

**Step 2: Commit**

```bash
git add src/db/schema/users.ts
git commit -m "feat: add users database schema"
```

---

### Task 10: Create Accounts Schema

**Files:**
- Create: `src/db/schema/accounts.ts`

**Step 1: Create accounts schema**

```typescript
// src/db/schema/accounts.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const accounts = sqliteTable('accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  domain: text('domain').unique(),

  // Soft delete fields
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  deletedAt: text('deleted_at'),
})

export type AccountRecord = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
```

**Step 2: Commit**

```bash
git add src/db/schema/accounts.ts
git commit -m "feat: add accounts database schema"
```

---

### Task 11: Create User-Accounts Schema

**Files:**
- Create: `src/db/schema/user-accounts.ts`

**Step 1: Create user-accounts schema**

```typescript
// src/db/schema/user-accounts.ts
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { accounts } from './accounts'

export const userAccounts = sqliteTable(
  'user_accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'],
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.accountId] }),
  })
)

export type UserAccountRecord = typeof userAccounts.$inferSelect
export type NewUserAccount = typeof userAccounts.$inferInsert
```

**Step 2: Commit**

```bash
git add src/db/schema/user-accounts.ts
git commit -m "feat: add user-accounts junction table schema"
```

---

### Task 12: Create Audit Logs Schema

**Files:**
- Create: `src/db/schema/audit-logs.ts`

**Step 1: Create audit-logs schema**

```typescript
// src/db/schema/audit-logs.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { accounts } from './accounts'

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id').notNull(),
  accountId: text('account_id').references(() => accounts.id),
  userId: text('user_id').references(() => users.id),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action', { enum: ['INSERT', 'UPDATE', 'DELETE'] }).notNull(),
  changes: text('changes', { mode: 'json' }).$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: text('timestamp').default(sql`(datetime('now'))`).notNull(),
})

export type AuditLogRecord = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
```

**Step 2: Commit**

```bash
git add src/db/schema/audit-logs.ts
git commit -m "feat: add audit logs database schema"
```

---

### Task 13: Create Schema Index

**Files:**
- Create: `src/db/schema/index.ts`

**Step 1: Create schema index file**

```typescript
// src/db/schema/index.ts
export * from './users'
export * from './accounts'
export * from './user-accounts'
export * from './audit-logs'
```

**Step 2: Commit**

```bash
git add src/db/schema/index.ts
git commit -m "feat: add schema index for Drizzle"
```

---

### Task 14: Generate and Apply Migrations

**Files:**
- Create: `src/db/migrations/` (generated)

**Step 1: Generate migrations**

Run: `npm run db:generate`
Expected: Migration files created in src/db/migrations/

**Step 2: Apply migrations**

Run: `npm run db:push`
Expected: Database schema created in db.sqlite

**Step 3: Commit**

```bash
git add src/db/migrations/
git commit -m "feat: add initial database migrations"
```

---

### Task 15: Create Database Seed

**Files:**
- Create: `src/db/seed.ts`

**Step 1: Create seed script**

```typescript
// src/db/seed.ts
import { db } from './client'
import { users, accounts, userAccounts } from './schema'

async function seed() {
  console.log('Seeding database...')

  // 1. Create default account
  const [account] = await db
    .insert(accounts)
    .values({
      name: 'Default Account',
      domain: 'default.local',
      description: 'Default account for testing',
    })
    .returning()

  console.log('Created account:', account.name)

  // 2. Create super admin user
  const [superAdmin] = await db
    .insert(users)
    .values({
      email: 'admin@example.com',
      name: 'Super Admin',
      isSuperAdmin: true,
      status: 'active',
    })
    .returning()

  console.log('Created super admin:', superAdmin.email)

  // 3. Create test users with different roles
  const testUsers = [
    { email: 'manager@example.com', name: 'Manager User', role: 'MANAGER' as const },
    { email: 'editor@example.com', name: 'Editor User', role: 'EDITOR' as const },
    { email: 'author@example.com', name: 'Author User', role: 'AUTHOR' as const },
    { email: 'viewer@example.com', name: 'Viewer User', role: 'VIEWER' as const },
  ]

  for (const { email, name, role } of testUsers) {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        status: 'active',
      })
      .returning()

    await db.insert(userAccounts).values({
      userId: user.id,
      accountId: account.id,
      role,
    })

    console.log(`Created user: ${email} with role: ${role}`)
  }

  console.log('Seeding complete!')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

**Step 2: Run seed**

Run: `npm run db:seed`
Expected: Users and account created successfully

**Step 3: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat: add database seed script"
```

---

## Phase 5: Library Utilities

### Task 16: Create Pagination Helpers

**Files:**
- Create: `src/lib/pagination.ts`
- Create: `src/lib/pagination.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/pagination.test.ts
import { describe, it, expect } from 'vitest'
import { createPaginationMeta, PaginationQuerySchema } from './pagination'

describe('pagination', () => {
  describe('createPaginationMeta', () => {
    it('should calculate correct pagination meta', () => {
      const meta = createPaginationMeta(100, 2, 10)

      expect(meta.currentPage).toBe(2)
      expect(meta.limit).toBe(10)
      expect(meta.totalItems).toBe(100)
      expect(meta.totalPages).toBe(10)
      expect(meta.hasPreviousPage).toBe(true)
      expect(meta.hasNextPage).toBe(true)
    })

    it('should return hasPreviousPage false on first page', () => {
      const meta = createPaginationMeta(100, 1, 10)
      expect(meta.hasPreviousPage).toBe(false)
    })

    it('should return hasNextPage false on last page', () => {
      const meta = createPaginationMeta(100, 10, 10)
      expect(meta.hasNextPage).toBe(false)
    })

    it('should handle empty results', () => {
      const meta = createPaginationMeta(0, 1, 10)
      expect(meta.totalPages).toBe(0)
      expect(meta.hasNextPage).toBe(false)
    })
  })

  describe('PaginationQuerySchema', () => {
    it('should use defaults for missing values', () => {
      const result = PaginationQuerySchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(50)
      expect(result.sortOrder).toBe('DESC')
    })

    it('should coerce string numbers', () => {
      const result = PaginationQuerySchema.parse({ page: '2', limit: '25' })
      expect(result.page).toBe(2)
      expect(result.limit).toBe(25)
    })

    it('should enforce limit max of 100', () => {
      expect(() => PaginationQuerySchema.parse({ limit: 200 })).toThrow()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/pagination.test.ts`
Expected: FAIL - Cannot find module './pagination'

**Step 3: Create pagination.ts**

```typescript
// src/lib/pagination.ts
import { z } from 'zod'
import type { PaginationMeta } from '../types'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  query: z.string().optional(),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export function createPaginationMeta(
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

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/pagination.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/pagination.ts src/lib/pagination.test.ts
git commit -m "feat: add pagination helpers with Zod schema"
```

---

### Task 17: Create Error Classes

**Files:**
- Create: `src/lib/errors.ts`

**Step 1: Create error classes**

```typescript
// src/lib/errors.ts
import { HTTPException } from 'hono/http-exception'

export class ValidationError extends HTTPException {
  constructor(message: string, details?: unknown) {
    super(400, {
      message,
      cause: details,
    })
  }
}

export class UnauthorizedError extends HTTPException {
  constructor(message = 'Unauthorized') {
    super(401, { message })
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = 'Forbidden') {
    super(403, { message })
  }
}

export class NotFoundError extends HTTPException {
  constructor(resource = 'Resource') {
    super(404, { message: `${resource} not found` })
  }
}

export class ConflictError extends HTTPException {
  constructor(message = 'Resource already exists') {
    super(409, { message })
  }
}

export class InternalError extends HTTPException {
  constructor(message = 'Internal server error') {
    super(500, { message })
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/errors.ts
git commit -m "feat: add custom HTTP error classes"
```

---

### Task 18: Create Audit Helper

**Files:**
- Create: `src/lib/audit.ts`

**Step 1: Create audit helper**

```typescript
// src/lib/audit.ts
import { db } from '../db/client'
import { auditLogs } from '../db/schema'
import type { ServiceContext } from '../types'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export async function logAudit(
  ctx: ServiceContext,
  entity: string,
  entityId: string,
  action: AuditAction,
  changes: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLogs).values({
    transactionId: ctx.transactionId,
    accountId: ctx.accountId,
    userId: ctx.user.id,
    entity,
    entityId,
    action,
    changes,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  })
}

export function createChangeDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      }
    }
  }

  return changes
}
```

**Step 2: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat: add audit logging helper functions"
```

---

## Phase 6: App Factory and Middleware

### Task 19: Create App Factory

**Files:**
- Create: `src/app.ts`

**Step 1: Create app factory**

```typescript
// src/app.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from './types'

export const createApp = () => {
  const app = new OpenAPIHono<HonoEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'Validation Error',
            statusCode: 400,
            details: result.error.flatten(),
          },
          400
        )
      }
    },
  })

  // Global error handler
  app.onError((err, c) => {
    console.error('Error:', err)

    if ('status' in err && typeof err.status === 'number') {
      return c.json(
        {
          error: err.message || 'Error',
          statusCode: err.status,
        },
        err.status as 400 | 401 | 403 | 404 | 409 | 500
      )
    }

    return c.json(
      {
        error: 'Internal Server Error',
        statusCode: 500,
      },
      500
    )
  })

  return app
}

export type App = ReturnType<typeof createApp>
```

**Step 2: Commit**

```bash
git add src/app.ts
git commit -m "feat: add OpenAPIHono app factory with error handler"
```

---

### Task 20: Create Request Context Middleware

**Files:**
- Create: `src/middleware/request-context.ts`

**Step 1: Create request context middleware**

```typescript
// src/middleware/request-context.ts
import { createMiddleware } from 'hono/factory'
import { uuidv7 } from 'uuidv7'
import type { HonoEnv } from '../types'

export const requestContext = createMiddleware<HonoEnv>(async (c, next) => {
  c.set('transactionId', uuidv7())
  c.set('ip', c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown')
  c.set('userAgent', c.req.header('user-agent') || 'unknown')
  c.set('user', null)
  c.set('accountId', '')
  c.set('userRole', null)
  c.set('isSystemAdminAccess', false)

  await next()
})
```

**Step 2: Commit**

```bash
git add src/middleware/request-context.ts
git commit -m "feat: add request context middleware with UUIDv7"
```

---

### Task 21: Create JWT Auth Middleware

**Files:**
- Create: `src/middleware/auth.ts`
- Create: `src/middleware/auth.test.ts`

**Step 1: Write the test**

```typescript
// src/middleware/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { jwtAuth } from './auth'
import type { HonoEnv } from '../types'

// Mock the database
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              status: 'active',
              providerIds: ['auth0|123'],
              isSuperAdmin: false,
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01',
              deletedAt: null,
            },
          ]),
        }),
      }),
    }),
  },
}))

describe('jwtAuth middleware', () => {
  const app = new Hono<HonoEnv>()
  const secret = 'test-secret-key-at-least-32-characters'

  beforeEach(() => {
    process.env.JWT_SECRET = secret
  })

  app.use('*', jwtAuth)
  app.get('/test', (c) => c.json({ user: c.get('user') }))

  it('should reject requests without Authorization header', async () => {
    const res = await app.request('/test')
    expect(res.status).toBe(401)
  })

  it('should reject requests with invalid token format', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'InvalidFormat' },
    })
    expect(res.status).toBe(401)
  })

  it('should accept valid JWT and set user in context', async () => {
    const token = await sign(
      {
        sub: 'auth0|123',
        email: 'test@example.com',
      },
      secret
    )

    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('test@example.com')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/middleware/auth.test.ts`
Expected: FAIL - Cannot find module './auth'

**Step 3: Create auth middleware**

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { eq, and, isNull } from 'drizzle-orm'
import type { HonoEnv, User } from '../types'
import { db } from '../db/client'
import { users } from '../db/schema'
import { env } from '../env'

export const jwtAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header', statusCode: 401 }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verify(token, env.JWT_SECRET)
    const providerId = payload.sub as string

    // Fetch user from database
    const [userRecord] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.providerIds, JSON.stringify([providerId])),
        isNull(users.deletedAt)
      ))
      .limit(1)

    // If user not found by providerId, try by email
    if (!userRecord && payload.email) {
      const [userByEmail] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.email, payload.email as string),
          isNull(users.deletedAt)
        ))
        .limit(1)

      if (userByEmail) {
        const user: User = {
          id: userByEmail.id,
          email: userByEmail.email,
          name: userByEmail.name,
          status: userByEmail.status,
          providerIds: userByEmail.providerIds || [],
          isSuperAdmin: userByEmail.isSuperAdmin,
          createdAt: userByEmail.createdAt,
          updatedAt: userByEmail.updatedAt,
          deletedAt: userByEmail.deletedAt,
        }
        c.set('user', user)
        return next()
      }
    }

    if (!userRecord) {
      return c.json({ error: 'User not found', statusCode: 401 }, 401)
    }

    const user: User = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      providerIds: userRecord.providerIds || [],
      isSuperAdmin: userRecord.isSuperAdmin,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      deletedAt: userRecord.deletedAt,
    }

    c.set('user', user)
    return next()
  } catch {
    return c.json({ error: 'Invalid token', statusCode: 401 }, 401)
  }
})
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/middleware/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/middleware/auth.ts src/middleware/auth.test.ts
git commit -m "feat: add JWT authentication middleware"
```

---

### Task 22: Create Account Middleware

**Files:**
- Create: `src/middleware/account.ts`

**Step 1: Create account middleware**

```typescript
// src/middleware/account.ts
import { createMiddleware } from 'hono/factory'
import { eq, and } from 'drizzle-orm'
import type { HonoEnv } from '../types'
import type { Role } from '../auth/roles'
import { db } from '../db/client'
import { userAccounts } from '../db/schema'

export const accountMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const accountId = c.req.header('account-id')
  const user = c.get('user')

  if (!accountId) {
    return c.json({ error: 'account-id header required', statusCode: 400 }, 400)
  }

  if (!user) {
    return c.json({ error: 'Unauthorized', statusCode: 401 }, 401)
  }

  // Super-admin can access any account
  if (user.isSuperAdmin) {
    c.set('accountId', accountId)
    c.set('userRole', 'ADMIN' as Role)
    c.set('isSystemAdminAccess', true)
    return next()
  }

  // Check user belongs to account
  const [membership] = await db
    .select()
    .from(userAccounts)
    .where(
      and(eq(userAccounts.userId, user.id), eq(userAccounts.accountId, accountId))
    )
    .limit(1)

  if (!membership) {
    return c.json({ error: 'Forbidden: No access to this account', statusCode: 403 }, 403)
  }

  c.set('accountId', accountId)
  c.set('userRole', membership.role as Role)
  c.set('isSystemAdminAccess', false)

  return next()
})
```

**Step 2: Commit**

```bash
git add src/middleware/account.ts
git commit -m "feat: add account middleware for multi-tenancy"
```

---

### Task 23: Create Auth Guards

**Files:**
- Create: `src/auth/guards.ts`

**Step 1: Create guards**

```typescript
// src/auth/guards.ts
import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types'
import { hasMinimumRole, type Role } from './roles'
import { hasPermission, type Permission } from './permissions'

export const requireRole = (minRole: Role, additionalRoles: Role[] = []) => {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')
    const userRole = c.get('userRole')

    if (!user) {
      return c.json({ error: 'Unauthorized', statusCode: 401 }, 401)
    }

    // Super-admin bypass
    if (user.isSuperAdmin) {
      return next()
    }

    if (!userRole || !hasMinimumRole(userRole, minRole, additionalRoles)) {
      return c.json({ error: 'Forbidden: Insufficient role', statusCode: 403 }, 403)
    }

    return next()
  })
}

export const requirePermission = (permission: Permission) => {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')
    const userRole = c.get('userRole')

    if (!user) {
      return c.json({ error: 'Unauthorized', statusCode: 401 }, 401)
    }

    // Super-admin bypass
    if (user.isSuperAdmin) {
      return next()
    }

    if (!userRole || !hasPermission(userRole, permission)) {
      return c.json({ error: 'Forbidden: Insufficient permission', statusCode: 403 }, 403)
    }

    return next()
  })
}
```

**Step 2: Commit**

```bash
git add src/auth/guards.ts
git commit -m "feat: add role and permission guard middleware"
```

---

### Task 24: Create Middleware Index

**Files:**
- Create: `src/middleware/index.ts`

**Step 1: Create middleware index**

```typescript
// src/middleware/index.ts
export { requestContext } from './request-context'
export { jwtAuth } from './auth'
export { accountMiddleware } from './account'
```

**Step 2: Commit**

```bash
git add src/middleware/index.ts
git commit -m "feat: add middleware index exports"
```

---

## Phase 7: API Schemas

### Task 25: Create Common API Schemas

**Files:**
- Create: `src/routes/schemas.ts`

**Step 1: Create common schemas**

```typescript
// src/routes/schemas.ts
import { z } from '@hono/zod-openapi'

// Error response schema
export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: 'Error message' }),
    statusCode: z.number().openapi({ example: 400 }),
    details: z.unknown().optional(),
  })
  .openapi('ErrorResponse')

// Pagination meta schema
export const PaginationMetaSchema = z
  .object({
    currentPage: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 50 }),
    totalItems: z.number().openapi({ example: 100 }),
    totalPages: z.number().openapi({ example: 2 }),
    hasPreviousPage: z.boolean().openapi({ example: false }),
    hasNextPage: z.boolean().openapi({ example: true }),
  })
  .openapi('PaginationMeta')

// Pagination query schema
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().min(1).max(100).default(50).openapi({ example: 50 }),
  sortBy: z.string().optional().openapi({ example: 'createdAt' }),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC').openapi({ example: 'DESC' }),
  query: z.string().optional().openapi({ example: 'search term' }),
})

// Create paginated response schema factory
export const createPaginatedSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string
) =>
  z
    .object({
      data: z.array(itemSchema),
      meta: PaginationMetaSchema,
    })
    .openapi(`Paginated${name}`)

// UUID param schema
export const IdParamSchema = z.object({
  id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
})

// Account header schema
export const AccountHeaderSchema = z.object({
  'account-id': z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
})
```

**Step 2: Commit**

```bash
git add src/routes/schemas.ts
git commit -m "feat: add common API schemas for OpenAPI"
```

---

### Task 26: Create Users Schemas

**Files:**
- Create: `src/routes/users/schemas.ts`

**Step 1: Create users schemas**

```typescript
// src/routes/users/schemas.ts
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const UserSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: 'John Doe' }),
    status: z.enum(['active', 'inactive']).openapi({ example: 'active' }),
    isSuperAdmin: z.boolean().openapi({ example: false }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('User')

export const CreateUserSchema = z
  .object({
    email: z.string().email().openapi({ example: 'newuser@example.com' }),
    name: z.string().min(1).max(255).openapi({ example: 'Jane Doe' }),
    role: z
      .enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'])
      .default('VIEWER')
      .openapi({ example: 'VIEWER' }),
  })
  .openapi('CreateUserInput')

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Updated Name' }),
    status: z.enum(['active', 'inactive']).optional().openapi({ example: 'active' }),
  })
  .openapi('UpdateUserInput')

export const PaginatedUsersSchema = createPaginatedSchema(UserSchema, 'Users')
```

**Step 2: Commit**

```bash
git add src/routes/users/schemas.ts
git commit -m "feat: add users API schemas"
```

---

### Task 27: Create Accounts Schemas

**Files:**
- Create: `src/routes/accounts/schemas.ts`

**Step 1: Create accounts schemas**

```typescript
// src/routes/accounts/schemas.ts
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const AccountSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    name: z.string().openapi({ example: 'Acme Corp' }),
    description: z.string().nullable().openapi({ example: 'Main business account' }),
    domain: z.string().nullable().openapi({ example: 'acme.com' }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('Account')

export const CreateAccountSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'New Account' }),
    description: z.string().max(1000).optional().openapi({ example: 'Account description' }),
    domain: z.string().max(255).optional().openapi({ example: 'example.com' }),
  })
  .openapi('CreateAccountInput')

export const UpdateAccountSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Updated Name' }),
    description: z.string().max(1000).optional().openapi({ example: 'Updated description' }),
    domain: z.string().max(255).optional().openapi({ example: 'updated.com' }),
  })
  .openapi('UpdateAccountInput')

export const PaginatedAccountsSchema = createPaginatedSchema(AccountSchema, 'Accounts')
```

**Step 2: Commit**

```bash
git add src/routes/accounts/schemas.ts
git commit -m "feat: add accounts API schemas"
```

---

## Phase 8: Services

### Task 28: Create Users Service

**Files:**
- Create: `src/services/users.ts`

**Step 1: Create users service**

```typescript
// src/services/users.ts
import { eq, and, isNull, like, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { users, userAccounts } from '../db/schema'
import { logAudit } from '../lib/audit'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, User } from '../types'
import type { Role } from '../auth/roles'

interface CreateUserInput {
  email: string
  name: string
  role: Role
}

interface UpdateUserInput {
  name?: string
  status?: 'active' | 'inactive'
}

export const usersService = {
  async findAll(
    ctx: ServiceContext,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<User>> {
    const offset = calculateOffset(pagination.page, pagination.limit)

    // Build base query conditions
    const conditions = [isNull(users.deletedAt)]

    // Non-super-admin sees only users in their account
    if (!ctx.user.isSuperAdmin) {
      const userIdsInAccount = db
        .select({ userId: userAccounts.userId })
        .from(userAccounts)
        .where(eq(userAccounts.accountId, ctx.accountId))

      conditions.push(sql`${users.id} IN ${userIdsInAccount}`)
    }

    // Add search filter if provided
    if (pagination.query) {
      conditions.push(
        sql`(${users.email} LIKE ${'%' + pagination.query + '%'} OR ${users.name} LIKE ${'%' + pagination.query + '%'})`
      )
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions))

    const totalItems = countResult?.count ?? 0

    // Get paginated data
    const data = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .limit(pagination.limit)
      .offset(offset)
      .orderBy(sql`${users.createdAt} DESC`)

    return {
      data: data.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        providerIds: u.providerIds || [],
        isSuperAdmin: u.isSuperAdmin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        deletedAt: u.deletedAt,
      })),
      meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
    }
  },

  async findById(ctx: ServiceContext, id: string): Promise<User> {
    const [userRecord] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)

    if (!userRecord) {
      throw new NotFoundError('User')
    }

    // Check user has access (super-admin or same account)
    if (!ctx.user.isSuperAdmin) {
      const [membership] = await db
        .select()
        .from(userAccounts)
        .where(
          and(
            eq(userAccounts.userId, id),
            eq(userAccounts.accountId, ctx.accountId)
          )
        )
        .limit(1)

      if (!membership) {
        throw new NotFoundError('User')
      }
    }

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      providerIds: userRecord.providerIds || [],
      isSuperAdmin: userRecord.isSuperAdmin,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      deletedAt: userRecord.deletedAt,
    }
  },

  async create(ctx: ServiceContext, input: CreateUserInput): Promise<User> {
    // Check email doesn't already exist
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1)

    if (existing) {
      throw new ConflictError('User with this email already exists')
    }

    // Create user
    const [userRecord] = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        status: 'active',
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
      })
      .returning()

    // Create user-account relationship
    await db.insert(userAccounts).values({
      userId: userRecord.id,
      accountId: ctx.accountId,
      role: input.role,
    })

    // Log audit
    await logAudit(ctx, 'User', userRecord.id, 'INSERT', userRecord)

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      providerIds: userRecord.providerIds || [],
      isSuperAdmin: userRecord.isSuperAdmin,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      deletedAt: userRecord.deletedAt,
    }
  },

  async update(ctx: ServiceContext, id: string, input: UpdateUserInput): Promise<User> {
    // Verify user exists and accessible
    await this.findById(ctx, id)

    // Update user
    const [userRecord] = await db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
        updatedById: ctx.user.id,
      })
      .where(eq(users.id, id))
      .returning()

    // Log audit
    await logAudit(ctx, 'User', id, 'UPDATE', input)

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      providerIds: userRecord.providerIds || [],
      isSuperAdmin: userRecord.isSuperAdmin,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      deletedAt: userRecord.deletedAt,
    }
  },

  async delete(ctx: ServiceContext, id: string): Promise<void> {
    // Verify user exists and accessible
    await this.findById(ctx, id)

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: new Date().toISOString(),
        deletedById: ctx.user.id,
        updatedAt: new Date().toISOString(),
        updatedById: ctx.user.id,
      })
      .where(eq(users.id, id))

    // Log audit
    await logAudit(ctx, 'User', id, 'DELETE', { deleted: true })
  },
}
```

**Step 2: Commit**

```bash
git add src/services/users.ts
git commit -m "feat: add users service with CRUD operations"
```

---

### Task 29: Create Accounts Service

**Files:**
- Create: `src/services/accounts.ts`

**Step 1: Create accounts service**

```typescript
// src/services/accounts.ts
import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { accounts, userAccounts } from '../db/schema'
import { logAudit } from '../lib/audit'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError, ForbiddenError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, Account } from '../types'

interface CreateAccountInput {
  name: string
  description?: string
  domain?: string
}

interface UpdateAccountInput {
  name?: string
  description?: string
  domain?: string
}

export const accountsService = {
  async findAll(
    ctx: ServiceContext,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<Account>> {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const conditions = [isNull(accounts.deletedAt)]

    // Non-super-admin sees only their accounts
    if (!ctx.user.isSuperAdmin) {
      const accountIdsForUser = db
        .select({ accountId: userAccounts.accountId })
        .from(userAccounts)
        .where(eq(userAccounts.userId, ctx.user.id))

      conditions.push(sql`${accounts.id} IN ${accountIdsForUser}`)
    }

    // Add search filter
    if (pagination.query) {
      conditions.push(
        sql`(${accounts.name} LIKE ${'%' + pagination.query + '%'} OR ${accounts.domain} LIKE ${'%' + pagination.query + '%'})`
      )
    }

    // Get count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(and(...conditions))

    const totalItems = countResult?.count ?? 0

    // Get data
    const data = await db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .limit(pagination.limit)
      .offset(offset)
      .orderBy(sql`${accounts.createdAt} DESC`)

    return {
      data: data.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        domain: a.domain,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        deletedAt: a.deletedAt,
      })),
      meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
    }
  },

  async findById(ctx: ServiceContext, id: string): Promise<Account> {
    const [accountRecord] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .limit(1)

    if (!accountRecord) {
      throw new NotFoundError('Account')
    }

    // Check access for non-super-admin
    if (!ctx.user.isSuperAdmin) {
      const [membership] = await db
        .select()
        .from(userAccounts)
        .where(
          and(
            eq(userAccounts.userId, ctx.user.id),
            eq(userAccounts.accountId, id)
          )
        )
        .limit(1)

      if (!membership) {
        throw new NotFoundError('Account')
      }
    }

    return {
      id: accountRecord.id,
      name: accountRecord.name,
      description: accountRecord.description,
      domain: accountRecord.domain,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
      deletedAt: accountRecord.deletedAt,
    }
  },

  async create(ctx: ServiceContext, input: CreateAccountInput): Promise<Account> {
    // Only super-admin can create accounts
    if (!ctx.user.isSuperAdmin) {
      throw new ForbiddenError('Only super-admin can create accounts')
    }

    // Check domain uniqueness if provided
    if (input.domain) {
      const [existing] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.domain, input.domain))
        .limit(1)

      if (existing) {
        throw new ConflictError('Account with this domain already exists')
      }
    }

    const [accountRecord] = await db
      .insert(accounts)
      .values({
        name: input.name,
        description: input.description || null,
        domain: input.domain || null,
      })
      .returning()

    await logAudit(ctx, 'Account', accountRecord.id, 'INSERT', accountRecord)

    return {
      id: accountRecord.id,
      name: accountRecord.name,
      description: accountRecord.description,
      domain: accountRecord.domain,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
      deletedAt: accountRecord.deletedAt,
    }
  },

  async update(ctx: ServiceContext, id: string, input: UpdateAccountInput): Promise<Account> {
    await this.findById(ctx, id)

    // Check domain uniqueness if changing
    if (input.domain) {
      const [existing] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.domain, input.domain), sql`${accounts.id} != ${id}`))
        .limit(1)

      if (existing) {
        throw new ConflictError('Account with this domain already exists')
      }
    }

    const [accountRecord] = await db
      .update(accounts)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, id))
      .returning()

    await logAudit(ctx, 'Account', id, 'UPDATE', input)

    return {
      id: accountRecord.id,
      name: accountRecord.name,
      description: accountRecord.description,
      domain: accountRecord.domain,
      createdAt: accountRecord.createdAt,
      updatedAt: accountRecord.updatedAt,
      deletedAt: accountRecord.deletedAt,
    }
  },

  async delete(ctx: ServiceContext, id: string): Promise<void> {
    // Only super-admin can delete accounts
    if (!ctx.user.isSuperAdmin) {
      throw new ForbiddenError('Only super-admin can delete accounts')
    }

    await this.findById(ctx, id)

    await db
      .update(accounts)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, id))

    await logAudit(ctx, 'Account', id, 'DELETE', { deleted: true })
  },
}
```

**Step 2: Commit**

```bash
git add src/services/accounts.ts
git commit -m "feat: add accounts service with CRUD operations"
```

---

### Task 30: Create Services Index

**Files:**
- Create: `src/services/index.ts`

**Step 1: Create services index**

```typescript
// src/services/index.ts
export { usersService } from './users'
export { accountsService } from './accounts'
```

**Step 2: Commit**

```bash
git add src/services/index.ts
git commit -m "feat: add services index exports"
```

---

## Phase 9: Route Handlers

### Task 31: Create Users Routes

**Files:**
- Create: `src/routes/users/routes.ts`

**Step 1: Create users routes**

```typescript
// src/routes/users/routes.ts
import { createRoute } from '@hono/zod-openapi'
import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  PaginatedUsersSchema,
} from './schemas'
import {
  ErrorResponseSchema,
  PaginationQuerySchema,
  IdParamSchema,
  AccountHeaderSchema,
} from '../schemas'

export const listUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'List users',
  description: 'Get paginated list of users in the current account',
  security: [{ Bearer: [] }],
  request: {
    query: PaginationQuerySchema,
    headers: AccountHeaderSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PaginatedUsersSchema } },
      description: 'List of users',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
  },
})

export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  description: 'Get a specific user by their ID',
  security: [{ Bearer: [] }],
  request: {
    params: IdParamSchema,
    headers: AccountHeaderSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserSchema } },
      description: 'User details',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
})

export const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  summary: 'Create user',
  description: 'Create a new user in the current account',
  security: [{ Bearer: [] }],
  request: {
    headers: AccountHeaderSchema,
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: UserSchema } },
      description: 'User created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User already exists',
    },
  },
})

export const updateUserRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Update user',
  description: 'Update an existing user',
  security: [{ Bearer: [] }],
  request: {
    params: IdParamSchema,
    headers: AccountHeaderSchema,
    body: {
      content: { 'application/json': { schema: UpdateUserSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserSchema } },
      description: 'User updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
})

export const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete user',
  description: 'Soft delete a user',
  security: [{ Bearer: [] }],
  request: {
    params: IdParamSchema,
    headers: AccountHeaderSchema,
  },
  responses: {
    204: {
      description: 'User deleted',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
})
```

**Step 2: Commit**

```bash
git add src/routes/users/routes.ts
git commit -m "feat: add users route definitions with OpenAPI"
```

---

### Task 32: Create Users Handlers

**Files:**
- Create: `src/routes/users/handlers.ts`

**Step 1: Create users handlers**

```typescript
// src/routes/users/handlers.ts
import type { Context } from 'hono'
import type { HonoEnv, ServiceContext } from '../../types'
import { usersService } from '../../services'

function getServiceContext(c: Context<HonoEnv>): ServiceContext {
  const user = c.get('user')
  if (!user) {
    throw new Error('User not found in context')
  }
  return {
    accountId: c.get('accountId'),
    user,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

export const handleListUsers = async (c: Context<HonoEnv>) => {
  const query = c.req.valid('query')
  const ctx = getServiceContext(c)

  const result = await usersService.findAll(ctx, query)
  return c.json(result, 200)
}

export const handleGetUser = async (c: Context<HonoEnv>) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  const user = await usersService.findById(ctx, id)
  return c.json(user, 200)
}

export const handleCreateUser = async (c: Context<HonoEnv>) => {
  const body = c.req.valid('json')
  const ctx = getServiceContext(c)

  const user = await usersService.create(ctx, body)
  return c.json(user, 201)
}

export const handleUpdateUser = async (c: Context<HonoEnv>) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const ctx = getServiceContext(c)

  const user = await usersService.update(ctx, id, body)
  return c.json(user, 200)
}

export const handleDeleteUser = async (c: Context<HonoEnv>) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  await usersService.delete(ctx, id)
  return c.body(null, 204)
}
```

**Step 2: Commit**

```bash
git add src/routes/users/handlers.ts
git commit -m "feat: add users route handlers"
```

---

### Task 33: Create Users Router

**Files:**
- Create: `src/routes/users/index.ts`

**Step 1: Create users router**

```typescript
// src/routes/users/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listUsersRoute,
  getUserRoute,
  createUserRoute,
  updateUserRoute,
  deleteUserRoute,
} from './routes'
import {
  handleListUsers,
  handleGetUser,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser,
} from './handlers'

const usersRouter = new OpenAPIHono<HonoEnv>()

// List users - MANAGER+ can view
usersRouter.openapi(listUsersRoute, handleListUsers)

// Get user by ID - MANAGER+ can view
usersRouter.openapi(getUserRoute, handleGetUser)

// Create user - ADMIN only
usersRouter.use(createUserRoute.path, requireRole('ADMIN'))
usersRouter.openapi(createUserRoute, handleCreateUser)

// Update user - ADMIN only
usersRouter.use(updateUserRoute.path, requireRole('ADMIN'))
usersRouter.openapi(updateUserRoute, handleUpdateUser)

// Delete user - ADMIN only
usersRouter.use(deleteUserRoute.path, requireRole('ADMIN'))
usersRouter.openapi(deleteUserRoute, handleDeleteUser)

export { usersRouter }
```

**Step 2: Commit**

```bash
git add src/routes/users/index.ts
git commit -m "feat: add users router with role guards"
```

---

### Task 34: Create Accounts Routes

**Files:**
- Create: `src/routes/accounts/routes.ts`

**Step 1: Create accounts routes**

```typescript
// src/routes/accounts/routes.ts
import { createRoute } from '@hono/zod-openapi'
import {
  AccountSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  PaginatedAccountsSchema,
} from './schemas'
import {
  ErrorResponseSchema,
  PaginationQuerySchema,
  IdParamSchema,
  AccountHeaderSchema,
} from '../schemas'

export const listAccountsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Accounts'],
  summary: 'List accounts',
  description: 'Get paginated list of accounts the user has access to',
  security: [{ Bearer: [] }],
  request: {
    query: PaginationQuerySchema,
    headers: AccountHeaderSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PaginatedAccountsSchema } },
      description: 'List of accounts',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
})

export const getAccountRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Accounts'],
  summary: 'Get account by ID',
  description: 'Get a specific account by its ID',
  security: [{ Bearer: [] }],
  request: {
    params: IdParamSchema,
    headers: AccountHeaderSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AccountSchema } },
      description: 'Account details',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Account not found',
    },
  },
})

export const createAccountRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Accounts'],
  summary: 'Create account',
  description: 'Create a new account (super-admin only)',
  security: [{ Bearer: [] }],
  request: {
    headers: AccountHeaderSchema,
    body: {
      content: { 'application/json': { schema: CreateAccountSchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: AccountSchema } },
      description: 'Account created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Account already exists',
    },
  },
})

export const updateAccountRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Accounts'],
  summary: 'Update account',
  description: 'Update an existing account',
  security: [{ Bearer: [] }],
  request: {
    params: IdParamSchema,
    headers: AccountHeaderSchema,
    body: {
      content: { 'application/json': { schema: UpdateAccountSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AccountSchema } },
      description: 'Account updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Account not found',
    },
  },
})

export const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Accounts'],
  summary: 'Delete account',
  description: 'Soft delete an account (super-admin only)',
  security: [{ Bearer: [] }],
  request: {
    params: IdParamSchema,
    headers: AccountHeaderSchema,
  },
  responses: {
    204: {
      description: 'Account deleted',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Account not found',
    },
  },
})
```

**Step 2: Commit**

```bash
git add src/routes/accounts/routes.ts
git commit -m "feat: add accounts route definitions with OpenAPI"
```

---

### Task 35: Create Accounts Handlers

**Files:**
- Create: `src/routes/accounts/handlers.ts`

**Step 1: Create accounts handlers**

```typescript
// src/routes/accounts/handlers.ts
import type { Context } from 'hono'
import type { HonoEnv, ServiceContext } from '../../types'
import { accountsService } from '../../services'

function getServiceContext(c: Context<HonoEnv>): ServiceContext {
  const user = c.get('user')
  if (!user) {
    throw new Error('User not found in context')
  }
  return {
    accountId: c.get('accountId'),
    user,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

export const handleListAccounts = async (c: Context<HonoEnv>) => {
  const query = c.req.valid('query')
  const ctx = getServiceContext(c)

  const result = await accountsService.findAll(ctx, query)
  return c.json(result, 200)
}

export const handleGetAccount = async (c: Context<HonoEnv>) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  const account = await accountsService.findById(ctx, id)
  return c.json(account, 200)
}

export const handleCreateAccount = async (c: Context<HonoEnv>) => {
  const body = c.req.valid('json')
  const ctx = getServiceContext(c)

  const account = await accountsService.create(ctx, body)
  return c.json(account, 201)
}

export const handleUpdateAccount = async (c: Context<HonoEnv>) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const ctx = getServiceContext(c)

  const account = await accountsService.update(ctx, id, body)
  return c.json(account, 200)
}

export const handleDeleteAccount = async (c: Context<HonoEnv>) => {
  const { id } = c.req.valid('param')
  const ctx = getServiceContext(c)

  await accountsService.delete(ctx, id)
  return c.body(null, 204)
}
```

**Step 2: Commit**

```bash
git add src/routes/accounts/handlers.ts
git commit -m "feat: add accounts route handlers"
```

---

### Task 36: Create Accounts Router

**Files:**
- Create: `src/routes/accounts/index.ts`

**Step 1: Create accounts router**

```typescript
// src/routes/accounts/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listAccountsRoute,
  getAccountRoute,
  createAccountRoute,
  updateAccountRoute,
  deleteAccountRoute,
} from './routes'
import {
  handleListAccounts,
  handleGetAccount,
  handleCreateAccount,
  handleUpdateAccount,
  handleDeleteAccount,
} from './handlers'

const accountsRouter = new OpenAPIHono<HonoEnv>()

// List accounts - any authenticated user
accountsRouter.openapi(listAccountsRoute, handleListAccounts)

// Get account by ID - any authenticated user
accountsRouter.openapi(getAccountRoute, handleGetAccount)

// Create account - ADMIN only (service checks super-admin)
accountsRouter.use(createAccountRoute.path, requireRole('ADMIN'))
accountsRouter.openapi(createAccountRoute, handleCreateAccount)

// Update account - ADMIN only
accountsRouter.use(updateAccountRoute.path, requireRole('ADMIN'))
accountsRouter.openapi(updateAccountRoute, handleUpdateAccount)

// Delete account - ADMIN only (service checks super-admin)
accountsRouter.use(deleteAccountRoute.path, requireRole('ADMIN'))
accountsRouter.openapi(deleteAccountRoute, handleDeleteAccount)

export { accountsRouter }
```

**Step 2: Commit**

```bash
git add src/routes/accounts/index.ts
git commit -m "feat: add accounts router with role guards"
```

---

### Task 37: Create Main API Router

**Files:**
- Create: `src/routes/index.ts`

**Step 1: Create main API router**

```typescript
// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { HonoEnv } from '../types'
import { usersRouter } from './users'
import { accountsRouter } from './accounts'

const api = new OpenAPIHono<HonoEnv>()

// Mount routers
api.route('/users', usersRouter)
api.route('/accounts', accountsRouter)

// OpenAPI JSON endpoint
api.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
    description: 'Multi-tenant API with role-based access control',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
  ],
  security: [{ Bearer: [] }],
  components: {
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
})

// Swagger UI
api.get('/docs', swaggerUI({ url: '/doc' }))

export { api }
```

**Step 2: Commit**

```bash
git add src/routes/index.ts
git commit -m "feat: add main API router with Swagger UI"
```

---

## Phase 10: Entry Point

### Task 38: Create Main Entry Point

**Files:**
- Create: `src/index.ts` (replace placeholder)

**Step 1: Create entry point**

```typescript
// src/index.ts
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { api } from './routes'
import { requestContext, jwtAuth, accountMiddleware } from './middleware'
import { env } from './env'

const app = createApp()

// Global middleware
app.use('*', requestContext)

// Protected routes - require auth and account context
app.use('/users/*', jwtAuth, accountMiddleware)
app.use('/accounts/*', jwtAuth, accountMiddleware)

// Mount API routes
app.route('/', api)

// Health check (unprotected)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Start server
console.log(`Starting server on http://localhost:${env.PORT}`)
console.log(`API docs available at http://localhost:${env.PORT}/docs`)
console.log(`OpenAPI spec at http://localhost:${env.PORT}/doc`)

serve({
  fetch: app.fetch,
  port: env.PORT,
})
```

**Step 2: Verify server starts**

Run: `npm run dev`
Expected: Server starts on port 3000, logs show API docs URL

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add main entry point with middleware and routes"
```

---

## Phase 11: Verification

### Task 39: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Test health endpoint**

Run: `curl http://localhost:3000/health`
Expected: `{"status":"ok","timestamp":"..."}`

**Step 3: Test OpenAPI docs**

Run: Open `http://localhost:3000/docs` in browser
Expected: Swagger UI loads with Users and Accounts endpoints

**Step 4: Commit any fixes**

If needed, fix any issues and commit.

---

### Task 40: Final Verification and Cleanup

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 2: Verify build**

Run: `npm run build`
Expected: dist/ folder created successfully

**Step 3: Add .gitignore updates if needed**

Verify db.sqlite is ignored.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: complete Hono boilerplate implementation"
```

---

## Summary

This plan implements a complete Hono.js boilerplate with:

1. **Project Setup** (Tasks 1-2): npm init, dependencies, TypeScript config
2. **Core Types** (Tasks 3-4): Environment validation, type definitions
3. **Auth System** (Tasks 5-6): Role hierarchy, permissions matrix
4. **Database** (Tasks 7-15): Drizzle ORM, schemas, migrations, seeding
5. **Utilities** (Tasks 16-18): Pagination, errors, audit logging
6. **App & Middleware** (Tasks 19-24): App factory, JWT auth, account context, guards
7. **API Schemas** (Tasks 25-27): Zod schemas with OpenAPI metadata
8. **Services** (Tasks 28-30): Business logic for users and accounts
9. **Routes** (Tasks 31-37): OpenAPI route definitions, handlers, routers
10. **Entry Point** (Tasks 38-40): Server startup, verification

Total: 40 tasks, each with discrete steps following TDD where applicable.
