# Database Patterns - D1 SQL Helpers

Complete guide to working with Cloudflare D1 (SQLite) database.

> **⚠️ FOR CLOUDFLARE/WRANGLER OPERATIONS**: Use the **`wrangler`** skill instead!
> Run `/wrangler` for `wrangler d1`, migrations, KV, R2, secrets, or deployment.
> This guide covers SQL patterns and in-code database access only.

## Table of Contents

- [D1 Overview](#d1-overview)
- [SQL Helper Functions](#sql-helper-functions)
- [Type System](#type-system)
- [Query Patterns](#query-patterns)
- [Batch Operations](#batch-operations)
- [Migrations](#migrations)
- [Common Queries](#common-queries)

---

## D1 Overview

### What is D1?

Cloudflare D1 is a serverless SQLite database that runs at the edge. Key characteristics:

- **SQLite-compatible** - Standard SQL syntax
- **Serverless** - No connection management
- **Edge-distributed** - Low latency globally
- **Per-request binding** - Fresh connection per request

### Database Access Pattern

```typescript
// 1. Database binding in wrangler.json
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "app-db",
    "database_id": "..."
  }]
}

// 2. Access via Hono context
app.use('*', async (c, next) => {
  if (c.env.DB) {
    c.set('db', c.env.DB)
  }
  await next()
})

// 3. Use in handlers
const db = c.get('db')
const result = await queryOne(db, 'SELECT * FROM users WHERE id = ?', [id])
```

---

## SQL Helper Functions

### Available Helpers

Import from `@server/db/sql`:

```typescript
import {
  queryAll,     // SELECT multiple rows
  queryOne,     // SELECT single row
  queryValue,   // SELECT single value
  execute,      // INSERT, UPDATE, DELETE
  executeBatch, // Multiple statements in transaction
  toStringValue,    // Convert unknown to string
  toNullableString, // Convert unknown to string | null
  type SqlRow,
  type SqlParams,
  type SqlValue,
} from '@server/db/sql'
```

### queryAll - Multiple Rows

```typescript
// Basic query
const users = await queryAll(db, 'SELECT * FROM users WHERE status = ?', ['active'])
// Returns: SqlRow[] (Record<string, unknown>[])

// With typed result
const users = await queryAll<{ id: string; name: string }>(
  db,
  'SELECT id, name FROM users WHERE status = ?',
  ['active']
)

// With row mapper
const users = await queryAll(
  db,
  'SELECT * FROM users',
  [],
  (row) => ({
    id: toStringValue(row.id),
    name: toStringValue(row.name),
  })
)
```

### queryOne - Single Row

```typescript
// Returns row or null
const user = await queryOne(db, 'SELECT * FROM users WHERE id = ?', [id])
if (!user) throw new NotFoundError('User')

// With typed result
const user = await queryOne<UserRecord>(
  db,
  'SELECT * FROM users WHERE id = ? LIMIT 1',
  [id]
)

// With row mapper
const user = await queryOne(db, 'SELECT * FROM users WHERE id = ?', [id], mapUserRow)
```

### queryValue - Single Value

```typescript
// Get count
const count = await queryValue<number>(db, 'SELECT count(*) as count FROM users', [], 'count')

// Get first column value
const exists = await queryValue<number>(
  db,
  'SELECT 1 as ok FROM users WHERE email = ? LIMIT 1',
  [email]
)
if (exists) { /* email exists */ }
```

### execute - Non-SELECT Statements

```typescript
// INSERT
await execute(
  db,
  'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
  [crypto.randomUUID(), email, name]
)

// UPDATE
await execute(
  db,
  'UPDATE users SET name = ?, updated_at = ? WHERE id = ?',
  [name, new Date().toISOString(), id]
)

// DELETE
await execute(db, 'DELETE FROM users WHERE id = ?', [id])
```

### executeBatch - Transaction

```typescript
import { executeBatch, type BatchStatement } from '@server/db/sql'

const statements: BatchStatement[] = [
  { statement: 'INSERT INTO users (id, email) VALUES (?, ?)', params: [userId, email] },
  { statement: 'INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)', params: [userId, accountId, 'VIEWER'] },
  { statement: 'INSERT INTO audit_logs (entity, entity_id, action) VALUES (?, ?, ?)', params: ['users', userId, 'INSERT'] },
]

// All succeed or all fail (atomic)
const results = await executeBatch(db, statements)
```

---

## Type System

### SqlValue Types

```typescript
type SqlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | Uint8Array
  | ArrayBuffer
  | Date

type SqlParams = SqlValue[]
```

### Value Normalization

The helpers automatically normalize values:

```typescript
// Boolean → 0/1 (SQLite doesn't have true boolean)
await execute(db, 'INSERT INTO ... (active) VALUES (?)', [true])  // Becomes 1

// Date → ISO string
await execute(db, 'INSERT INTO ... (created_at) VALUES (?)', [new Date()])
// Becomes '2024-01-01T00:00:00.000Z'

// undefined → null
await execute(db, 'INSERT INTO ... (optional) VALUES (?)', [undefined])  // Becomes NULL
```

### Type Conversion Helpers

```typescript
import { toStringValue, toNullableString, type SqlRow } from '@server/db/sql'

function mapRow(row: SqlRow) {
  return {
    // Always string (empty if null/undefined)
    id: toStringValue(row.id),

    // String or null
    deletedAt: toNullableString(row.deleted_at),

    // Number
    price: Number(row.price),

    // Boolean from SQLite (stored as 0/1)
    isActive: row.is_active === 1 || row.is_active === '1',

    // JSON array from text column
    tags: parseJsonArray(row.tags),
  }
}

// Helper for JSON arrays
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

## Query Patterns

### SELECT with Aliases

Use aliases to get camelCase in results:

```typescript
const COLUMNS = `
  id,
  email,
  name,
  status,
  account_id as accountId,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt
`

const rows = await queryAll(db, `SELECT ${COLUMNS} FROM users WHERE ...`)
// row.accountId works (aliased from account_id)
```

### Dynamic WHERE Clauses

```typescript
async function findAll(db, ctx, filters) {
  const whereClauses: string[] = ['deleted_at IS NULL']
  const params: SqlParams = []

  // Multi-tenancy
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('account_id = ?')
    params.push(ctx.accountId)
  }

  // Status filter
  if (filters.status) {
    whereClauses.push('status = ?')
    params.push(filters.status)
  }

  // Search filter
  if (filters.query) {
    whereClauses.push('(name LIKE ? OR email LIKE ?)')
    const like = `%${filters.query}%`
    params.push(like, like)
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`

  return queryAll(db, `SELECT * FROM users ${whereSql}`, params)
}
```

### Pagination

```typescript
import { calculateOffset } from '@server/lib/pagination'

async function findAllPaginated(db, pagination) {
  const offset = calculateOffset(pagination.page, pagination.limit)

  // Count total
  const countRow = await queryOne<{ count: number }>(
    db,
    'SELECT count(*) as count FROM users WHERE deleted_at IS NULL'
  )
  const totalItems = countRow?.count ?? 0

  // Fetch page
  const rows = await queryAll(
    db,
    `SELECT * FROM users
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pagination.limit, offset]
  )

  return { rows, totalItems }
}
```

### EXISTS Checks

```typescript
// Check if record exists (efficient)
const exists = await queryOne(
  db,
  'SELECT 1 as ok FROM users WHERE email = ? LIMIT 1',
  [email]
)

if (exists) {
  throw new ConflictError('Email already exists')
}
```

### INSERT with RETURNING

```typescript
// Get inserted row back
const rows = await queryAll(
  db,
  `INSERT INTO users (id, email, name)
   VALUES (?, ?, ?)
   RETURNING *`,
  [crypto.randomUUID(), email, name]
)

const user = rows[0]
```

### UPDATE with RETURNING

```typescript
// Get updated row back
const rows = await queryAll(
  db,
  `UPDATE users
   SET name = ?, updated_at = ?
   WHERE id = ?
   RETURNING *`,
  [name, new Date().toISOString(), id]
)

const user = rows[0]
```

---

## Batch Operations

### Transactional Inserts

```typescript
import { executeBatch, type BatchStatement } from '@server/db/sql'

async function createUserWithAccount(db, userData, accountId, role) {
  const userId = crypto.randomUUID()

  const statements: BatchStatement[] = [
    {
      statement: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
      params: [userId, userData.email, userData.name],
    },
    {
      statement: 'INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)',
      params: [userId, accountId, role],
    },
  ]

  await executeBatch(db, statements)
  return userId
}
```

### Bulk Updates

```typescript
async function updateManyStatus(db, ids: string[], status: string) {
  const statements: BatchStatement[] = ids.map((id) => ({
    statement: 'UPDATE products SET status = ?, updated_at = ? WHERE id = ?',
    params: [status, new Date().toISOString(), id],
  }))

  await executeBatch(db, statements)
}
```

### Batch Limitations

- D1 batch operations are atomic (all succeed or all fail)
- Maximum ~100 statements per batch (practical limit)
- All statements run in a single transaction

---

## Migrations

### Migration Files

Migrations are SQL files in `migrations/`:

```
migrations/
├── 0001_create_users.sql
├── 0002_create_accounts.sql
├── 0003_create_user_accounts.sql
├── 0004_add_audit_logs.sql
└── ...
```

### Migration Commands

```bash
# Apply migrations locally
pnpm db:migrate:local

# Apply migrations to production
pnpm db:migrate:remote

# Seed local database
pnpm db:seed:local
```

### Migration Example

```sql
-- migrations/0005_create_products.sql

CREATE TABLE products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by_id TEXT,
  updated_by_id TEXT,
  deleted_at TEXT,
  deleted_by_id TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (created_by_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_id) REFERENCES users(id),
  FOREIGN KEY (deleted_by_id) REFERENCES users(id)
);

CREATE INDEX idx_products_account ON products(account_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_deleted ON products(deleted_at);
```

### Schema Conventions

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | TEXT | UUID | Primary key |
| `account_id` | TEXT | - | Multi-tenancy |
| `created_at` | TEXT | datetime('now') | Audit |
| `updated_at` | TEXT | datetime('now') | Audit |
| `created_by_id` | TEXT | - | Audit |
| `updated_by_id` | TEXT | - | Audit |
| `deleted_at` | TEXT | NULL | Soft delete |
| `deleted_by_id` | TEXT | NULL | Soft delete audit |

---

## Common Queries

### Find by ID

```typescript
const row = await queryOne(
  db,
  `SELECT * FROM products WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
  [id]
)
```

### Find by Email (Unique)

```typescript
const row = await queryOne(
  db,
  `SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
  [email]
)
```

### List with Filters

```typescript
const rows = await queryAll(
  db,
  `SELECT * FROM products
   WHERE account_id = ?
     AND deleted_at IS NULL
     AND status = ?
   ORDER BY created_at DESC
   LIMIT ? OFFSET ?`,
  [accountId, 'active', limit, offset]
)
```

### Count

```typescript
const countRow = await queryOne<{ count: number }>(
  db,
  `SELECT count(*) as count FROM products WHERE account_id = ? AND deleted_at IS NULL`,
  [accountId]
)
const total = countRow?.count ?? 0
```

### Search (LIKE)

```typescript
const rows = await queryAll(
  db,
  `SELECT * FROM products
   WHERE account_id = ?
     AND deleted_at IS NULL
     AND (name LIKE ? OR description LIKE ?)
   LIMIT ?`,
  [accountId, `%${query}%`, `%${query}%`, limit]
)
```

### Join Tables

```typescript
const rows = await queryAll(
  db,
  `SELECT
     u.id, u.email, u.name,
     ua.role,
     a.name as accountName
   FROM users u
   JOIN user_accounts ua ON ua.user_id = u.id
   JOIN accounts a ON a.id = ua.account_id
   WHERE ua.account_id = ?
     AND u.deleted_at IS NULL
   ORDER BY u.name`,
  [accountId]
)
```

### Upsert Pattern

```typescript
// Check and insert/update
const existing = await queryOne(
  db,
  'SELECT id FROM user_accounts WHERE user_id = ? AND account_id = ? LIMIT 1',
  [userId, accountId]
)

if (existing) {
  await execute(
    db,
    'UPDATE user_accounts SET role = ? WHERE user_id = ? AND account_id = ?',
    [role, userId, accountId]
  )
} else {
  await execute(
    db,
    'INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)',
    [userId, accountId, role]
  )
}
```

### Soft Delete

```typescript
await execute(
  db,
  `UPDATE products
   SET deleted_at = ?, deleted_by_id = ?, updated_at = ?, updated_by_id = ?
   WHERE id = ?`,
  [new Date().toISOString(), userId, new Date().toISOString(), userId, id]
)
```

### Restore Soft Deleted

```typescript
await execute(
  db,
  `UPDATE products
   SET deleted_at = NULL, deleted_by_id = NULL, updated_at = ?, updated_by_id = ?
   WHERE id = ?`,
  [new Date().toISOString(), userId, id]
)
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [services-layer.md](services-layer.md) - Services that use these patterns
- [architecture-overview.md](architecture-overview.md) - Where database fits
