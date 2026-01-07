# Validation and OpenAPI - Zod with @hono/zod-openapi

Complete guide to input validation using Zod schemas with automatic OpenAPI documentation.

## Table of Contents

- [Overview](#overview)
- [Import Pattern](#import-pattern)
- [Schema Conventions](#schema-conventions)
- [OpenAPI Extensions](#openapi-extensions)
- [Shared Schemas](#shared-schemas)
- [Route-Specific Schemas](#route-specific-schemas)
- [Type Inference](#type-inference)
- [Validation in Handlers](#validation-in-handlers)
- [Common Patterns](#common-patterns)
- [Schema Composition](#schema-composition)

---

## Overview

### Why @hono/zod-openapi?

This boilerplate uses `@hono/zod-openapi` instead of plain `zod`:

**Benefits:**
- Automatic OpenAPI specification generation
- Swagger UI documentation from schemas
- Type-safe route definitions
- Validation at handler level via `c.req.valid()`
- Single source of truth for types, validation, and docs

**How It Works:**
```
Schema Definition (Zod + OpenAPI)
    ↓
Route Definition (createRoute)
    ↓
Automatic OpenAPI Spec (/api/doc)
    ↓
Swagger UI (/api/swagger)
```

---

## Import Pattern

### Always Use @hono/zod-openapi

```typescript
// ✅ CORRECT - Use @hono/zod-openapi
import { z } from '@hono/zod-openapi'

// ❌ WRONG - Don't use plain zod
import { z } from 'zod'
```

The `z` from `@hono/zod-openapi` extends plain Zod with:
- `.openapi()` method for metadata
- `z.uuid()` shorthand (instead of `z.string().uuid()`)
- `z.email()` shorthand
- `z.iso.datetime()` for ISO date strings

---

## Schema Conventions

### File Organization

```
src/server/routes/
├── schemas.ts              # Shared schemas (pagination, errors, params)
├── users/
│   └── schemas.ts          # User-specific schemas
├── accounts/
│   └── schemas.ts          # Account-specific schemas
└── {resource}/
    └── schemas.ts          # Resource-specific schemas
```

### Naming Conventions

| Schema Type | Pattern | Example |
|-------------|---------|---------|
| Entity | `{Entity}Schema` | `UserSchema` |
| Create Input | `Create{Entity}Schema` | `CreateUserSchema` |
| Update Input | `Update{Entity}Schema` | `UpdateUserSchema` |
| Paginated List | `Paginated{Entity}sSchema` | `PaginatedUsersSchema` |
| Response Wrapper | `{Entity}ResponseSchema` | `UserResponseSchema` |

### OpenAPI Registration Names

Every schema needs `.openapi('Name')` for OpenAPI registration:

```typescript
// Entity schema - register with entity name
export const UserSchema = z.object({...}).openapi('User')

// Input schema - register with Input suffix
export const CreateUserSchema = z.object({...}).openapi('CreateUserInput')

// Response schema - register with Response suffix
export const UserResponseSchema = z.object({...}).openapi('UserResponse')
```

---

## OpenAPI Extensions

### Basic .openapi() Usage

```typescript
export const UserSchema = z
  .object({
    id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    email: z.email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: 'John Doe' }),
    status: z.enum(['active', 'inactive']).openapi({ example: 'active' }),
    createdAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('User')  // Register in OpenAPI spec
```

### OpenAPI Options

```typescript
z.string().openapi({
  // Example value shown in Swagger UI
  example: 'Example value',

  // Description in docs
  description: 'The user email address',

  // Deprecation notice
  deprecated: true,

  // Format hint
  format: 'email',
})
```

### Extended Validators

The `@hono/zod-openapi` package provides shortcuts:

```typescript
// UUID validation (shorthand)
z.uuid()  // Instead of z.string().uuid()

// Email validation (shorthand)
z.email()  // Instead of z.string().email()

// ISO datetime (shorthand)
z.iso.datetime()  // Instead of z.string().datetime()
```

---

## Shared Schemas

### Location: `src/server/routes/schemas.ts`

Shared schemas are used across multiple routes:

### Error Response Schema

```typescript
export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: 'Error message' }),
    statusCode: z.number().openapi({ example: 400 }),
    details: z.unknown().optional(),
  })
  .openapi('ErrorResponse')
```

### Pagination Schemas

```typescript
// Query parameters for list endpoints
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().min(1).max(100).default(50).openapi({ example: 50 }),
  sortBy: z.string().optional().openapi({ example: 'createdAt' }),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC').openapi({ example: 'DESC' }),
  query: z.string().optional().openapi({ example: 'search term' }),
})

// Pagination metadata in response
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
```

### Paginated Response Factory

```typescript
// Factory to create paginated response schemas
export const createPaginatedSchema = <T extends z.ZodType>(
  itemSchema: T,
  name: string
) =>
  z
    .object({
      data: z.array(itemSchema),
      meta: PaginationMetaSchema,
    })
    .openapi(`Paginated${name}`)

// Usage
export const PaginatedUsersSchema = createPaginatedSchema(UserSchema, 'Users')
```

### Common Parameter Schemas

```typescript
// UUID path parameter
export const IdParamSchema = z.object({
  id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
})

// Account header (multi-tenancy)
export const AccountHeaderSchema = z.object({
  'account-id': z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
})
```

---

## Route-Specific Schemas

### Location: `src/server/routes/{resource}/schemas.ts`

### Entity Schema

```typescript
// src/server/routes/users/schemas.ts
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

export const UserSchema = z
  .object({
    id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    email: z.email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: 'John Doe' }),
    status: z.enum(['active', 'inactive']).openapi({ example: 'active' }),
    isSuperAdmin: z.boolean().openapi({ example: false }),
    createdAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('User')
```

### Input Schemas (Create/Update)

```typescript
// Create - all required fields
export const CreateUserSchema = z
  .object({
    email: z.email().openapi({ example: 'newuser@example.com' }),
    name: z.string().min(1).max(255).openapi({ example: 'Jane Doe' }),
    role: z
      .enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'])
      .default('VIEWER')
      .openapi({ example: 'VIEWER' }),
  })
  .openapi('CreateUserInput')

// Update - all fields optional
export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Updated Name' }),
    status: z.enum(['active', 'inactive']).optional().openapi({ example: 'active' }),
  })
  .openapi('UpdateUserInput')
```

### Paginated Response

```typescript
export const PaginatedUsersSchema = createPaginatedSchema(UserSchema, 'Users')
```

### Bulk Operation Schemas

```typescript
export const UserAccountSchema = z
  .object({
    userId: z.uuid().openapi({
      example: '550e8400-e29b-41d4-a716-446655440000',
      description: 'The ID of the user',
    }),
    accountId: z.uuid().openapi({
      example: '550e8400-e29b-41d4-a716-446655440001',
      description: 'The ID of the account',
    }),
    role: z
      .enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'])
      .openapi({
        example: 'VIEWER',
        description: 'The role of the user in the account',
      }),
  })
  .openapi('UserAccount')

export const BulkUserAccountsInputSchema = z
  .array(UserAccountSchema)
  .min(1)
  .max(100)
  .openapi('BulkUserAccountsInput')

export const BulkOperationSuccessSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    count: z.number().openapi({ example: 3, description: 'Number of records affected' }),
  })
  .openapi('BulkOperationSuccess')
```

---

## Type Inference

### Inferring Types from Schemas

```typescript
import { z } from '@hono/zod-openapi'

// Define schema
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
})

// Infer TypeScript type
export type User = z.infer<typeof UserSchema>
// Equivalent to:
// type User = {
//   id: string
//   email: string
//   name: string
// }

// Input types
export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

// Pagination types
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
```

### Using Inferred Types

```typescript
// In services
async function createUser(db: D1Database, ctx: ServiceContext, input: CreateUserInput) {
  // input is fully typed from schema
  const { email, name, role } = input
  // ...
}

// In handlers
const handler: RouteHandler<typeof createUserRoute, HonoEnv> = async (c) => {
  const input = c.req.valid('json')  // Type inferred from route schema
  // ...
}
```

---

## Validation in Handlers

### Automatic Validation

Validation happens automatically when using `createRoute`:

```typescript
// routes.ts
export const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  request: {
    body: {
      content: {
        'application/json': { schema: CreateUserSchema },
      },
    },
  },
  responses: { /* ... */ },
})

// handlers.ts
export const createUserHandler: RouteHandler<typeof createUserRoute, HonoEnv> = async (c) => {
  // Automatically validated - throws 400 if invalid
  const input = c.req.valid('json')  // Type: CreateUserInput

  // ...
}
```

### Validation Sources

```typescript
// Body (JSON)
const body = c.req.valid('json')

// Path parameters
const { id } = c.req.valid('param')

// Query parameters
const { page, limit } = c.req.valid('query')

// Headers
const { 'account-id': accountId } = c.req.valid('header')
```

### Validation Error Response

When validation fails, Hono automatically returns:

```json
{
  "success": false,
  "error": {
    "name": "ZodError",
    "issues": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["email"],
        "message": "Required"
      }
    ]
  }
}
```

---

## Common Patterns

### String Validation

```typescript
// Basic string
z.string()

// With length constraints
z.string().min(1).max(255)

// Email
z.email()

// UUID
z.uuid()

// URL
z.string().url()

// Regex
z.string().regex(/^[A-Z]{2,3}$/)

// Enum
z.enum(['draft', 'published', 'archived'])

// Optional
z.string().optional()

// Nullable
z.string().nullable()

// Optional with nullable
z.string().optional().nullable()
```

### Number Validation

```typescript
// Basic number
z.number()

// Coerce from string (query params)
z.coerce.number()

// Constraints
z.number().min(1).max(100)

// Integer
z.number().int()

// Positive
z.number().positive()

// With default
z.coerce.number().default(50)
```

### Date Validation

```typescript
// ISO datetime string
z.iso.datetime()

// Plain string with datetime validation
z.string().datetime()

// With example
z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' })
```

### Boolean Validation

```typescript
// Basic boolean
z.boolean()

// Coerce from string (query params: "true"/"false")
z.coerce.boolean()

// With default
z.boolean().default(false)
```

### Array Validation

```typescript
// Array of strings
z.array(z.string())

// Array of objects
z.array(UserSchema)

// With constraints
z.array(z.string()).min(1).max(10)

// Non-empty
z.array(z.string()).nonempty()
```

---

## Schema Composition

### Extending Schemas

```typescript
// Base schema
const BaseEntitySchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

// Extend with additional fields
const UserSchema = BaseEntitySchema.extend({
  email: z.email(),
  name: z.string(),
})
```

### Merging Schemas

```typescript
const TimestampsSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const AuditSchema = z.object({
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
})

const FullEntitySchema = z.object({
  id: z.uuid(),
  name: z.string(),
}).merge(TimestampsSchema).merge(AuditSchema)
```

### Pick/Omit Fields

```typescript
// Pick specific fields
const PublicUserSchema = UserSchema.pick({
  id: true,
  name: true,
})

// Omit sensitive fields
const SafeUserSchema = UserSchema.omit({
  password: true,
  apiKey: true,
})
```

### Partial Schemas

```typescript
// All fields optional (for updates)
const UpdateUserSchema = UserSchema.partial()

// Make specific fields optional
const UpdateUserSchema = UserSchema.partial({
  name: true,
  status: true,
})
```

### Custom Refinements

```typescript
// Cross-field validation
const DateRangeSchema = z.object({
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
)

// Multiple refinements
const PasswordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  }
)
```

### Transformations

```typescript
// Transform input
const LowercaseEmailSchema = z.string().email().transform((val) => val.toLowerCase())

// Preprocess (before validation)
const TrimmedStringSchema = z.preprocess(
  (val) => typeof val === 'string' ? val.trim() : val,
  z.string().min(1)
)
```

---

## Complete Example

### Full Schema File

```typescript
// src/server/routes/products/schemas.ts
import { z } from '@hono/zod-openapi'
import { createPaginatedSchema } from '../schemas'

// Entity schema
export const ProductSchema = z
  .object({
    id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    accountId: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440001' }),
    name: z.string().openapi({ example: 'Premium Widget' }),
    description: z.string().nullable().openapi({ example: 'High-quality widget' }),
    price: z.number().openapi({ example: 99.99 }),
    status: z.enum(['draft', 'active', 'archived']).openapi({ example: 'active' }),
    tags: z.array(z.string()).openapi({ example: ['electronics', 'gadget'] }),
    createdAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.iso.datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('Product')

// Create input
export const CreateProductSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'New Product' }),
    description: z.string().max(5000).optional().openapi({ example: 'Product description' }),
    price: z.number().min(0).openapi({ example: 49.99 }),
    status: z.enum(['draft', 'active']).default('draft').openapi({ example: 'draft' }),
    tags: z.array(z.string()).max(10).default([]).openapi({ example: ['tag1'] }),
  })
  .openapi('CreateProductInput')

// Update input
export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: 'Updated Name' }),
    description: z.string().max(5000).optional().openapi({ example: 'Updated description' }),
    price: z.number().min(0).optional().openapi({ example: 79.99 }),
    status: z.enum(['draft', 'active', 'archived']).optional().openapi({ example: 'active' }),
    tags: z.array(z.string()).max(10).optional().openapi({ example: ['updated-tag'] }),
  })
  .openapi('UpdateProductInput')

// Paginated response
export const PaginatedProductsSchema = createPaginatedSchema(ProductSchema, 'Products')

// Type exports
export type Product = z.infer<typeof ProductSchema>
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
```

---

**Related Files:**
- [SKILL.md](../SKILL.md) - Main skill guide
- [routing-and-handlers.md](routing-and-handlers.md) - Using schemas in routes
- [complete-examples.md](complete-examples.md) - Full CRUD example
