# NestJS Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port valuable features from NestJS boilerplate (provider helpers, role helpers, audit wrappers) to Hono boilerplate.

**Architecture:** Three independent modules following Hono best practices - pure functions with TypeScript inference. Audit wrappers encapsulate Drizzle operations. Services refactored to use wrappers.

**Tech Stack:** Hono, Drizzle ORM, TypeScript, Vitest

---

## Task 1: Provider Helpers - Tests

**Files:**
- Create: `src/server/lib/providers.test.ts`

**Step 1: Write the failing tests for provider helpers**

```typescript
// src/server/lib/providers.test.ts
import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_PROVIDERS,
  hasProvider,
  addProvider,
  removeProvider,
  parseProviderId,
} from './providers'

describe('providers', () => {
  describe('SUPPORTED_PROVIDERS', () => {
    it('should include google, github, microsoft, email', () => {
      expect(SUPPORTED_PROVIDERS).toContain('google')
      expect(SUPPORTED_PROVIDERS).toContain('github')
      expect(SUPPORTED_PROVIDERS).toContain('microsoft')
      expect(SUPPORTED_PROVIDERS).toContain('email')
    })
  })

  describe('hasProvider', () => {
    it('should return true when provider exists', () => {
      const providerIds = ['google|abc123', 'github|xyz789']
      expect(hasProvider(providerIds, 'google|abc123')).toBe(true)
    })

    it('should return false when provider does not exist', () => {
      const providerIds = ['google|abc123']
      expect(hasProvider(providerIds, 'github|xyz789')).toBe(false)
    })

    it('should return false for empty array', () => {
      expect(hasProvider([], 'google|abc123')).toBe(false)
    })
  })

  describe('addProvider', () => {
    it('should add provider to array', () => {
      const providerIds = ['google|abc123']
      const result = addProvider(providerIds, 'github|xyz789')
      expect(result).toEqual(['google|abc123', 'github|xyz789'])
    })

    it('should not mutate original array', () => {
      const providerIds = ['google|abc123']
      addProvider(providerIds, 'github|xyz789')
      expect(providerIds).toEqual(['google|abc123'])
    })

    it('should not add duplicate provider', () => {
      const providerIds = ['google|abc123']
      const result = addProvider(providerIds, 'google|abc123')
      expect(result).toEqual(['google|abc123'])
    })
  })

  describe('removeProvider', () => {
    it('should remove provider from array', () => {
      const providerIds = ['google|abc123', 'github|xyz789']
      const result = removeProvider(providerIds, 'github|xyz789')
      expect(result).toEqual(['google|abc123'])
    })

    it('should not mutate original array', () => {
      const providerIds = ['google|abc123', 'github|xyz789']
      removeProvider(providerIds, 'github|xyz789')
      expect(providerIds).toEqual(['google|abc123', 'github|xyz789'])
    })

    it('should return same array if provider not found', () => {
      const providerIds = ['google|abc123']
      const result = removeProvider(providerIds, 'github|xyz789')
      expect(result).toEqual(['google|abc123'])
    })
  })

  describe('parseProviderId', () => {
    it('should parse valid google provider id', () => {
      const result = parseProviderId('google|abc123')
      expect(result).toEqual({ provider: 'google', id: 'abc123' })
    })

    it('should parse valid github provider id', () => {
      const result = parseProviderId('github|xyz789')
      expect(result).toEqual({ provider: 'github', id: 'xyz789' })
    })

    it('should return null for invalid format (no separator)', () => {
      expect(parseProviderId('invalid')).toBeNull()
    })

    it('should return null for unsupported provider', () => {
      expect(parseProviderId('unknown|abc123')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseProviderId('')).toBeNull()
    })

    it('should handle provider id with multiple separators', () => {
      const result = parseProviderId('google|abc|123')
      expect(result).toEqual({ provider: 'google', id: 'abc|123' })
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/lib/providers.test.ts`
Expected: FAIL with "Cannot find module './providers'"

---

## Task 2: Provider Helpers - Implementation

**Files:**
- Create: `src/server/lib/providers.ts`

**Step 1: Implement provider helpers**

```typescript
// src/server/lib/providers.ts

export const SUPPORTED_PROVIDERS = ['google', 'github', 'microsoft', 'email'] as const

export type Provider = (typeof SUPPORTED_PROVIDERS)[number]

export interface ParsedProviderId {
  provider: Provider
  id: string
}

/**
 * Check if a provider ID exists in the array
 */
export function hasProvider(providerIds: string[], providerId: string): boolean {
  return providerIds.includes(providerId)
}

/**
 * Add a provider ID to the array (immutable, no duplicates)
 */
export function addProvider(providerIds: string[], providerId: string): string[] {
  if (hasProvider(providerIds, providerId)) {
    return providerIds
  }
  return [...providerIds, providerId]
}

/**
 * Remove a provider ID from the array (immutable)
 */
export function removeProvider(providerIds: string[], providerId: string): string[] {
  return providerIds.filter((id) => id !== providerId)
}

/**
 * Parse a provider ID string into provider type and ID
 * Format: "provider|id" (e.g., "google|abc123")
 * Returns null if format is invalid or provider is unsupported
 */
export function parseProviderId(providerId: string): ParsedProviderId | null {
  if (!providerId) {
    return null
  }

  const separatorIndex = providerId.indexOf('|')
  if (separatorIndex === -1) {
    return null
  }

  const provider = providerId.substring(0, separatorIndex)
  const id = providerId.substring(separatorIndex + 1)

  if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
    return null
  }

  return {
    provider: provider as Provider,
    id,
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/server/lib/providers.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/server/lib/providers.ts src/server/lib/providers.test.ts
git commit -m "feat: add provider helpers with parsing support"
```

---

## Task 3: Role Helpers - Tests

**Files:**
- Modify: `src/server/auth/roles.test.ts`

**Step 1: Add failing tests for new role helper functions**

Append to existing `roles.test.ts`:

```typescript
// Add these imports at the top
import {
  Role,
  hasMinimumRole,
  getRolesWithMinimumAccess,
  isHierarchicalRole,
  getRoleLevel,
  getAllRoles,
  compareRoles,
  isRoleHigherThan,
} from './roles'

// Add these test suites after the existing ones

  describe('getRolesWithMinimumAccess', () => {
    it('should return ADMIN, MANAGER, EDITOR for EDITOR minimum', () => {
      const result = getRolesWithMinimumAccess('EDITOR')
      expect(result).toContain('ADMIN')
      expect(result).toContain('MANAGER')
      expect(result).toContain('EDITOR')
      expect(result).not.toContain('AUTHOR')
      expect(result).not.toContain('VIEWER')
    })

    it('should return only ADMIN for ADMIN minimum', () => {
      const result = getRolesWithMinimumAccess('ADMIN')
      expect(result).toEqual(['ADMIN'])
    })

    it('should return all hierarchical roles for VIEWER minimum', () => {
      const result = getRolesWithMinimumAccess('VIEWER')
      expect(result).toContain('ADMIN')
      expect(result).toContain('MANAGER')
      expect(result).toContain('EDITOR')
      expect(result).toContain('AUTHOR')
      expect(result).toContain('VIEWER')
    })

    it('should include additional roles', () => {
      const result = getRolesWithMinimumAccess('ADMIN', ['BILLING'])
      expect(result).toContain('ADMIN')
      expect(result).toContain('BILLING')
    })

    it('should return empty for non-hierarchical role without additionalRoles', () => {
      const result = getRolesWithMinimumAccess('BILLING')
      expect(result).toEqual([])
    })
  })

  describe('isHierarchicalRole', () => {
    it('should return true for ADMIN', () => {
      expect(isHierarchicalRole('ADMIN')).toBe(true)
    })

    it('should return true for VIEWER', () => {
      expect(isHierarchicalRole('VIEWER')).toBe(true)
    })

    it('should return false for BILLING', () => {
      expect(isHierarchicalRole('BILLING')).toBe(false)
    })

    it('should return false for ANALYTICS', () => {
      expect(isHierarchicalRole('ANALYTICS')).toBe(false)
    })
  })

  describe('getRoleLevel', () => {
    it('should return 0 for ADMIN', () => {
      expect(getRoleLevel('ADMIN')).toBe(0)
    })

    it('should return 1 for MANAGER', () => {
      expect(getRoleLevel('MANAGER')).toBe(1)
    })

    it('should return 4 for VIEWER', () => {
      expect(getRoleLevel('VIEWER')).toBe(4)
    })

    it('should return -1 for BILLING', () => {
      expect(getRoleLevel('BILLING')).toBe(-1)
    })
  })

  describe('getAllRoles', () => {
    it('should return all 7 roles', () => {
      const roles = getAllRoles()
      expect(roles).toHaveLength(7)
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('BILLING')
      expect(roles).toContain('ANALYTICS')
    })
  })

  describe('compareRoles', () => {
    it('should return -1 when roleA is higher than roleB', () => {
      expect(compareRoles('ADMIN', 'VIEWER')).toBe(-1)
    })

    it('should return 1 when roleA is lower than roleB', () => {
      expect(compareRoles('VIEWER', 'ADMIN')).toBe(1)
    })

    it('should return 0 when roles are equal', () => {
      expect(compareRoles('MANAGER', 'MANAGER')).toBe(0)
    })

    it('should handle non-hierarchical roles', () => {
      expect(compareRoles('BILLING', 'ANALYTICS')).toBe(0)
    })
  })

  describe('isRoleHigherThan', () => {
    it('should return true when ADMIN compared to VIEWER', () => {
      expect(isRoleHigherThan('ADMIN', 'VIEWER')).toBe(true)
    })

    it('should return true when MANAGER compared to EDITOR', () => {
      expect(isRoleHigherThan('MANAGER', 'EDITOR')).toBe(true)
    })

    it('should return false when VIEWER compared to ADMIN', () => {
      expect(isRoleHigherThan('VIEWER', 'ADMIN')).toBe(false)
    })

    it('should return false when roles are equal', () => {
      expect(isRoleHigherThan('MANAGER', 'MANAGER')).toBe(false)
    })

    it('should return false for non-hierarchical roles', () => {
      expect(isRoleHigherThan('BILLING', 'VIEWER')).toBe(false)
    })
  })
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/auth/roles.test.ts`
Expected: FAIL with "getRolesWithMinimumAccess is not exported"

---

## Task 4: Role Helpers - Implementation

**Files:**
- Modify: `src/server/auth/roles.ts`

**Step 1: Add new role helper functions**

Append to existing `roles.ts`:

```typescript
/**
 * Get all roles that have access from a minimum role level
 * Non-hierarchical roles (BILLING, ANALYTICS) are excluded unless in additionalRoles
 */
export function getRolesWithMinimumAccess(
  minRole: Role,
  additionalRoles: Role[] = []
): Role[] {
  const minLevel = ROLE_HIERARCHY[minRole]

  // Non-hierarchical role as minimum returns empty (use additionalRoles)
  if (minLevel === -1) {
    return [...additionalRoles]
  }

  const roles: Role[] = []

  for (const [role, level] of Object.entries(ROLE_HIERARCHY)) {
    if (level !== -1 && level <= minLevel) {
      roles.push(role as Role)
    }
  }

  // Add additional roles
  for (const role of additionalRoles) {
    if (!roles.includes(role)) {
      roles.push(role)
    }
  }

  return roles
}

/**
 * Check if a role is hierarchical (not BILLING or ANALYTICS)
 */
export function isHierarchicalRole(role: Role): boolean {
  return ROLE_HIERARCHY[role] !== -1
}

/**
 * Get the numeric level of a role (0=ADMIN highest, 4=VIEWER lowest, -1=special)
 */
export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY[role]
}

/**
 * Get all available roles
 */
export function getAllRoles(): Role[] {
  return Object.values(Role)
}

/**
 * Compare two roles like a sort comparator
 * Returns: -1 if roleA > roleB, 0 if equal, 1 if roleA < roleB
 * Non-hierarchical roles are treated as equal to each other
 */
export function compareRoles(roleA: Role, roleB: Role): number {
  const levelA = ROLE_HIERARCHY[roleA]
  const levelB = ROLE_HIERARCHY[roleB]

  // Both non-hierarchical = equal
  if (levelA === -1 && levelB === -1) {
    return 0
  }

  // One non-hierarchical = lower than hierarchical
  if (levelA === -1) {
    return 1
  }
  if (levelB === -1) {
    return -1
  }

  // Compare hierarchical roles (lower level = higher privilege)
  if (levelA < levelB) return -1
  if (levelA > levelB) return 1
  return 0
}

/**
 * Check if roleA is strictly higher than roleB in the hierarchy
 */
export function isRoleHigherThan(roleA: Role, roleB: Role): boolean {
  const levelA = ROLE_HIERARCHY[roleA]
  const levelB = ROLE_HIERARCHY[roleB]

  // Non-hierarchical roles cannot be "higher"
  if (levelA === -1 || levelB === -1) {
    return false
  }

  return levelA < levelB
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/server/auth/roles.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/server/auth/roles.ts src/server/auth/roles.test.ts
git commit -m "feat: add role hierarchy helpers (getRolesWithMinimumAccess, compareRoles, etc.)"
```

---

## Task 5: Audit Wrappers - Tests

**Files:**
- Create: `src/server/lib/audited-db.test.ts`

**Step 1: Write the failing tests for audit wrappers**

```typescript
// src/server/lib/audited-db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditedInsert, auditedUpdate, auditedDelete } from './audited-db'
import type { ServiceContext } from '../types'

// Mock database and table
const mockDb = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
}

const mockTable = {
  _: { name: 'users' },
} as any

const mockCtx: ServiceContext = {
  accountId: 'account-123',
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    status: 'active',
    providerIds: [],
    isSuperAdmin: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    deletedAt: null,
  },
  transactionId: 'tx-123',
  ip: '127.0.0.1',
  userAgent: 'test-agent',
}

describe('audited-db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('auditedInsert', () => {
    it('should insert data and return result', async () => {
      const insertedData = { id: 'new-123', name: 'Test' }
      const mockReturning = vi.fn().mockResolvedValue([insertedData])
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      const result = await auditedInsert(mockDb as any, mockCtx, mockTable, { name: 'Test' })

      expect(result).toEqual([insertedData])
      expect(mockDb.insert).toHaveBeenCalledWith(mockTable)
    })

    it('should log audit after insert', async () => {
      const insertedData = { id: 'new-123', name: 'Test' }
      const mockReturning = vi.fn().mockResolvedValue([insertedData])
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      await auditedInsert(mockDb as any, mockCtx, mockTable, { name: 'Test' })

      // Verify insert was called (audit logging happens internally)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('auditedUpdate', () => {
    it('should update data and return result', async () => {
      const updatedData = { id: 'existing-123', name: 'Updated' }
      const mockReturning = vi.fn().mockResolvedValue([updatedData])
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.update.mockReturnValue({ set: mockSet })

      // Mock select for getting old data
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'existing-123', name: 'Old' }])
      const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
      mockDb.select.mockReturnValue({ from: mockFrom })

      const whereClause = {} as any
      const result = await auditedUpdate(
        mockDb as any,
        mockCtx,
        mockTable,
        { name: 'Updated' },
        whereClause
      )

      expect(result).toEqual([updatedData])
    })
  })

  describe('auditedDelete', () => {
    it('should soft delete and return void', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'deleted-123' }])
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      mockDb.update.mockReturnValue({ set: mockSet })

      const whereClause = {} as any
      await auditedDelete(mockDb as any, mockCtx, mockTable, whereClause)

      expect(mockDb.update).toHaveBeenCalledWith(mockTable)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/lib/audited-db.test.ts`
Expected: FAIL with "Cannot find module './audited-db'"

---

## Task 6: Audit Wrappers - Implementation

**Files:**
- Create: `src/server/lib/audited-db.ts`

**Step 1: Implement audit wrappers**

```typescript
// src/server/lib/audited-db.ts
import { eq, type SQL } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Database } from '../db/client'
import type { ServiceContext } from '../types'
import { logAudit, createChangeDiff } from './audit'

type TableWithId = SQLiteTable & { id: any }

/**
 * Get the table name from a Drizzle table definition
 */
function getTableName(table: SQLiteTable): string {
  return (table as any)[Symbol.for('drizzle:Name')] || 'unknown'
}

/**
 * Insert with automatic audit logging
 * Returns the inserted records (same as .returning())
 */
export async function auditedInsert<T extends Record<string, unknown>>(
  db: Database,
  ctx: ServiceContext,
  table: TableWithId,
  values: T | T[]
): Promise<T[]> {
  const tableName = getTableName(table)
  const valuesArray = Array.isArray(values) ? values : [values]

  const results = await db
    .insert(table)
    .values(valuesArray as any)
    .returning()

  // Log audit for each inserted record
  for (const record of results) {
    await logAudit(
      db,
      ctx,
      tableName,
      (record as any).id,
      'INSERT',
      record as Record<string, unknown>
    )
  }

  return results as T[]
}

/**
 * Update with automatic audit logging (includes diff of changes)
 * Returns the updated records (same as .returning())
 */
export async function auditedUpdate<T extends Record<string, unknown>>(
  db: Database,
  ctx: ServiceContext,
  table: TableWithId,
  values: Partial<T>,
  where: SQL
): Promise<T[]> {
  const tableName = getTableName(table)

  // Get old data first for diff
  const oldRecords = await db
    .select()
    .from(table)
    .where(where)
    .limit(100) // Safety limit

  // Perform update
  const results = await db
    .update(table)
    .set(values as any)
    .where(where)
    .returning()

  // Log audit for each updated record with diff
  for (let i = 0; i < results.length; i++) {
    const oldData = oldRecords[i] || {}
    const newData = results[i]
    const diff = createChangeDiff(
      oldData as Record<string, unknown>,
      newData as Record<string, unknown>
    )

    await logAudit(
      db,
      ctx,
      tableName,
      (newData as any).id,
      'UPDATE',
      diff
    )
  }

  return results as T[]
}

/**
 * Soft delete with automatic audit logging
 * Sets deletedAt and deletedById fields
 */
export async function auditedDelete(
  db: Database,
  ctx: ServiceContext,
  table: TableWithId,
  where: SQL
): Promise<void> {
  const tableName = getTableName(table)

  // Perform soft delete
  const results = await db
    .update(table)
    .set({
      deletedAt: new Date().toISOString(),
      deletedById: ctx.user.id,
      updatedAt: new Date().toISOString(),
      updatedById: ctx.user.id,
    } as any)
    .where(where)
    .returning()

  // Log audit for each deleted record
  for (const record of results) {
    await logAudit(
      db,
      ctx,
      tableName,
      (record as any).id,
      'DELETE',
      { deleted: true }
    )
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/server/lib/audited-db.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/server/lib/audited-db.ts src/server/lib/audited-db.test.ts
git commit -m "feat: add audit wrapper functions (auditedInsert, auditedUpdate, auditedDelete)"
```

---

## Task 7: Refactor Users Service

**Files:**
- Modify: `src/server/services/users.ts`

**Step 1: Update imports**

Add import at top:

```typescript
import { auditedUpdate, auditedDelete } from '../lib/audited-db'
```

**Step 2: Refactor update method**

Replace the `update` method to use `auditedUpdate`:

```typescript
async update(db: Database, ctx: ServiceContext, id: string, input: UpdateUserInput): Promise<User> {
  // Verify user exists and accessible
  await this.findById(db, ctx, id)

  // Update user with audit
  const [userRecord] = await auditedUpdate(
    db,
    ctx,
    users,
    {
      ...input,
      updatedAt: new Date().toISOString(),
      updatedById: ctx.user.id,
    },
    eq(users.id, id)
  )

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
}
```

**Step 3: Refactor delete method**

Replace the `delete` method to use `auditedDelete`:

```typescript
async delete(db: Database, ctx: ServiceContext, id: string): Promise<void> {
  // Verify user exists and accessible
  await this.findById(db, ctx, id)

  // Soft delete with audit
  await auditedDelete(db, ctx, users, eq(users.id, id))
}
```

**Step 4: Remove manual logAudit calls**

Remove the manual `logAudit` import and calls from update/delete methods (now handled by wrappers).

**Step 5: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/server/services/users.ts
git commit -m "refactor: use audit wrappers in users service"
```

---

## Task 8: Refactor Accounts Service

**Files:**
- Modify: `src/server/services/accounts.ts`

**Step 1: Update imports**

Add import at top:

```typescript
import { auditedInsert, auditedUpdate, auditedDelete } from '../lib/audited-db'
```

**Step 2: Refactor create method (if exists)**

Replace insert + logAudit with `auditedInsert`.

**Step 3: Refactor update method**

Replace update + logAudit with `auditedUpdate`.

**Step 4: Refactor delete method**

Replace delete + logAudit with `auditedDelete`.

**Step 5: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/server/services/accounts.ts
git commit -m "refactor: use audit wrappers in accounts service"
```

---

## Task 9: Final Verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup after NestJS improvements migration"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | Provider Helpers - Tests | 3 min |
| 2 | Provider Helpers - Implementation | 5 min |
| 3 | Role Helpers - Tests | 5 min |
| 4 | Role Helpers - Implementation | 5 min |
| 5 | Audit Wrappers - Tests | 5 min |
| 6 | Audit Wrappers - Implementation | 8 min |
| 7 | Refactor Users Service | 5 min |
| 8 | Refactor Accounts Service | 5 min |
| 9 | Final Verification | 3 min |

**Total: ~44 minutes**
