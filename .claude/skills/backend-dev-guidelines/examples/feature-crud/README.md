# Feature CRUD Example - Products

Complete example of a CRUD feature following the backend-dev-guidelines patterns.

## Files

| File | Purpose |
|------|---------|
| `schemas.ts` | Zod + OpenAPI validation schemas |
| `routes.ts` | OpenAPI route definitions |
| `handlers.ts` | Request/response logic |
| `service.ts` | Business logic + D1 database |
| `index.ts` | Router with guards |

## Usage

1. Copy this folder to `src/server/routes/{your-feature}/`
2. Rename "products" to your entity name
3. Update schemas for your data model
4. Adjust guards as needed
5. Mount in `src/server/routes/index.ts`

## Request Flow

```
Client Request
    ↓
index.ts (router + guards)
    ↓
handlers.ts (extract params, build context)
    ↓
service.ts (business logic, D1 queries)
    ↓
Response to client
```

## Guards Applied

| Route | Method | Guard |
|-------|--------|-------|
| /products | GET | Auth only |
| /products/:id | GET | Auth only |
| /products | POST | EDITOR+ |
| /products/:id | PATCH | EDITOR+ |
| /products/:id | DELETE | ADMIN |

## Database Table

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_id TEXT,
  updated_by_id TEXT,
  deleted_at TEXT,
  deleted_by_id TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_products_account ON products(account_id);
CREATE INDEX idx_products_status ON products(status);
```
