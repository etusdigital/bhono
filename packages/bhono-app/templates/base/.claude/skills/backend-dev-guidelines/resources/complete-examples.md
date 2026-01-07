# Complete Examples - Full Working Code

Real-world examples showing complete implementation patterns for Hono.js on Cloudflare Workers.

## Table of Contents

- [Complete Feature: Products CRUD](#complete-feature-products-crud)
- [Adding Guards to Routes](#adding-guards-to-routes)
- [Service with Pagination](#service-with-pagination)
- [Handler with Context Building](#handler-with-context-building)
- [Request Flow Diagram](#request-flow-diagram)
- [File Structure Summary](#file-structure-summary)

---

## Complete Feature: Products CRUD

Full implementation of a Products resource with all CRUD operations.

### 1. Schemas (`routes/products/schemas.ts`)

```typescript
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const ProductSchema = z
  .object({
    id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    name: z.string().openapi({ example: 'Widget Pro' }),
    description: z.string().nullable().openapi({ example: 'A professional widget' }),
    price: z.number().openapi({ example: 99.99 }),
    status: z.enum(['draft', 'active', 'archived']).openapi({ example: 'active' }),
    createdAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('Product')

export const CreateProductSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'Widget Pro' }),
    description: z.string().max(1000).optional().openapi({ example: 'A professional widget' }),
    price: z.number().min(0).openapi({ example: 99.99 }),
  })
  .openapi('CreateProductInput')

export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Widget Pro v2' }),
    description: z.string().max(1000).optional().openapi({ example: 'Updated description' }),
    price: z.number().min(0).optional().openapi({ example: 149.99 }),
    status: z.enum(['draft', 'active', 'archived']).optional().openapi({ example: 'active' }),
  })
  .openapi('UpdateProductInput')

export const PaginatedProductsSchema = createPaginatedSchema(ProductSchema, 'Products')
```

### 2. Routes (`routes/products/routes.ts`)

```typescript
import { createRoute, z } from '@hono/zod-openapi'
import {
  ProductSchema,
  PaginatedProductsSchema,
  CreateProductSchema,
  UpdateProductSchema,
} from './schemas'
import { ErrorResponseSchema, PaginationQuerySchema, IdParamSchema } from '../schemas'

export const listProductsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Products'],
  summary: 'List products in account',
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: 'List of products',
      content: { 'application/json': { schema: PaginatedProductsSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const getProductRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Get product by ID',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'Product details',
      content: {
        'application/json': {
          schema: z.object({ data: ProductSchema }),
        },
      },
    },
    404: {
      description: 'Product not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const createProductRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Products'],
  summary: 'Create new product',
  request: {
    body: {
      content: { 'application/json': { schema: CreateProductSchema } },
    },
  },
  responses: {
    201: {
      description: 'Product created',
      content: {
        'application/json': {
          schema: z.object({ data: ProductSchema }),
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const updateProductRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Update product',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateProductSchema } },
    },
  },
  responses: {
    200: {
      description: 'Product updated',
      content: {
        'application/json': {
          schema: z.object({ data: ProductSchema }),
        },
      },
    },
    404: {
      description: 'Product not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const deleteProductRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Delete product (soft delete)',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: { description: 'Product deleted' },
    404: {
      description: 'Product not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
```

### 3. Handlers (`routes/products/handlers.ts`)

```typescript
import type { RouteHandler } from '@hono/zod-openapi'
import type { ServiceContext, HonoEnv } from '../../types'
import { productsService } from '../../services'
import type {
  listProductsRoute,
  getProductRoute,
  createProductRoute,
  updateProductRoute,
  deleteProductRoute,
} from './routes'

// Helper to build ServiceContext from Hono context
function buildServiceContext(c: any): ServiceContext {
  return {
    accountId: c.get('accountId'),
    user: c.get('user'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

export const listProductsHandler: RouteHandler<typeof listProductsRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = c.get('db')
  const ctx = buildServiceContext(c)

  const result = await productsService.findAll(db, ctx, {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    query: query.query,
  })

  return c.json(result, 200)
}

export const getProductHandler: RouteHandler<typeof getProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const ctx = buildServiceContext(c)

  const product = await productsService.findById(db, ctx, id)
  return c.json({ data: product }, 200)
}

export const createProductHandler: RouteHandler<typeof createProductRoute, HonoEnv> = async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')
  const ctx = buildServiceContext(c)

  const product = await productsService.create(db, ctx, data)
  return c.json({ data: product }, 201)
}

export const updateProductHandler: RouteHandler<typeof updateProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')
  const ctx = buildServiceContext(c)

  const product = await productsService.update(db, ctx, id, data)
  return c.json({ data: product }, 200)
}

export const deleteProductHandler: RouteHandler<typeof deleteProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')
  const ctx = buildServiceContext(c)

  await productsService.delete(db, ctx, id)
  return c.body(null, 204)
}
```

### 4. Router Index (`routes/products/index.ts`)

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listProductsRoute,
  getProductRoute,
  createProductRoute,
  updateProductRoute,
  deleteProductRoute,
} from './routes'
import {
  listProductsHandler,
  getProductHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from './handlers'

const products = new OpenAPIHono<HonoEnv>()

// Helper to convert OpenAPI path {param} to Hono path :param
function toHonoPath(path: string): string {
  return path.replaceAll(/{(\w+)}/g, ':$1')
}

// List products - VIEWER or higher
products.openapi(listProductsRoute, listProductsHandler)

// Get product - VIEWER or higher
products.openapi(getProductRoute, getProductHandler)

// Create product - EDITOR or higher
products.use(toHonoPath(createProductRoute.path), requireRole('EDITOR'))
products.openapi(createProductRoute, createProductHandler)

// Update product - EDITOR or higher
products.use(toHonoPath(updateProductRoute.path), requireRole('EDITOR'))
products.openapi(updateProductRoute, updateProductHandler)

// Delete product - ADMIN only
products.use(toHonoPath(deleteProductRoute.path), requireRole('ADMIN'))
products.openapi(deleteProductRoute, deleteProductHandler)

export { products }
```

### 5. Service (`services/products.ts`)

```typescript
import type { ServiceContext, PaginationQuery, PaginatedResponse } from '../types'
import { NotFoundError, ConflictError } from '../lib/errors'
import { logAudit } from '../lib/audit'
import { auditedUpdate, auditedDelete } from '../lib/audited-db'
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import {
  queryAll,
  queryOne,
  execute,
  toStringValue,
  toNullableString,
  type SqlRow,
  type SqlParams,
} from '../db/sql'

// Domain types
interface Product {
  id: string
  name: string
  description: string | null
  price: number
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

interface CreateProductInput {
  name: string
  description?: string
  price: number
}

interface UpdateProductInput {
  name?: string
  description?: string
  price?: number
  status?: 'draft' | 'active' | 'archived'
}

// SQL select columns with aliases
const PRODUCT_COLUMNS = `
  id,
  name,
  description,
  price,
  status,
  account_id as accountId,
  created_at as createdAt,
  updated_at as updatedAt
`

// Row mapper
function mapProductRow(row: SqlRow): Product {
  return {
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    description: toNullableString(row.description),
    price: Number(row.price),
    status: (row.status as Product['status']) || 'draft',
    createdAt: toStringValue(row.createdAt ?? row.created_at),
    updatedAt: toStringValue(row.updatedAt ?? row.updated_at),
  }
}

// Service methods
async function findAll(
  db: D1Database,
  ctx: ServiceContext,
  pagination: PaginationQuery
): Promise<PaginatedResponse<Product>> {
  const offset = calculateOffset(pagination.page, pagination.limit)
  const whereClauses: string[] = ['deleted_at IS NULL']
  const params: SqlParams = []

  // Multi-tenant filtering
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('account_id = ?')
    params.push(ctx.accountId)
  }

  // Search filter
  if (pagination.query) {
    whereClauses.push('(name LIKE ? OR description LIKE ?)')
    const like = `%${pagination.query}%`
    params.push(like, like)
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`

  // Count total
  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM products ${whereSql}`,
    params
  )
  const totalItems = countRow?.count ?? 0

  // Fetch page
  const rows = await queryAll(
    db,
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pagination.limit, offset]
  )

  return {
    data: rows.map(mapProductRow),
    meta: createPaginationMeta(totalItems, pagination.page, pagination.limit),
  }
}

async function findById(db: D1Database, ctx: ServiceContext, id: string): Promise<Product> {
  const whereClauses: string[] = ['id = ?', 'deleted_at IS NULL']
  const params: SqlParams = [id]

  // Multi-tenant filtering
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('account_id = ?')
    params.push(ctx.accountId)
  }

  const row = await queryOne(
    db,
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     WHERE ${whereClauses.join(' AND ')}
     LIMIT 1`,
    params
  )

  if (!row) {
    throw new NotFoundError('Product')
  }

  return mapProductRow(row)
}

async function create(
  db: D1Database,
  ctx: ServiceContext,
  input: CreateProductInput
): Promise<Product> {
  // Business rule: check name uniqueness within account
  const existing = await queryOne(
    db,
    `SELECT 1 as ok FROM products
     WHERE name = ? AND account_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [input.name, ctx.accountId]
  )

  if (existing) {
    throw new ConflictError('Product with this name already exists')
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await execute(
    db,
    `INSERT INTO products (id, name, description, price, status, account_id, created_at, updated_at, created_by_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.description ?? null, input.price, 'draft', ctx.accountId, now, now, ctx.user.id]
  )

  // Log audit
  await logAudit(db, ctx, 'Product', id, 'INSERT', { name: input.name, price: input.price })

  return findById(db, ctx, id)
}

async function update(
  db: D1Database,
  ctx: ServiceContext,
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  // Verify exists and access
  await findById(db, ctx, id)

  // Business rule: check name uniqueness if changing
  if (input.name) {
    const existing = await queryOne(
      db,
      `SELECT 1 as ok FROM products
       WHERE name = ? AND account_id = ? AND id != ? AND deleted_at IS NULL
       LIMIT 1`,
      [input.name, ctx.accountId, id]
    )

    if (existing) {
      throw new ConflictError('Product with this name already exists')
    }
  }

  // Build update
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by_id: ctx.user.id,
  }
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.price !== undefined) updates.price = input.price
  if (input.status !== undefined) updates.status = input.status

  await auditedUpdate(db, ctx, 'products', updates, { clause: 'id = ?', params: [id] })

  return findById(db, ctx, id)
}

async function deleteProduct(db: D1Database, ctx: ServiceContext, id: string): Promise<void> {
  // Verify exists and access
  await findById(db, ctx, id)

  await auditedDelete(db, ctx, 'products', { clause: 'id = ?', params: [id] })
}

// Export service object
export const productsService = {
  findAll,
  findById,
  create,
  update,
  delete: deleteProduct,
}
```

### 6. Register in Main Router

```typescript
// src/server/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../types'
import { users } from './users'
import { products } from './products'  // Add import

const api = new OpenAPIHono<HonoEnv>()

// Mount route modules
api.route('/users', users)
api.route('/products', products)  // Add mount

export { api }
```

---

## Adding Guards to Routes

Different patterns for applying role-based access control.

### Pattern 1: Per-Route Guards

```typescript
// routes/reports/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { requireRole, requirePermission } from '../../auth/guards'

const reports = new OpenAPIHono<HonoEnv>()

function toHonoPath(path: string): string {
  return path.replaceAll(/{(\w+)}/g, ':$1')
}

// Public to authenticated users
reports.openapi(listReportsRoute, listReportsHandler)

// EDITOR or higher
reports.use(toHonoPath(createReportRoute.path), requireRole('EDITOR'))
reports.openapi(createReportRoute, createReportHandler)

// MANAGER or higher
reports.use(toHonoPath(publishReportRoute.path), requireRole('MANAGER'))
reports.openapi(publishReportRoute, publishReportHandler)

// ADMIN only
reports.use(toHonoPath(deleteReportRoute.path), requireRole('ADMIN'))
reports.openapi(deleteReportRoute, deleteReportHandler)

export { reports }
```

### Pattern 2: Permission-Based Guards

```typescript
// routes/billing/index.ts
import { requirePermission } from '../../auth/guards'

const billing = new OpenAPIHono<HonoEnv>()

// Requires MANAGE_BILLING permission
billing.use('*', requirePermission('MANAGE_BILLING'))

billing.openapi(getBillingRoute, getBillingHandler)
billing.openapi(updateBillingRoute, updateBillingHandler)

export { billing }
```

### Pattern 3: Additional Roles (Non-Hierarchical)

```typescript
// routes/analytics/index.ts
import { requireRole } from '../../auth/guards'

const analytics = new OpenAPIHono<HonoEnv>()

// VIEWER or higher, OR ANALYTICS role
analytics.use('*', requireRole('VIEWER', ['ANALYTICS']))

analytics.openapi(getMetricsRoute, getMetricsHandler)
analytics.openapi(exportDataRoute, exportDataHandler)

export { analytics }
```

---

## Service with Pagination

Complete pattern for paginated list endpoints.

```typescript
// services/posts.ts
import { createPaginationMeta, calculateOffset } from '../lib/pagination'
import type { PaginationQuery, PaginatedResponse, ServiceContext } from '../types'

interface Post {
  id: string
  title: string
  content: string
  status: 'draft' | 'published'
  authorId: string
  createdAt: string
}

interface PostFilters extends PaginationQuery {
  status?: 'draft' | 'published'
  authorId?: string
}

async function findAll(
  db: D1Database,
  ctx: ServiceContext,
  filters: PostFilters
): Promise<PaginatedResponse<Post>> {
  const offset = calculateOffset(filters.page, filters.limit)
  const whereClauses: string[] = ['deleted_at IS NULL']
  const params: SqlParams = []

  // Multi-tenant filter
  if (!ctx.user.isSuperAdmin) {
    whereClauses.push('account_id = ?')
    params.push(ctx.accountId)
  }

  // Status filter
  if (filters.status) {
    whereClauses.push('status = ?')
    params.push(filters.status)
  }

  // Author filter
  if (filters.authorId) {
    whereClauses.push('author_id = ?')
    params.push(filters.authorId)
  }

  // Search filter
  if (filters.query) {
    whereClauses.push('(title LIKE ? OR content LIKE ?)')
    const like = `%${filters.query}%`
    params.push(like, like)
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`

  // Sort handling
  const sortColumn = filters.sortBy === 'title' ? 'title' : 'created_at'
  const sortDir = filters.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const orderSql = `ORDER BY ${sortColumn} ${sortDir}`

  // Count query
  const countRow = await queryOne<{ count: number }>(
    db,
    `SELECT count(*) as count FROM posts ${whereSql}`,
    params
  )
  const totalItems = countRow?.count ?? 0

  // Data query
  const rows = await queryAll(
    db,
    `SELECT id, title, content, status, author_id as authorId, created_at as createdAt
     FROM posts
     ${whereSql}
     ${orderSql}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset]
  )

  return {
    data: rows.map(mapPostRow),
    meta: createPaginationMeta(totalItems, filters.page, filters.limit),
  }
}
```

---

## Handler with Context Building

Pattern for building ServiceContext in handlers.

```typescript
// routes/common/context.ts
import type { Context } from 'hono'
import type { ServiceContext, HonoEnv } from '../../types'

/**
 * Build ServiceContext from Hono context
 * Throws if required values are missing
 */
export function buildServiceContext(c: Context<HonoEnv>): ServiceContext {
  const accountId = c.get('accountId')
  const user = c.get('user')

  if (!accountId || !user) {
    throw new Error('Missing required context: accountId or user')
  }

  return {
    accountId,
    user,
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }
}

/**
 * Get database binding with fallback
 */
export function getDatabase(c: Context<HonoEnv>): D1Database {
  const db = c.env.DB ?? c.get('db')
  if (!db) {
    throw new Error('Database not available')
  }
  return db
}
```

Usage in handlers:

```typescript
// routes/products/handlers.ts
import { buildServiceContext, getDatabase } from '../common/context'

export const listProductsHandler: RouteHandler<typeof listProductsRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = getDatabase(c)
  const ctx = buildServiceContext(c)

  const result = await productsService.findAll(db, ctx, query)
  return c.json(result, 200)
}
```

---

## Request Flow Diagram

Complete request flow for a typical API call:

```
POST /api/products
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Middleware Stack (in order)                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. errorHandler (app.onError)     - Catches all errors          │
│ 2. requestContext                 - Sets transactionId, ip      │
│ 3. sessionAuth                    - Validates session cookie    │
│ 4. accountMiddleware              - Validates account-id header │
│ 5. requireRole('EDITOR')          - Checks user role            │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Route Handler                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. c.req.valid('json')            - Zod validation              │
│ 2. buildServiceContext(c)         - Build context               │
│ 3. productsService.create(...)    - Call service                │
│ 4. c.json({ data }, 201)          - Return response             │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Service Layer                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Business validation            - Check name uniqueness        │
│ 2. execute(db, 'INSERT...')       - D1 insert                   │
│ 3. logAudit(db, ctx, ...)         - Audit log                   │
│ 4. findById(db, ctx, id)          - Return created product      │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response                                                         │
├─────────────────────────────────────────────────────────────────┤
│ HTTP 201 Created                                                 │
│ {                                                                │
│   "data": {                                                      │
│     "id": "uuid",                                                │
│     "name": "Widget Pro",                                        │
│     "price": 99.99,                                              │
│     "status": "draft",                                           │
│     ...                                                          │
│   }                                                              │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure Summary

Complete file structure for a new feature:

```
src/server/
├── routes/
│   ├── products/
│   │   ├── schemas.ts      # Zod schemas with OpenAPI
│   │   ├── routes.ts       # Route definitions (createRoute)
│   │   ├── handlers.ts     # Route handlers
│   │   └── index.ts        # Router with guards
│   └── index.ts            # Mount products router
│
├── services/
│   ├── products.ts         # Business logic
│   └── index.ts            # Re-export services
│
├── db/
│   └── records.ts          # Add ProductRecord type
│
└── types/
    └── index.ts            # Add Product domain type
```

### Checklist for New Feature

1. **Schemas** (`routes/{feature}/schemas.ts`)
   - [ ] Domain schema with `.openapi()` extension
   - [ ] CreateInput schema
   - [ ] UpdateInput schema
   - [ ] Paginated schema using `createPaginatedSchema`

2. **Routes** (`routes/{feature}/routes.ts`)
   - [ ] `createRoute` for each endpoint
   - [ ] Request params/query/body defined
   - [ ] Response schemas for all status codes

3. **Handlers** (`routes/{feature}/handlers.ts`)
   - [ ] `RouteHandler<typeof route, HonoEnv>` typing
   - [ ] Extract validated input with `c.req.valid()`
   - [ ] Build ServiceContext
   - [ ] Call service methods
   - [ ] Return proper status codes

4. **Router** (`routes/{feature}/index.ts`)
   - [ ] OpenAPIHono with HonoEnv
   - [ ] Guards applied with `requireRole` or `requirePermission`
   - [ ] `toHonoPath` for route paths
   - [ ] Routes registered with `openapi()`

5. **Service** (`services/{feature}.ts`)
   - [ ] Domain types
   - [ ] Row mapper function
   - [ ] CRUD methods with multi-tenant filtering
   - [ ] Business rule validation
   - [ ] Audit logging

6. **Integration**
   - [ ] Mount router in `routes/index.ts`
   - [ ] Export service from `services/index.ts`
   - [ ] Add types to `types/index.ts`

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [routing-and-handlers.md](routing-and-handlers.md) - Route patterns
- [services-layer.md](services-layer.md) - Service patterns
- [validation-and-openapi.md](validation-and-openapi.md) - Schema patterns
- [auth-and-guards.md](auth-and-guards.md) - Guard patterns
