# Cloudflare Workers Restructure Design

**Date**: 2025-12-08
**Status**: Approved

---

## Overview

Restructure boilerplate-hono to use Cloudflare Workers with static assets, adding a React frontend with Shadcn UI and migrating from SQLite to D1.

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| Project structure | `src/server/`, `src/client/`, `src/shared/` |
| Frontend | React + Shadcn UI |
| Routing (frontend) | TanStack Router (file-based) |
| Data fetching | TanStack Query |
| Database | Cloudflare D1 (Drizzle ORM) |
| Auth | Cookie-based (existing implementation) |
| Shared code | Types + Zod schemas |
| Dev environment | wrangler dev only |

---

## Project Structure

```
boilerplate-hono/
├── src/
│   ├── server/                 # Hono backend (Cloudflare Worker)
│   │   ├── db/
│   │   │   ├── schema/         # Drizzle schemas
│   │   │   └── client.ts       # D1 client
│   │   ├── routes/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── accounts/
│   │   │   └── invitations/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── lib/
│   │   └── index.ts            # Hono app entry
│   │
│   ├── client/                 # React frontend
│   │   ├── routes/             # TanStack Router (file-based)
│   │   │   ├── __root.tsx
│   │   │   ├── index.tsx
│   │   │   ├── login.tsx
│   │   │   └── __authenticated/
│   │   │       ├── dashboard.tsx
│   │   │       ├── users/
│   │   │       ├── accounts/
│   │   │       └── settings.tsx
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn components
│   │   │   └── layout/
│   │   ├── api/                # TanStack Query hooks
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── utils.ts        # cn() helper
│   │   │   └── query-client.ts
│   │   ├── router.ts
│   │   ├── routeTree.gen.ts    # Auto-generated
│   │   └── main.tsx
│   │
│   └── shared/                 # Shared between client/server
│       ├── types/
│       │   ├── user.ts
│       │   ├── account.ts
│       │   ├── auth.ts
│       │   └── index.ts
│       └── schemas/
│           ├── user.ts
│           ├── account.ts
│           ├── invitation.ts
│           ├── auth.ts
│           └── index.ts
│
├── public/                     # Static assets
├── index.html                  # Vite entry
├── wrangler.json               # Cloudflare config
├── vite.config.ts              # Vite + @cloudflare/vite-plugin
├── drizzle.config.ts
├── components.json             # Shadcn config
├── tailwind.config.ts
└── package.json
```

---

## Route Structure

**URL paths:**

| Path | Handler | Description |
|------|---------|-------------|
| `/auth/login` | Worker | OAuth initiate |
| `/auth/callback` | Worker | OAuth callback (user-facing) |
| `/auth/me` | Worker | Current user |
| `/auth/refresh` | Worker | Refresh token |
| `/auth/logout` | Worker | Logout |
| `/auth/invite/:token` | Worker | Accept invitation |
| `/api/users/*` | Worker | Users CRUD |
| `/api/accounts/*` | Worker | Accounts CRUD |
| `/api/invitations/*` | Worker | Invitations CRUD |
| `/api/docs` | Worker | Swagger UI |
| `/*` | Static/SPA | React frontend |

**Hono routing:**

```typescript
// src/server/index.ts
const app = new Hono<{ Bindings: Env }>()

// Auth routes at root (clean URLs for OAuth callback)
app.route('/auth', authRouter)

// API routes under /api
const api = new Hono()
api.route('/users', usersRouter)
api.route('/accounts', accountsRouter)
api.route('/invitations', invitationsRouter)
api.get('/docs', swaggerUI({ url: '/api/doc' }))
api.doc('/doc', { ... })

app.route('/api', api)

export default app
```

---

## Cloudflare Configuration

**wrangler.json:**

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hono-boilerplate",
  "main": "./src/server/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "boilerplate-db",
      "database_id": "<your-d1-id>"
    }
  ],

  "assets": {
    "directory": "./dist/client",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS",
    "run_worker_first": [
      "/api/*",
      "/auth/*"
    ]
  },

  "vars": {
    "ENVIRONMENT": "development"
  }
}
```

**Routing behavior:**

- `/api/*` and `/auth/*` → Worker runs first (Hono handles these)
- All other paths → Static assets served, SPA fallback to index.html

---

## D1 Database Migration

**Dependencies change:**

```diff
- "better-sqlite3": "^11.6.0"
- "@hono/node-server": "^1.13.0"
- "@types/better-sqlite3": "^7.6.12"
+ "@cloudflare/workers-types": "^4.x"
```

**Drizzle client:**

```typescript
// src/server/db/client.ts
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Database = ReturnType<typeof createDb>
```

**Worker bindings:**

```typescript
// src/server/index.ts
type Env = {
  DB: D1Database
  ASSETS: Fetcher
  ENVIRONMENT: string
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  SENDGRID_API_KEY: string
  SENDGRID_FROM_EMAIL: string
  APP_URL: string
}

const app = new Hono<{ Bindings: Env }>()
```

---

## Vite Configuration

**vite.config.ts:**

```typescript
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { cloudflare } from "@cloudflare/vite-plugin"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/client/routes",
      generatedRouteTree: "./src/client/routeTree.gen.ts",
    }),
    react(),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  build: {
    target: "es2020",
  },
})
```

---

## Shared Code

**Types (`src/shared/types/`):**

```typescript
// src/shared/types/user.ts
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  status: 'active' | 'inactive'
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}
```

**Schemas (`src/shared/schemas/`):**

```typescript
// src/shared/schemas/user.ts
import { z } from 'zod'

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER']),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
```

---

## React Frontend

**Entry point (`src/client/main.tsx`):**

```typescript
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { router } from "./router"
import { queryClient } from "./lib/query-client"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
```

**Router (`src/client/router.ts`):**

```typescript
import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
```

**Auth hook (`src/client/hooks/use-auth.ts`):**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/auth/me").then(r => r.ok ? r.json() : null),
    retry: false,
  })

  const logout = useMutation({
    mutationFn: () => fetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null)
    },
  })

  return {
    user: user?.user ?? null,
    isLoading,
    isAuthenticated: !!user?.user,
    logout: logout.mutate,
  }
}
```

---

## Build & Deploy

**Scripts:**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "deploy": "wrangler deploy",
    "db:migrate:local": "wrangler d1 migrations apply boilerplate-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply boilerplate-db --remote",
    "cf-typegen": "wrangler types"
  }
}
```

**Build flow:**

1. `vite build` → Compiles React to `dist/client/`
2. `@cloudflare/vite-plugin` → Bundles Worker
3. `wrangler deploy` → Uploads both to Cloudflare

---

## Key Dependencies

```json
{
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/zod-openapi": "^0.18.0",
    "@hono/swagger-ui": "^0.5.0",
    "drizzle-orm": "^0.36.0",
    "zod": "^3.24.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-query": "^5.x",
    "tailwind-merge": "^3.x",
    "clsx": "^2.x"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.x",
    "@cloudflare/vite-plugin": "^1.x",
    "@tanstack/router-plugin": "^1.x",
    "@tailwindcss/vite": "^4.x",
    "tailwindcss": "^4.x",
    "vite": "^6.x",
    "typescript": "^5.x",
    "wrangler": "^4.x",
    "shadcn": "^3.x"
  }
}
```

---

## Migration Steps (High Level)

1. Update package.json dependencies
2. Create wrangler.json
3. Create vite.config.ts
4. Restructure folders (server/client/shared)
5. Migrate DB client to D1
6. Update env handling for Workers
7. Setup React app with TanStack Router
8. Add Shadcn UI components
9. Create D1 migrations
10. Test locally with `wrangler dev`
