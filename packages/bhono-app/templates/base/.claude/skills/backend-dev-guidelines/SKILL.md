---
name: backend-dev-guidelines
description: Use when creating or modifying backend code in this Hono.js boilerplate. Covers OpenAPIHono routes, handlers, services, D1 database access, Zod validation, middleware patterns, RBAC guards, session auth, and multi-tenant architecture on Cloudflare Workers.
---

# Backend Development Guidelines

## Purpose

Establish consistency and best practices for backend development using Hono.js on Cloudflare Workers with D1 database, KV sessions, and multi-tenant RBAC.

## When to Use This Skill

Automatically activates when:
- Creating or modifying API routes and handlers
- Building services for business logic
- Working with D1 database operations
- Implementing middleware or guards
- Adding validation with Zod + OpenAPI
- Handling authentication and authorization
- Writing backend tests

### Related Skills (Use Together)

> **IMPORTANT**: Always use the appropriate specialized skill for these tasks:

| Task | Skill to Use | Command |
|------|--------------|---------|
| E2E tests, Playwright tests, UI tests | `playwright-e2e-testing` | `/playwright-e2e-testing` |
| Cloudflare deploy, D1 migrations, KV/R2, wrangler commands | `wrangler` | `/wrangler` |

**When to delegate:**
- **Playwright skill**: Running `pnpm test:e2e`, writing `.spec.ts` files, debugging flaky tests, visual regression, mobile testing
- **Wrangler skill**: `wrangler deploy`, `wrangler d1`, `wrangler kv`, `wrangler secret`, updating `wrangler.json`

---

## Quick Start Checklist

### New API Endpoint

- [ ] **Route**: Define with `createRoute()` + OpenAPI schema
- [ ] **Handler**: Implement `RouteHandler<typeof route, HonoEnv>`
- [ ] **Service**: Business logic function
- [ ] **Schema**: Zod schemas with `.openapi()` extensions
- [ ] **Guards**: Apply `requireRole()` if protected
- [ ] **Tests**: Unit + integration tests

### New Resource (CRUD)

- [ ] Create `src/server/routes/{resource}/` directory
- [ ] `schemas.ts` - Zod schemas with OpenAPI
- [ ] `routes.ts` - Route definitions with `createRoute()`
- [ ] `handlers.ts` - Handler implementations
- [ ] `index.ts` - Router setup with guards
- [ ] `src/server/services/{resource}.ts` - Service layer
- [ ] Mount in `src/server/routes/index.ts`

---

## Architecture Overview

### Layered Architecture

```
HTTP Request
    ↓
Middleware Stack (error handler, context, session, account)
    ↓
Routes (OpenAPI definitions)
    ↓
Handlers (request/response handling)
    ↓
Services (business logic)
    ↓
D1 Database (SQL helpers)
```

**Key Principle:** Each layer has ONE responsibility.

See [architecture-overview.md](resources/architecture-overview.md) for details.

---

## Directory Structure

```
src/server/
├── index.ts              # App entry, middleware stack
├── routes/
│   ├── index.ts          # API router with OpenAPI
│   ├── schemas.ts        # Shared schemas
│   ├── openapi.ts        # OpenAPI config
│   ├── auth/             # OAuth routes
│   ├── users/            # User CRUD
│   ├── accounts/         # Account management
│   └── {resource}/       # Feature routes
│       ├── index.ts      # Router + guards
│       ├── routes.ts     # OpenAPI route definitions
│       ├── handlers.ts   # Handler implementations
│       └── schemas.ts    # Zod schemas
├── services/             # Business logic
├── middleware/           # Hono middleware
├── auth/                 # Roles, permissions, guards
├── lib/                  # Utilities (session, audit, errors)
└── db/                   # D1 SQL helpers
```

---

## Core Principles (7 Key Rules)

### 1. Routes Define OpenAPI, Handlers Execute

```typescript
// routes.ts - Define OpenAPI schema
export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  request: { params: IdParamSchema },
  responses: { 200: { content: { 'application/json': { schema: UserSchema } } } },
})

// handlers.ts - Implement logic
export const getUserHandler: RouteHandler<typeof getUserRoute, HonoEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const user = await usersService.findById(c.get('db'), ctx, id)
  return c.json({ data: user }, 200)
}
```

### 2. Handlers Delegate to Services

```typescript
// Handler extracts context and calls service
const ctx: ServiceContext = {
  accountId: c.get('accountId'),
  user: c.get('user'),
  transactionId: c.get('transactionId'),
}
const result = await usersService.update(db, ctx, id, data)
return c.json({ data: result }, 200)
```

### 3. Services Contain Business Logic

```typescript
// Service has no HTTP knowledge
export const usersService = {
  async update(db: D1Database, ctx: ServiceContext, id: string, input: UpdateUserInput) {
    // Business rule validation
    if (input.email) {
      const existing = await this.findByEmail(db, ctx, input.email)
      if (existing && existing.id !== id) {
        throw new ConflictError('Email already in use')
      }
    }
    return await auditedUpdate(db, ctx, 'users', input, { clause: 'id = ?', params: [id] })
  },
}
```

### 4. Errors via HTTPException

```typescript
import { HTTPException } from 'hono/http-exception'
import { NotFoundError, ValidationError } from '@server/lib/errors'

// Throw custom errors - caught by global errorHandler
if (!user) throw new NotFoundError('User')
if (!valid) throw new ValidationError('Invalid input', details)
```

### 5. Validate with Zod + OpenAPI

```typescript
export const CreateUserSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().min(1).openapi({ example: 'John Doe' }),
}).openapi('CreateUser')

// In handler - automatic validation
const data = c.req.valid('json')  // Typed and validated
```

### 6. Guards for RBAC

```typescript
// Apply guards per route
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)
```

### 7. Audit Logging Automatic

```typescript
// Use audited helpers for automatic change tracking
await auditedUpdate(db, ctx, 'users', changes, where)
await auditedDelete(db, ctx, 'users', where)

// Creates audit_logs entry with:
// - transaction_id, user_id, account_id
// - entity, entity_id, action
// - changes diff, ip_address, user_agent
```

---

## Common Imports

```typescript
// Hono
import { Hono } from 'hono'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'

// Types
import type { HonoEnv, ServiceContext } from '@server/types'
import type { RouteHandler } from '@hono/zod-openapi'

// Database
import { queryOne, queryAll, execute } from '@server/db/sql'
import { auditedUpdate, auditedDelete } from '@server/lib/audited-db'

// Auth
import { requireRole, requirePermission } from '@server/auth/guards'
import { Role, hasMinimumRole } from '@server/auth/roles'

// Errors
import { NotFoundError, ValidationError, ConflictError } from '@server/lib/errors'

// Session
import { getSession, createSession, destroySession } from '@server/lib/session'
```

---

## HTTP Status Codes

| Code | Use Case |
|------|----------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 500 | Internal Server Error |

---

## Anti-Patterns to Avoid

- Business logic in handlers (use services)
- Direct SQL in handlers (use services + sql helpers)
- Missing `c.req.valid()` for input (use Zod schemas)
- Throwing plain `Error` (use HTTPException or custom errors)
- Missing guards on protected routes
- Hardcoding account filtering (use ServiceContext)
- console.log for errors (errors are logged by errorHandler)

---

## Navigation Guide

| Need to... | Read this |
|------------|-----------|
| Understand architecture | [architecture-overview.md](resources/architecture-overview.md) |
| Create routes/handlers | [routing-and-handlers.md](resources/routing-and-handlers.md) |
| Write business logic | [services-layer.md](resources/services-layer.md) |
| Validate input | [validation-and-openapi.md](resources/validation-and-openapi.md) |
| Create middleware | [middleware-guide.md](resources/middleware-guide.md) |
| Database operations | [database-patterns.md](resources/database-patterns.md) |
| Auth and guards | [auth-and-guards.md](resources/auth-and-guards.md) |
| Handle errors | [error-handling.md](resources/error-handling.md) |
| Write tests | [testing-guide.md](resources/testing-guide.md) |
| See full examples | [complete-examples.md](resources/complete-examples.md) |

---

## Code Examples (Copy-Paste Templates)

Ready-to-use code templates in `examples/`:

| Folder | Purpose |
|--------|---------|
| `feature-crud/` | Complete CRUD feature (schemas, routes, handlers, service, index) |
| `service-patterns/` | Service layer patterns (batch ops, search/filter, external APIs) |
| `middleware-examples/` | Custom middleware (rate limiter, logger, validators) |
| `test-examples/` | Unit and integration test patterns |

### Feature CRUD Template

```bash
# Copy to create a new feature
cp -r .claude/skills/backend-dev-guidelines/examples/feature-crud src/server/routes/{your-feature}
```

Then rename "products" to your entity and update:
1. Schemas for your data model
2. Routes for your API contract
3. Handlers for request/response
4. Service for business logic
5. Index to apply guards

---

## Resource Files Summary

| File | Purpose |
|------|---------|
| `architecture-overview.md` | Layered architecture, middleware stack, HonoEnv |
| `routing-and-handlers.md` | OpenAPIHono, createRoute, RouteHandler |
| `services-layer.md` | Service pattern, ServiceContext, audit integration |
| `validation-and-openapi.md` | Zod schemas, OpenAPI integration, DTOs |
| `middleware-guide.md` | createMiddleware, ordering, request context |
| `database-patterns.md` | D1 helpers, row mapping, transactions |
| `auth-and-guards.md` | Roles, permissions, guards, multi-tenancy |
| `error-handling.md` | HTTPException, custom errors, error codes |
| `testing-guide.md` | Vitest, Playwright, fixtures, mocks |
| `complete-examples.md` | Full CRUD example, new feature walkthrough |

---

## Hono.js Official Documentation

Raw markdown links from [honojs/website](https://github.com/honojs/website) repository.

### API Reference

| Topic | Raw MD Link |
|-------|-------------|
| Hono App | [hono.md](https://raw.githubusercontent.com/honojs/website/main/docs/api/hono.md) |
| Routing | [routing.md](https://raw.githubusercontent.com/honojs/website/main/docs/api/routing.md) |
| Context | [context.md](https://raw.githubusercontent.com/honojs/website/main/docs/api/context.md) |
| HonoRequest | [request.md](https://raw.githubusercontent.com/honojs/website/main/docs/api/request.md) |
| Exception | [exception.md](https://raw.githubusercontent.com/honojs/website/main/docs/api/exception.md) |
| Presets | [presets.md](https://raw.githubusercontent.com/honojs/website/main/docs/api/presets.md) |

### Getting Started

| Runtime | Raw MD Link |
|---------|-------------|
| Basic | [basic.md](https://raw.githubusercontent.com/honojs/website/main/docs/getting-started/basic.md) |
| Cloudflare Workers | [cloudflare-workers.md](https://raw.githubusercontent.com/honojs/website/main/docs/getting-started/cloudflare-workers.md) |
| Cloudflare Pages | [cloudflare-pages.md](https://raw.githubusercontent.com/honojs/website/main/docs/getting-started/cloudflare-pages.md) |
| Node.js | [nodejs.md](https://raw.githubusercontent.com/honojs/website/main/docs/getting-started/nodejs.md) |
| Bun | [bun.md](https://raw.githubusercontent.com/honojs/website/main/docs/getting-started/bun.md) |
| Deno | [deno.md](https://raw.githubusercontent.com/honojs/website/main/docs/getting-started/deno.md) |

### Guides

| Guide | Raw MD Link |
|-------|-------------|
| Middleware | [middleware.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/middleware.md) |
| Validation | [validation.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/validation.md) |
| Testing | [testing.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/testing.md) |
| JSX | [jsx.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/jsx.md) |
| RPC | [rpc.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/rpc.md) |
| Best Practices | [best-practices.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/best-practices.md) |
| Helpers | [helpers.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/helpers.md) |
| FAQ | [faq.md](https://raw.githubusercontent.com/honojs/website/main/docs/guides/faq.md) |

### Built-in Middleware

| Middleware | Raw MD Link |
|------------|-------------|
| CORS | [cors.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/cors.md) |
| JWT | [jwt.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/jwt.md) |
| Basic Auth | [basic-auth.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/basic-auth.md) |
| Bearer Auth | [bearer-auth.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/bearer-auth.md) |
| Logger | [logger.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/logger.md) |
| Cache | [cache.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/cache.md) |
| Compress | [compress.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/compress.md) |
| CSRF | [csrf.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/csrf.md) |
| ETag | [etag.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/etag.md) |
| Secure Headers | [secure-headers.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/secure-headers.md) |
| Timeout | [timeout.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/timeout.md) |
| Timing | [timing.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/timing.md) |
| Request ID | [request-id.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/request-id.md) |
| Body Limit | [body-limit.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/body-limit.md) |
| IP Restriction | [ip-restriction.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/ip-restriction.md) |
| Pretty JSON | [pretty-json.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/pretty-json.md) |
| Trailing Slash | [trailing-slash.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/builtin/trailing-slash.md) |
| Third-Party | [third-party.md](https://raw.githubusercontent.com/honojs/website/main/docs/middleware/third-party.md) |

### Helpers

| Helper | Raw MD Link |
|--------|-------------|
| Factory | [factory.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/factory.md) |
| Cookie | [cookie.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/cookie.md) |
| JWT | [jwt.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/jwt.md) |
| Testing | [testing.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/testing.md) |
| Streaming | [streaming.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/streaming.md) |
| WebSocket | [websocket.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/websocket.md) |
| HTML | [html.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/html.md) |
| CSS | [css.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/css.md) |
| Dev | [dev.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/dev.md) |
| Adapter | [adapter.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/adapter.md) |
| ConnInfo | [conninfo.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/conninfo.md) |
| SSG | [ssg.md](https://raw.githubusercontent.com/honojs/website/main/docs/helpers/ssg.md) |

### Concepts

| Concept | Raw MD Link |
|---------|-------------|
| Motivation | [motivation.md](https://raw.githubusercontent.com/honojs/website/main/docs/concepts/motivation.md) |
| Routers | [routers.md](https://raw.githubusercontent.com/honojs/website/main/docs/concepts/routers.md) |
| Middleware | [middleware.md](https://raw.githubusercontent.com/honojs/website/main/docs/concepts/middleware.md) |
| Web Standard | [web-standard.md](https://raw.githubusercontent.com/honojs/website/main/docs/concepts/web-standard.md) |
| Benchmarks | [benchmarks.md](https://raw.githubusercontent.com/honojs/website/main/docs/concepts/benchmarks.md) |
| Hono Stacks | [stacks.md](https://raw.githubusercontent.com/honojs/website/main/docs/concepts/stacks.md) |

### Related Packages

| Package | Documentation |
|---------|---------------|
| @hono/zod-openapi | [GitHub](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) |
| @hono/zod-validator | [GitHub](https://github.com/honojs/middleware/tree/main/packages/zod-validator) |
| Cloudflare D1 | [Cloudflare Docs](https://developers.cloudflare.com/d1/) |
| Cloudflare KV | [Cloudflare Docs](https://developers.cloudflare.com/kv/) |
| Cloudflare R2 | [Cloudflare Docs](https://developers.cloudflare.com/r2/) |

---

**Skill Status**: COMPLETE
**Target**: Hono.js + Cloudflare Workers + D1
