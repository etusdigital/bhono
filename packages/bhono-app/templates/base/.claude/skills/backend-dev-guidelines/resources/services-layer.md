# Services Layer - Business Logic Patterns

Complete guide to implementing services with D1 database and audit logging.

## Table of Contents

- [Service Structure](#service-structure)
- [ServiceContext](#servicecontext)
- [CRUD Operations](#crud-operations)
- [Multi-Tenancy](#multi-tenancy)
- [Audit Integration](#audit-integration)
- [Row Mapping](#row-mapping)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Complete Service Example](#complete-service-example)

---

## Service Structure

### Service as Exported Object

Services are exported objects with async methods (not classes):

```typescript
// services/products.ts
import type { ServiceContext, PaginatedResponse } from '../types'

export const productsService = {
  async findAll(db: D1Database, ctx: ServiceContext, pagination: PaginationQuery) {
    return findAllSql(db, ctx, pagination)
  },

  async findById(db: D1Database, ctx: ServiceContext, id: string) {
    return findByIdSql(db, ctx, id)
  },

  async create(db: D1Database, ctx: ServiceContext, input: CreateProductInput) {
    return createSql(db, ctx, input)
  },

  async update(db: D1Database, ctx: ServiceContext, id: string, input: UpdateProductInput) {
    return updateSql(db, ctx, id, input)
  },

  async delete(db: D1Database, ctx: ServiceContext, id: string) {
    await deleteSql(db, ctx, id)
  },
}
```

### File Organization

```typescript
// services/products.ts

// 1. Imports
import type { ProductRecord } from '../db/records'
import type { ServiceContext, PaginatedResponse, Product } from '../types'
import { auditedInsert, auditedUpdate, auditedDelete } from '../lib/audited-db'
import { queryAll, queryOne, toStringValue, type SqlRow, type SqlParams } from '../db/sql'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError, ForbiddenError } from '../lib/errors'

// 2. Input types
interface CreateProductInput {
  name: string
  price: number
}

interface UpdateProductInput {
  name?: string
  price?: number
  status?: 'draft' | 'active' | 'archived'
}

// 3. SQL column selection
const PRODUCT_SELECT_COLUMNS = `
  id,
  name,
  price,
  status,
  account_id as accountId,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt
`

// 4. Row mapping functions
function mapProductRow(row: SqlRow): ProductRecord { /* ... */ }
function toProduct(record: ProductRecord): Product { /* ... */ }

// 5. SQL implementation functions
async function findAllSql(...) { /* ... */ }
async function findByIdSql(...) { /* ... */ }
async function createSql(...) { /* ... */ }
async function updateSql(...) { /* ... */ }
async function deleteSql(...) { /* ... */ }

// 6. Exported service object
export const productsService = { /* ... */ }
```

---

## ServiceContext

### Definition

```typescript
// types/index.ts
export interface ServiceContext {
  accountId: string      // Current tenant
  user: User             // Authenticated user
  userRole?: Role | null // User's role in account
  transactionId?: string // Request correlation ID
  ip?: string            // Client IP for audit
  userAgent?: string     // Client user agent for audit
}
```

### Usage in Service Methods

```typescript
async function createSql(
  db: D1Database,
  ctx: ServiceContext,
  input: CreateProductInput
): Promise<Product> {
  // Access user for permission check
  if (!ctx.user.isSuperAdmin && ctx.userRole !== 'ADMIN') {
    throw new ForbiddenError('Only admins can create products')
  }

  // Use accountId for tenant isolation
  const record = await auditedInsert<ProductRecord>(db, ctx, 'products', {
    name: input.name,
    price: input.price,
    account_id: ctx.accountId,  // Tenant assignment
    created_by_id: ctx.user.id, // Audit trail
  })

  // ctx is passed to auditedInsert for:
  // - transactionId (correlate logs)
  // - user.id (who made the change)
  // - ip, userAgent (audit metadata)

  return toProduct(mapProductRow(record[0]))
}
```

### Building ServiceContext in Handlers

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

---

## CRUD Operations

### Create Operation

```typescript
async function createSql(
  db: D1Database,
  ctx: ServiceContext,
  input: CreateProductInput
): Promise<Product> {
  // 1. Business rule validation
  const existing = await queryOne(
    db,
    `SELECT 1 as ok FROM products WHERE name = ? AND account_id = ? AND deleted_at IS NULL LIMIT 1`,
    [input.name, ctx.accountId]
  )

  if (existing) {
    throw new ConflictError('Product with this name already exists')
  }

  // 2. Insert with audit logging
  const results = await auditedInsert<ProductRecord>(db, ctx, 'products', {
    name: input.name,
    price: input.price,
    status: 'draft',
    account_id: ctx.accountId,
    created_by_id: ctx.user.id,
  })

  // 3. Return mapped result
  const record = results.at(0)
  if (!record) {
    throw new Error('Failed to create product')
  }

  return toProduct(mapProductRow(record as unknown as SqlRow))
}
```

### Read Operation (Single)

```typescript
async function findByIdSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string
): Promise<Product> {
  // 1. Query with soft-delete filter
  const row = await queryOne(
    db,
    `SELECT ${PRODUCT_SELECT_COLUMNS}
     FROM products p
     WHERE p.id = ? AND p.deleted_at IS NULL
     LIMIT 1`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('Product')
  }

  // 2. Multi-tenancy check (unless super admin)
  if (!ctx.user.isSuperAdmin) {
    if (toStringValue(row.accountId ?? row.account_id) !== ctx.accountId) {
      throw new NotFoundError('Product')
    }
  }

  return toProduct(mapProductRow(row))
}
```

### Read Operation (List with Pagination)

```typescript
async function findAllSql(
  db: D1Database,
  ctx: ServiceContext,
  pagination: PaginationQuery
): Promise<PaginatedResponse<Product>> {
  const offset = calculateOffset(pagination.page, pagination.limit)
  const whereClauses: string[] = ['p.deleted_at IS NULL']
  const params: SqlParams = []

  // Multi-tenancy filter
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('p.account_id = ?')
    params.push(ctx.accountId)
  }

  // Search filter
  if (pagination.query) {
    whereClauses.push('p.name LIKE ?')
    params.push(`%${pagination.query}%`)
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`

  // Count query
  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM products p ${whereSql}`,
    params
  )
  const totalItems = countRow?.count ?? 0

  // Data query
  const rows = await queryAll(
    db,
    `SELECT ${PRODUCT_SELECT_COLUMNS}
     FROM products p
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  )

  return {
    data: rows.map((row) => toProduct(mapProductRow(row))),
    meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
  }
}
```

### Update Operation

```typescript
async function updateSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  // 1. Verify exists (throws NotFoundError)
  await findByIdSql(db, ctx, id)

  // 2. Build updates object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by_id: ctx.user.id,
  }

  if (input.name !== undefined) updates.name = input.name
  if (input.price !== undefined) updates.price = input.price
  if (input.status !== undefined) updates.status = input.status

  // 3. Audited update (logs diff automatically)
  const results = await auditedUpdate<ProductRecord>(
    db,
    ctx,
    'products',
    updates,
    { clause: 'id = ?', params: [id] }
  )

  const record = results.at(0)
  if (!record) {
    throw new Error('Failed to update product')
  }

  return toProduct(mapProductRow(record as unknown as SqlRow))
}
```

### Delete Operation (Soft Delete)

```typescript
async function deleteSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string
): Promise<void> {
  // 1. Verify exists
  await findByIdSql(db, ctx, id)

  // 2. Soft delete (sets deleted_at, deleted_by_id)
  await auditedDelete(db, ctx, 'products', {
    clause: 'id = ?',
    params: [id],
  })
}
```

### Restore Operation

```typescript
async function restoreSql(
  db: D1Database,
  ctx: ServiceContext,
  id: string
): Promise<Product> {
  // 1. Find deleted record
  const row = await queryOne(
    db,
    `SELECT ${PRODUCT_SELECT_COLUMNS}
     FROM products p
     WHERE p.id = ? AND p.deleted_at IS NOT NULL
     LIMIT 1`,
    [id]
  )

  if (!row) {
    throw new NotFoundError('Product not found or not deleted')
  }

  // 2. Restore (clear deleted fields)
  const results = await auditedUpdate<ProductRecord>(
    db,
    ctx,
    'products',
    { deleted_at: null, deleted_by_id: null },
    { clause: 'id = ?', params: [id] }
  )

  const record = results.at(0)
  if (!record) {
    throw new NotFoundError('Failed to restore product')
  }

  return toProduct(mapProductRow(record as unknown as SqlRow))
}
```

---

## Multi-Tenancy

### Account-Based Data Isolation

Every entity belongs to an account (tenant):

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,  -- Tenant reference
  name TEXT NOT NULL,
  -- ...
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

### Query Filtering

```typescript
async function findAllSql(db: D1Database, ctx: ServiceContext, ...) {
  const whereClauses: string[] = ['p.deleted_at IS NULL']
  const params: SqlParams = []

  // ALWAYS filter by account unless super admin
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('p.account_id = ?')
    params.push(ctx.accountId)
  }

  // ...
}
```

### Access Verification

```typescript
async function findByIdSql(db: D1Database, ctx: ServiceContext, id: string) {
  const row = await queryOne(db, `SELECT ... FROM products WHERE id = ?`, [id])

  if (!row) throw new NotFoundError('Product')

  // Verify tenant ownership
  if (!ctx.user.isSuperAdmin) {
    const accountId = toStringValue(row.accountId ?? row.account_id)
    if (accountId !== ctx.accountId) {
      throw new NotFoundError('Product')  // Don't reveal existence
    }
  }

  return toProduct(mapProductRow(row))
}
```

### Super Admin Bypass

Super admins can access all data:

```typescript
if (ctx.user.isSuperAdmin) {
  // No account filter - can see all data
} else {
  // Must filter by ctx.accountId
}
```

---

## Audit Integration

### Audited Operations

Use `auditedInsert`, `auditedUpdate`, `auditedDelete` for automatic audit logging:

```typescript
import { auditedInsert, auditedUpdate, auditedDelete } from '../lib/audited-db'

// Insert - logs INSERT action
const results = await auditedInsert<ProductRecord>(db, ctx, 'products', {
  name: 'Widget',
  price: 99.99,
  account_id: ctx.accountId,
})

// Update - logs UPDATE action with diff
await auditedUpdate<ProductRecord>(db, ctx, 'products', updates, {
  clause: 'id = ?',
  params: [id],
})

// Delete - logs DELETE action (soft delete)
await auditedDelete(db, ctx, 'products', {
  clause: 'id = ?',
  params: [id],
})
```

### What Gets Logged

| Operation | Action | Changes Field |
|-----------|--------|---------------|
| `auditedInsert` | INSERT | Full inserted record |
| `auditedUpdate` | UPDATE | Diff of old vs new |
| `auditedDelete` | DELETE | `{ deleted: true }` |

### Audit Log Entry

```typescript
// audit_logs table entry
{
  id: "audit-uuid",
  transaction_id: "tx-uuid",      // From ctx.transactionId
  account_id: "account-uuid",     // From ctx.accountId
  user_id: "user-uuid",           // From ctx.user.id
  entity: "products",             // Table name
  entity_id: "product-uuid",      // Record ID
  action: "UPDATE",               // INSERT, UPDATE, DELETE
  changes: { name: "New Name" },  // What changed
  ip_address: "192.168.1.1",      // From ctx.ip
  user_agent: "Mozilla/5.0...",   // From ctx.userAgent
  timestamp: "2024-01-01T00:00:00Z",
}
```

### Manual Audit Logging

For complex operations, use `logAudit` directly:

```typescript
import { logAudit } from '../lib/audit'

// Log custom action
await logAudit(db, ctx, 'UserAccount', `${userId}-${accountId}`, 'UPDATE', {
  role: newRole,
})
```

---

## Row Mapping

### Why Row Mapping?

D1 returns raw SQL rows with snake_case columns. Services return domain objects with camelCase properties:

```
SQL Row (snake_case) → Record Type → Domain Type (camelCase)
```

### SQL Column Aliases

Use aliases in SELECT to get camelCase names:

```typescript
const PRODUCT_SELECT_COLUMNS = `
  id,
  name,
  price,
  status,
  account_id as accountId,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt,
  created_by_id as createdById
`
```

### Mapping Functions

```typescript
import { toStringValue, toNullableString, type SqlRow } from '../db/sql'

// Database record type
interface ProductRecord {
  id: string
  name: string
  price: number
  status: 'draft' | 'active' | 'archived'
  accountId: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// Map SQL row to record
function mapProductRow(row: SqlRow): ProductRecord {
  // Handle both aliased and non-aliased column names
  const accountId = row.accountId ?? row.account_id
  const createdAt = row.createdAt ?? row.created_at
  const updatedAt = row.updatedAt ?? row.updated_at
  const deletedAt = row.deletedAt ?? row.deleted_at

  return {
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    price: Number(row.price),
    status: (row.status as 'draft' | 'active' | 'archived') ?? 'draft',
    accountId: toStringValue(accountId),
    createdAt: toStringValue(createdAt),
    updatedAt: toStringValue(updatedAt),
    deletedAt: toNullableString(deletedAt),
  }
}

// Domain type (public API)
interface Product {
  id: string
  name: string
  price: number
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

// Map record to domain type (hide internal fields)
function toProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    name: record.name,
    price: record.price,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    // Note: deletedAt, accountId not exposed
  }
}
```

### Type Conversion Helpers

```typescript
import { toStringValue, toNullableString } from '../db/sql'

// Always string (throws if null/undefined)
const id = toStringValue(row.id)

// String or null
const deletedAt = toNullableString(row.deleted_at)

// Boolean from SQLite (0/1 or 'true'/'false')
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

// JSON arrays from SQLite text
function parseJsonArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}
```

---

## Error Handling

### Custom Error Classes

```typescript
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../lib/errors'

// Entity not found
if (!row) throw new NotFoundError('Product')
// → 404 "Product not found"

// Duplicate/conflict
if (existing) throw new ConflictError('Product with this name already exists')
// → 409 "Product with this name already exists"

// Permission denied
if (!canAccess) throw new ForbiddenError('You do not have permission')
// → 403 "You do not have permission"

// Validation error
if (!valid) throw new ValidationError('Invalid input', { field: 'name', message: 'Required' })
// → 400 "Invalid input" with details
```

### Error Propagation

Services throw errors; the global `errorHandler` catches and formats them:

```typescript
// Service throws
async function findByIdSql(...) {
  const row = await queryOne(db, ...)
  if (!row) throw new NotFoundError('Product')  // Thrown here
  return toProduct(mapProductRow(row))
}

// Handler calls service (error bubbles up)
export const getProductHandler = async (c) => {
  const product = await productsService.findById(db, ctx, id)
  return c.json({ data: product }, 200)
}
// If NotFoundError thrown, errorHandler returns 404
```

---

## Pagination

### Pagination Types

```typescript
// Input
interface PaginationQuery {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  query?: string  // Search term
}

// Output
interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

interface PaginationMeta {
  currentPage: number
  limit: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}
```

### Pagination Helpers

```typescript
import { calculateOffset, createPaginationMeta } from '../lib/pagination'

async function findAllSql(db, ctx, pagination) {
  const offset = calculateOffset(pagination.page, pagination.limit)

  // Count total
  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM products WHERE ...`,
    params
  )
  const totalItems = countRow?.count ?? 0

  // Fetch page
  const rows = await queryAll(
    db,
    `SELECT ... FROM products WHERE ... LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  )

  return {
    data: rows.map((row) => toProduct(mapProductRow(row))),
    meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
  }
}
```

---

## Complete Service Example

```typescript
// services/products.ts
import type { ProductRecord } from '../db/records'
import { auditedInsert, auditedUpdate, auditedDelete } from '../lib/audited-db'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import { NotFoundError, ConflictError, ForbiddenError } from '../lib/errors'
import type { ServiceContext, PaginationQuery, PaginatedResponse, Product } from '../types'
import { queryAll, queryOne, toStringValue, toNullableString, type SqlRow, type SqlParams } from '../db/sql'

interface CreateProductInput {
  name: string
  price: number
}

interface UpdateProductInput {
  name?: string
  price?: number
  status?: 'draft' | 'active' | 'archived'
}

const PRODUCT_SELECT_COLUMNS = `
  id, name, price, status,
  account_id as accountId,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt
`

function mapProductRow(row: SqlRow): ProductRecord {
  return {
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    price: Number(row.price),
    status: (row.status as 'draft' | 'active' | 'archived') ?? 'draft',
    accountId: toStringValue(row.accountId ?? row.account_id),
    createdAt: toStringValue(row.createdAt ?? row.created_at),
    updatedAt: toStringValue(row.updatedAt ?? row.updated_at),
    deletedAt: toNullableString(row.deletedAt ?? row.deleted_at),
  }
}

function toProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    name: record.name,
    price: record.price,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

async function findAllSql(
  db: D1Database,
  ctx: ServiceContext,
  pagination: PaginationQuery
): Promise<PaginatedResponse<Product>> {
  const offset = calculateOffset(pagination.page, pagination.limit)
  const whereClauses: string[] = ['p.deleted_at IS NULL']
  const params: SqlParams = []

  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('p.account_id = ?')
    params.push(ctx.accountId)
  }

  if (pagination.query) {
    whereClauses.push('p.name LIKE ?')
    params.push(`%${pagination.query}%`)
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`

  const countRow = await queryOne<{ count: number }>(db, `SELECT count(*) as count FROM products p ${whereSql}`, params)
  const totalItems = countRow?.count ?? 0

  const rows = await queryAll(db, `SELECT ${PRODUCT_SELECT_COLUMNS} FROM products p ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [...params, pagination.limit, offset])

  return {
    data: rows.map((row) => toProduct(mapProductRow(row))),
    meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
  }
}

async function findByIdSql(db: D1Database, ctx: ServiceContext, id: string): Promise<Product> {
  const row = await queryOne(db, `SELECT ${PRODUCT_SELECT_COLUMNS} FROM products p WHERE p.id = ? AND p.deleted_at IS NULL LIMIT 1`, [id])
  if (!row) throw new NotFoundError('Product')

  if (!ctx.user.isSuperAdmin && toStringValue(row.accountId ?? row.account_id) !== ctx.accountId) {
    throw new NotFoundError('Product')
  }

  return toProduct(mapProductRow(row))
}

async function createSql(db: D1Database, ctx: ServiceContext, input: CreateProductInput): Promise<Product> {
  const existing = await queryOne(db, `SELECT 1 as ok FROM products WHERE name = ? AND account_id = ? AND deleted_at IS NULL LIMIT 1`, [input.name, ctx.accountId])
  if (existing) throw new ConflictError('Product with this name already exists')

  const results = await auditedInsert<ProductRecord>(db, ctx, 'products', {
    name: input.name,
    price: input.price,
    status: 'draft',
    account_id: ctx.accountId,
    created_by_id: ctx.user.id,
  })

  const record = results.at(0)
  if (!record) throw new Error('Failed to create product')

  return toProduct(mapProductRow(record as unknown as SqlRow))
}

async function updateSql(db: D1Database, ctx: ServiceContext, id: string, input: UpdateProductInput): Promise<Product> {
  await findByIdSql(db, ctx, id)

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by_id: ctx.user.id,
  }
  if (input.name !== undefined) updates.name = input.name
  if (input.price !== undefined) updates.price = input.price
  if (input.status !== undefined) updates.status = input.status

  const results = await auditedUpdate<ProductRecord>(db, ctx, 'products', updates, { clause: 'id = ?', params: [id] })

  const record = results.at(0)
  if (!record) throw new Error('Failed to update product')

  return toProduct(mapProductRow(record as unknown as SqlRow))
}

async function deleteSql(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
  await findByIdSql(db, ctx, id)
  await auditedDelete(db, ctx, 'products', { clause: 'id = ?', params: [id] })
}

async function restoreSql(db: D1Database, ctx: ServiceContext, id: string): Promise<Product> {
  const row = await queryOne(db, `SELECT ${PRODUCT_SELECT_COLUMNS} FROM products p WHERE p.id = ? AND p.deleted_at IS NOT NULL LIMIT 1`, [id])
  if (!row) throw new NotFoundError('Product not found or not deleted')

  const results = await auditedUpdate<ProductRecord>(db, ctx, 'products', { deleted_at: null, deleted_by_id: null }, { clause: 'id = ?', params: [id] })

  const record = results.at(0)
  if (!record) throw new NotFoundError('Failed to restore product')

  return toProduct(mapProductRow(record as unknown as SqlRow))
}

export const productsService = {
  async findAll(db: D1Database, ctx: ServiceContext, pagination: PaginationQuery) {
    return findAllSql(db, ctx, pagination)
  },
  async findById(db: D1Database, ctx: ServiceContext, id: string) {
    return findByIdSql(db, ctx, id)
  },
  async create(db: D1Database, ctx: ServiceContext, input: CreateProductInput) {
    return createSql(db, ctx, input)
  },
  async update(db: D1Database, ctx: ServiceContext, id: string, input: UpdateProductInput) {
    return updateSql(db, ctx, id, input)
  },
  async delete(db: D1Database, ctx: ServiceContext, id: string) {
    await deleteSql(db, ctx, id)
  },
  async restore(db: D1Database, ctx: ServiceContext, id: string) {
    return restoreSql(db, ctx, id)
  },
}
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [database-patterns.md](database-patterns.md) - SQL helpers
- [routing-and-handlers.md](routing-and-handlers.md) - Handlers that call services
- [error-handling.md](error-handling.md) - Custom errors
