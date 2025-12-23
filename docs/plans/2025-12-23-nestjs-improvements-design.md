# Design: NestJS Improvements for Hono Boilerplate

**Date:** 2025-12-23
**Status:** Approved

## Overview

Port valuable features from the NestJS boilerplate to the Hono boilerplate while following Hono best practices.

## Decisions

| Feature | Approach |
|---------|----------|
| Audit Automático | Wrapper de Operações |
| Escopo Audit | Apenas Mutações (INSERT, UPDATE, DELETE) |
| Role Helpers | Completo + Comparação |
| Provider Helpers | Com Parsing |
| Seeders | Manter atual |

---

## 1. Audit Wrappers

### File: `src/server/lib/audited-db.ts`

Wrapper functions that encapsulate Drizzle operations with automatic audit logging.

### API

```typescript
auditedInsert<T>(db: Database, ctx: ServiceContext, table: Table, values: T): Promise<T[]>
auditedUpdate<T>(db: Database, ctx: ServiceContext, table: Table, values: Partial<T>, where: SQL): Promise<T[]>
auditedDelete(db: Database, ctx: ServiceContext, table: Table, where: SQL): Promise<void>
```

### Usage

```typescript
// Before (manual):
const [user] = await db.insert(users).values(data).returning()
await logAudit(db, ctx, 'User', user.id, 'INSERT', data)

// After (wrapper):
const [user] = await auditedInsert(db, ctx, users, data)
```

### Characteristics

- Returns same result as normal Drizzle operations
- Automatically captures: transactionId, userId, ip, userAgent from context
- For UPDATE, calculates diff between old and new values
- Type-safe using Drizzle inference

---

## 2. Role Helpers

### File: `src/server/auth/roles.ts` (expand existing)

### New Functions

```typescript
// Get all roles that have access from a minimum level
getRolesWithMinimumAccess(minRole: Role, additionalRoles?: Role[]): Role[]

// Check if role is in hierarchy (not BILLING/ANALYTICS)
isHierarchicalRole(role: Role): boolean

// Get numeric level of role (0=ADMIN, 4=VIEWER, -1=special)
getRoleLevel(role: Role): number

// Get all available roles
getAllRoles(): Role[]

// Compare two roles (-1, 0, 1 like sort comparator)
compareRoles(roleA: Role, roleB: Role): number

// Check if roleA is higher than roleB in hierarchy
isRoleHigherThan(roleA: Role, roleB: Role): boolean
```

### Examples

| Function | Input | Output |
|----------|-------|--------|
| `getRolesWithMinimumAccess('EDITOR')` | `'EDITOR'` | `['ADMIN', 'MANAGER', 'EDITOR']` |
| `isHierarchicalRole('BILLING')` | `'BILLING'` | `false` |
| `getRoleLevel('MANAGER')` | `'MANAGER'` | `1` |
| `compareRoles('ADMIN', 'VIEWER')` | `'ADMIN', 'VIEWER'` | `-1` |
| `isRoleHigherThan('MANAGER', 'EDITOR')` | `'MANAGER', 'EDITOR'` | `true` |

---

## 3. Provider Helpers

### File: `src/server/lib/providers.ts` (new)

### API

```typescript
const SUPPORTED_PROVIDERS = ['google', 'github', 'microsoft', 'email'] as const
type Provider = typeof SUPPORTED_PROVIDERS[number]

interface ParsedProviderId {
  provider: Provider
  id: string
}

hasProvider(providerIds: string[], providerId: string): boolean
addProvider(providerIds: string[], providerId: string): string[]
removeProvider(providerIds: string[], providerId: string): string[]
parseProviderId(providerId: string): ParsedProviderId | null
```

### Examples

```typescript
const providerIds = ['google|abc123', 'github|xyz789']

hasProvider(providerIds, 'google|abc123')     // → true
addProvider(providerIds, 'microsoft|new456')  // → [..., 'microsoft|new456']
removeProvider(providerIds, 'github|xyz789')  // → ['google|abc123']
parseProviderId('google|abc123')              // → { provider: 'google', id: 'abc123' }
parseProviderId('invalid')                    // → null
```

### Characteristics

- Pure functions (don't mutate original array)
- Return new array for add/remove
- `parseProviderId` returns `null` for invalid format
- Type-safe with Provider union type

---

## 4. File Structure

```
src/server/
├── lib/
│   ├── audit.ts           # Keep (base functions)
│   ├── audited-db.ts      # NEW - audit wrappers
│   └── providers.ts       # NEW - provider helpers
├── auth/
│   ├── roles.ts           # EXPAND - new functions
│   └── roles.test.ts      # EXPAND - new tests
└── services/
    ├── users.ts           # REFACTOR - use audited wrappers
    └── accounts.ts        # REFACTOR - use audited wrappers
```

## 5. Implementation Order

1. `lib/providers.ts` - independent, no dependencies
2. `auth/roles.ts` - expand existing functions
3. `lib/audited-db.ts` - depends on audit.ts
4. Refactor services to use wrappers

## 6. Migration Notes

- Replace manual `logAudit()` calls with wrappers in services
- Keep `logAudit()` available for special cases (auth events)
- Existing tests must continue passing
- Add unit tests for each new module
