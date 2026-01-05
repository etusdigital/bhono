# Routing and Handlers - OpenAPIHono Patterns

Complete guide to creating routes and handlers with OpenAPIHono.

## Table of Contents

- [File Organization](#file-organization)
- [Route Definitions](#route-definitions)
- [Handler Implementation](#handler-implementation)
- [Router Setup](#router-setup)
- [Path Parameters and Query Strings](#path-parameters-and-query-strings)
- [Request Bodies](#request-bodies)
- [Response Patterns](#response-patterns)
- [Guards and Middleware](#guards-and-middleware)
- [Complete Example](#complete-example)

---

## File Organization

### Feature Folder Structure

Each API resource has its own folder:

```
src/server/routes/{resource}/
├── index.ts      # Router setup + guards
├── routes.ts     # OpenAPI route definitions
├── handlers.ts   # Handler implementations
└── schemas.ts    # Zod schemas for this resource
```

### Separation of Concerns

| File | Purpose |
|------|---------|
| `routes.ts` | OpenAPI spec (method, path, schemas) |
| `handlers.ts` | Implementation logic |
| `schemas.ts` | Zod schemas with `.openapi()` |
| `index.ts` | Wire routes + handlers + guards |

---

## Route Definitions

### Basic Route with createRoute

```typescript
// routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import { UserSchema } from './schemas'
import { ErrorResponseSchema, IdParamSchema } from '../schemas'

export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'User details',
      content: {
        'application/json': {
          schema: z.object({ data: UserSchema }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
```

### Route with Query Parameters

```typescript
import { PaginationQuerySchema, PaginatedUsersSchema } from '../schemas'

export const listUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'List users in account',
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: 'List of users',
      content: { 'application/json': { schema: PaginatedUsersSchema } },
    },
  },
})
```

### Route with Request Body

```typescript
import { CreateUserSchema, UserSchema } from './schemas'

export const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  summary: 'Create new user',
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      description: 'User created',
      content: {
        'application/json': {
          schema: z.object({ data: UserSchema }),
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Email already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
```

### Delete Route (No Response Body)

```typescript
export const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete user (soft delete)',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: {
      description: 'User deleted',
      // No content property for 204
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
```

---

## Handler Implementation

### Handler Type Signature

```typescript
// handlers.ts
import type { RouteHandler } from '@hono/zod-openapi'
import type { HonoEnv, ServiceContext } from '../../types'
import type { getUserRoute } from './routes'

export const getUserHandler: RouteHandler<typeof getUserRoute, HonoEnv> = async (c) => {
  // Implementation
}
```

### Standard Handler Pattern

```typescript
export const getUserHandler: RouteHandler<typeof getUserRoute, HonoEnv> = async (c) => {
  // 1. Extract validated input
  const { id } = c.req.valid('param')

  // 2. Get database from context
  const db = c.get('db')
  if (!db) {
    throw new Error('Database unavailable')
  }

  // 3. Get auth context
  const user = c.get('user')
  const accountId = c.get('accountId')
  if (!user || !accountId) {
    throw new Error('Missing required context')
  }

  // 4. Build ServiceContext
  const ctx: ServiceContext = {
    accountId,
    user,
    userRole: c.get('userRole'),
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }

  // 5. Call service
  const result = await usersService.findById(db, ctx, id)

  // 6. Return response
  return c.json({ data: result }, 200)
}
```

### List Handler Pattern

```typescript
export const listUsersHandler: RouteHandler<typeof listUsersRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = c.get('db')!
  const user = c.get('user')!
  const accountId = c.get('accountId')!

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }

  const result = await usersService.findAll(db, ctx, {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    query: query.query,
  })

  // Return paginated response directly (includes data + meta)
  return c.json(result, 200)
}
```

### Create Handler Pattern

```typescript
export const createUserHandler: RouteHandler<typeof createUserRoute, HonoEnv> = async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')!
  const user = c.get('user')!
  const accountId = c.get('accountId')!

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }

  const newUser = await usersService.create(db, ctx, data)
  return c.json({ data: newUser }, 201)  // 201 Created
}
```

### Update Handler Pattern

```typescript
export const updateUserHandler: RouteHandler<typeof updateUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')!
  const user = c.get('user')!
  const accountId = c.get('accountId')!

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }

  const updated = await usersService.update(db, ctx, id, data)
  return c.json({ data: updated }, 200)
}
```

### Delete Handler Pattern

```typescript
export const deleteUserHandler: RouteHandler<typeof deleteUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')!
  const user = c.get('user')!
  const accountId = c.get('accountId')!

  const ctx: ServiceContext = {
    accountId,
    user,
    transactionId: c.get('transactionId'),
    ip: c.get('ip'),
    userAgent: c.get('userAgent'),
  }

  await usersService.delete(db, ctx, id)
  return c.body(null, 204)  // 204 No Content
}
```

---

## Router Setup

### Creating the Router

```typescript
// index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listUsersRoute,
  getUserRoute,
  updateUserRoute,
  deleteUserRoute,
} from './routes'
import {
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from './handlers'

const users = new OpenAPIHono<HonoEnv>()
```

### Path Conversion Utility

OpenAPI uses `{param}` syntax, but Hono's `.use()` requires `:param`:

```typescript
/**
 * Convert OpenAPI path syntax {param} to Hono path syntax :param
 */
function toHonoPath(openApiPath: string): string {
  return openApiPath.replaceAll(/{(\w+)}/g, ':$1')
}
```

### Registering Routes

```typescript
// Public endpoint (within authenticated API)
users.openapi(listUsersRoute, listUsersHandler)
users.openapi(getUserRoute, getUserHandler)

// Protected endpoint (requires specific role)
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Admin-only endpoint
users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)

export { users }
```

### Route Order Matters

Register specific paths before wildcards:

```typescript
// CORRECT: Specific paths first
users.openapi(createBulkUserAccountsRoute, createBulkUserAccountsHandler)  // /accounts
users.openapi(getUserRoute, getUserHandler)  // /{id}

// WRONG: Wildcard /{id} would match /accounts
users.openapi(getUserRoute, getUserHandler)  // /{id} catches /accounts!
users.openapi(createBulkUserAccountsRoute, createBulkUserAccountsHandler)
```

### Mounting in API Router

```typescript
// src/server/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { users } from './users'
import { accounts } from './accounts'

const api = new OpenAPIHono<HonoEnv>()

// Auth middleware for all API routes
api.use('/*', sessionAuth)
api.use('/*', accountMiddleware)

// Mount feature routers
api.route('/users', users)
api.route('/accounts', accounts)

export { api }
```

---

## Path Parameters and Query Strings

### Extracting Path Parameters

```typescript
// Route definition
export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({
      id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    }),
  },
  // ...
})

// Handler
const { id } = c.req.valid('param')  // Typed and validated
```

### Multiple Path Parameters

```typescript
// Route: /users/{userId}/accounts/{accountId}
export const getUserAccountRoute = createRoute({
  method: 'get',
  path: '/{userId}/accounts/{accountId}',
  request: {
    params: z.object({
      userId: z.uuid(),
      accountId: z.uuid(),
    }),
  },
  // ...
})

// Handler
const { userId, accountId } = c.req.valid('param')
```

### Query String Parameters

```typescript
// Query schema with defaults and coercion
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  query: z.string().optional(),
})

// Handler
const query = c.req.valid('query')
// query.page is number (coerced from string)
// query.limit defaults to 50 if not provided
```

---

## Request Bodies

### Extracting JSON Body

```typescript
// Route definition
export const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
    },
  },
  // ...
})

// Handler
const data = c.req.valid('json')  // Typed as z.infer<typeof CreateUserSchema>
```

### Optional Fields in Body

```typescript
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).openapi('UpdateUserInput')

// In handler
const data = c.req.valid('json')
if (data.name !== undefined) {
  // Update name
}
```

### Array Bodies

```typescript
export const BulkUserAccountsInputSchema = z
  .array(
    z.object({
      userId: z.uuid(),
      accountId: z.uuid(),
      role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER']),
    })
  )
  .min(1)
  .max(100)
  .openapi('BulkUserAccountsInput')

// Handler
const items = c.req.valid('json')  // Array of objects
for (const item of items) {
  // Process each item
}
```

---

## Response Patterns

### Single Item Response

```typescript
// Wrap in { data: ... } for consistency
return c.json({ data: user }, 200)
```

### Paginated Response

```typescript
// Service returns { data: [], meta: {} }
const result = await usersService.findAll(db, ctx, pagination)
return c.json(result, 200)
```

### No Content Response

```typescript
// 204 No Content for DELETE
return c.body(null, 204)
```

### Error Response

Errors are thrown and caught by global `errorHandler`:

```typescript
import { HTTPException } from 'hono/http-exception'
import { NotFoundError } from '../../lib/errors'

// In service (thrown errors bubble up)
if (!user) throw new NotFoundError('User')

// Or in handler directly
throw new HTTPException(400, { message: 'Invalid input' })
```

---

## Guards and Middleware

### Applying Guards to Routes

```typescript
import { requireRole } from '../../auth/guards'

// Apply guard BEFORE registering the route
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)
```

### Role Hierarchy

| Role | Level | Inherits |
|------|-------|----------|
| ADMIN | 4 | All roles |
| MANAGER | 3 | EDITOR, AUTHOR, VIEWER |
| EDITOR | 2 | AUTHOR, VIEWER |
| AUTHOR | 1 | VIEWER |
| VIEWER | 0 | - |
| BILLING | - | Standalone |
| ANALYTICS | - | Standalone |

### Common Guard Patterns

```typescript
// Read operations - minimum VIEWER
users.openapi(listUsersRoute, listUsersHandler)  // No guard needed, VIEWER is minimum

// Write operations - minimum MANAGER
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Delete operations - ADMIN only
users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)
```

---

## Complete Example

### New Resource: Products

**1. Create schemas (schemas.ts):**

```typescript
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const ProductSchema = z
  .object({
    id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    name: z.string().openapi({ example: 'Widget Pro' }),
    price: z.number().openapi({ example: 99.99 }),
    status: z.enum(['draft', 'active', 'archived']).openapi({ example: 'active' }),
    createdAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('Product')

export const CreateProductSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'Widget Pro' }),
    price: z.number().positive().openapi({ example: 99.99 }),
  })
  .openapi('CreateProductInput')

export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    price: z.number().positive().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
  })
  .openapi('UpdateProductInput')

export const PaginatedProductsSchema = createPaginatedSchema(ProductSchema, 'Products')
```

**2. Create routes (routes.ts):**

```typescript
import { createRoute, z } from '@hono/zod-openapi'
import { ProductSchema, CreateProductSchema, UpdateProductSchema, PaginatedProductsSchema } from './schemas'
import { ErrorResponseSchema, PaginationQuerySchema, IdParamSchema } from '../schemas'

export const listProductsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Products'],
  summary: 'List products',
  request: { query: PaginationQuerySchema },
  responses: {
    200: { description: 'Products list', content: { 'application/json': { schema: PaginatedProductsSchema } } },
  },
})

export const getProductRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Get product by ID',
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Product details', content: { 'application/json': { schema: z.object({ data: ProductSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

export const createProductRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Products'],
  summary: 'Create product',
  request: { body: { content: { 'application/json': { schema: CreateProductSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.object({ data: ProductSchema }) } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

export const updateProductRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Update product',
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: UpdateProductSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: z.object({ data: ProductSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

export const deleteProductRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Delete product',
  request: { params: IdParamSchema },
  responses: {
    204: { description: 'Deleted' },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})
```

**3. Create handlers (handlers.ts):**

```typescript
import type { RouteHandler } from '@hono/zod-openapi'
import type { HonoEnv, ServiceContext } from '../../types'
import { productsService } from '../../services'
import type { listProductsRoute, getProductRoute, createProductRoute, updateProductRoute, deleteProductRoute } from './routes'

export const listProductsHandler: RouteHandler<typeof listProductsRoute, HonoEnv> = async (c) => {
  const query = c.req.valid('query')
  const db = c.get('db')!
  const ctx: ServiceContext = { accountId: c.get('accountId')!, user: c.get('user')! }
  const result = await productsService.findAll(db, ctx, query)
  return c.json(result, 200)
}

export const getProductHandler: RouteHandler<typeof getProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')!
  const ctx: ServiceContext = { accountId: c.get('accountId')!, user: c.get('user')! }
  const product = await productsService.findById(db, ctx, id)
  return c.json({ data: product }, 200)
}

export const createProductHandler: RouteHandler<typeof createProductRoute, HonoEnv> = async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')!
  const ctx: ServiceContext = { accountId: c.get('accountId')!, user: c.get('user')!, transactionId: c.get('transactionId') }
  const product = await productsService.create(db, ctx, data)
  return c.json({ data: product }, 201)
}

export const updateProductHandler: RouteHandler<typeof updateProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const db = c.get('db')!
  const ctx: ServiceContext = { accountId: c.get('accountId')!, user: c.get('user')!, transactionId: c.get('transactionId') }
  const product = await productsService.update(db, ctx, id, data)
  return c.json({ data: product }, 200)
}

export const deleteProductHandler: RouteHandler<typeof deleteProductRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.get('db')!
  const ctx: ServiceContext = { accountId: c.get('accountId')!, user: c.get('user')!, transactionId: c.get('transactionId') }
  await productsService.delete(db, ctx, id)
  return c.body(null, 204)
}
```

**4. Create router (index.ts):**

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import { listProductsRoute, getProductRoute, createProductRoute, updateProductRoute, deleteProductRoute } from './routes'
import { listProductsHandler, getProductHandler, createProductHandler, updateProductHandler, deleteProductHandler } from './handlers'

const products = new OpenAPIHono<HonoEnv>()

function toHonoPath(path: string): string {
  return path.replaceAll(/{(\w+)}/g, ':$1')
}

// Read - VIEWER
products.openapi(listProductsRoute, listProductsHandler)
products.openapi(getProductRoute, getProductHandler)

// Write - EDITOR
products.use(toHonoPath(createProductRoute.path), requireRole('EDITOR'))
products.openapi(createProductRoute, createProductHandler)

products.use(toHonoPath(updateProductRoute.path), requireRole('EDITOR'))
products.openapi(updateProductRoute, updateProductHandler)

// Delete - ADMIN
products.use(toHonoPath(deleteProductRoute.path), requireRole('ADMIN'))
products.openapi(deleteProductRoute, deleteProductHandler)

export { products }
```

**5. Mount in API router:**

```typescript
// src/server/routes/index.ts
import { products } from './products'

api.route('/products', products)
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [validation-and-openapi.md](validation-and-openapi.md) - Zod schemas
- [services-layer.md](services-layer.md) - Service implementation
- [auth-and-guards.md](auth-and-guards.md) - Guards and RBAC
