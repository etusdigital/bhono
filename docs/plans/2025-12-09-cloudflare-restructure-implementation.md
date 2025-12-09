# Cloudflare Workers Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure boilerplate-hono to use Cloudflare Workers with React frontend, D1 database, and static assets.

**Architecture:** Single deployment with Hono backend as Worker, React frontend as static assets, shared types/schemas between client and server. Auth routes at `/auth/*`, API routes at `/api/*`, SPA for everything else.

**Tech Stack:** Hono, Cloudflare Workers, D1, Drizzle ORM, React 19, TanStack Router, TanStack Query, Shadcn UI, Tailwind CSS v4, Vite.

---

## Phase 1: Project Configuration

### Task 1: Update package.json Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Replace dependencies for Cloudflare Workers**

```json
{
  "name": "hono-boilerplate",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "wrangler deploy",
    "db:migrate:local": "wrangler d1 migrations apply boilerplate-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply boilerplate-db --remote",
    "cf-typegen": "wrangler types",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/zod-openapi": "^0.18.0",
    "@hono/swagger-ui": "^0.5.0",
    "drizzle-orm": "^0.36.0",
    "zod": "^3.24.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.93.0",
    "@tanstack/react-query": "^5.62.0",
    "tailwind-merge": "^2.6.0",
    "clsx": "^2.1.1",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241205.0",
    "@cloudflare/vite-plugin": "^1.0.0",
    "@tanstack/router-plugin": "^1.93.0",
    "@tanstack/router-devtools": "^1.93.0",
    "@tanstack/react-query-devtools": "^5.62.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "^5.7.0",
    "wrangler": "^3.99.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.0",
    "drizzle-kit": "^0.30.0"
  }
}
```

**Step 2: Remove node_modules and reinstall**

```bash
rm -rf node_modules package-lock.json
npm install
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update dependencies for Cloudflare Workers"
```

---

### Task 2: Create wrangler.json

**Files:**
- Create: `wrangler.json`

**Step 1: Create Cloudflare Workers configuration**

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hono-boilerplate",
  "main": "./src/server/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "dev": {
    "port": 3000
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "boilerplate-db",
      "database_id": "local"
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
    "ENVIRONMENT": "development",
    "APP_URL": "http://localhost:3000"
  }
}
```

**Step 2: Commit**

```bash
git add wrangler.json
git commit -m "chore: add wrangler.json for Cloudflare Workers"
```

---

### Task 3: Create vite.config.ts

**Files:**
- Create: `vite.config.ts`

**Step 1: Create Vite configuration with Cloudflare plugin**

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
      "@server": fileURLToPath(new URL("./src/server", import.meta.url)),
    },
  },
  build: {
    target: "es2020",
  },
})
```

**Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add vite.config.ts with Cloudflare plugin"
```

---

### Task 4: Create index.html

**Files:**
- Create: `index.html`

**Step 1: Create Vite entry HTML**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hono Boilerplate</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

**Step 2: Create public folder with favicon**

```bash
mkdir -p public
```

**Step 3: Commit**

```bash
git add index.html public/
git commit -m "chore: add index.html and public folder"
```

---

### Task 5: Update TypeScript Configuration

**Files:**
- Modify: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`

**Step 1: Update tsconfig.json as base config**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["@cloudflare/workers-types", "vite/client"],
    "paths": {
      "@/*": ["./src/client/*"],
      "@shared/*": ["./src/shared/*"],
      "@server/*": ["./src/server/*"]
    }
  },
  "include": ["src"],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**Step 2: Create tsconfig.app.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/client/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/client/**/*", "src/shared/**/*"]
}
```

**Step 3: Create tsconfig.node.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Commit**

```bash
git add tsconfig.json tsconfig.app.json tsconfig.node.json
git commit -m "chore: update TypeScript configuration"
```

---

## Phase 2: Folder Restructure

### Task 6: Create New Folder Structure

**Files:**
- Create directories: `src/server/`, `src/client/`, `src/shared/`

**Step 1: Create the new directory structure**

```bash
mkdir -p src/server
mkdir -p src/client/routes
mkdir -p src/client/components/ui
mkdir -p src/client/components/layout
mkdir -p src/client/api
mkdir -p src/client/hooks
mkdir -p src/client/lib
mkdir -p src/shared/types
mkdir -p src/shared/schemas
```

**Step 2: Commit empty directories with .gitkeep**

```bash
touch src/client/routes/.gitkeep
touch src/client/components/ui/.gitkeep
touch src/client/components/layout/.gitkeep
touch src/client/api/.gitkeep
touch src/client/hooks/.gitkeep
touch src/shared/types/.gitkeep
touch src/shared/schemas/.gitkeep
git add src/client src/shared
git commit -m "chore: create client and shared folder structure"
```

---

### Task 7: Move Server Files

**Files:**
- Move: `src/*` → `src/server/`

**Step 1: Move all existing files to server folder**

```bash
# Move all existing src files to server (except the new client/shared folders)
mv src/app.ts src/server/
mv src/index.ts src/server/
mv src/env.ts src/server/
mv src/env.test.ts src/server/
mv src/auth src/server/
mv src/db src/server/
mv src/lib src/server/
mv src/middleware src/server/
mv src/routes src/server/
mv src/services src/server/
mv src/types src/server/
```

**Step 2: Commit the move**

```bash
git add -A
git commit -m "refactor: move existing code to src/server/"
```

---

### Task 8: Extract Shared Types

**Files:**
- Create: `src/shared/types/user.ts`
- Create: `src/shared/types/account.ts`
- Create: `src/shared/types/auth.ts`
- Create: `src/shared/types/index.ts`

**Step 1: Create user types**

```typescript
// src/shared/types/user.ts
import type { Role } from './auth'

export interface User {
  id: string
  googleId: string
  email: string
  name: string
  avatarUrl?: string | null
  status: 'active' | 'inactive'
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Account {
  id: string
  name: string
  description: string | null
  domain: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface UserAccount {
  userId: string
  accountId: string
  role: Role
}
```

**Step 2: Create auth types**

```typescript
// src/shared/types/auth.ts
export const Role = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
  VIEWER: 'VIEWER',
  BILLING: 'BILLING',
  ANALYTICS: 'ANALYTICS',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}
```

**Step 3: Create account types**

```typescript
// src/shared/types/account.ts
export interface Invitation {
  id: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
  invitedBy: {
    id: string
    name: string
  }
}
```

**Step 4: Create index export**

```typescript
// src/shared/types/index.ts
export * from './user'
export * from './auth'
export * from './account'
```

**Step 5: Commit**

```bash
git add src/shared/types/
git commit -m "feat: add shared types"
```

---

### Task 9: Extract Shared Schemas

**Files:**
- Create: `src/shared/schemas/user.ts`
- Create: `src/shared/schemas/account.ts`
- Create: `src/shared/schemas/invitation.ts`
- Create: `src/shared/schemas/index.ts`

**Step 1: Create user schemas**

```typescript
// src/shared/schemas/user.ts
import { z } from 'zod'

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS']),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
```

**Step 2: Create account schemas**

```typescript
// src/shared/schemas/account.ts
import { z } from 'zod'

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>
```

**Step 3: Create invitation schemas**

```typescript
// src/shared/schemas/invitation.ts
import { z } from 'zod'

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS']),
})

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>
```

**Step 4: Create index export**

```typescript
// src/shared/schemas/index.ts
export * from './user'
export * from './account'
export * from './invitation'
```

**Step 5: Commit**

```bash
git add src/shared/schemas/
git commit -m "feat: add shared Zod schemas"
```

---

## Phase 3: D1 Database Migration

### Task 10: Update Database Client for D1

**Files:**
- Modify: `src/server/db/client.ts`

**Step 1: Replace better-sqlite3 with D1**

```typescript
// src/server/db/client.ts
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Database = ReturnType<typeof createDb>

// For use in middleware - db instance per request
export type DbInstance = Database
```

**Step 2: Commit**

```bash
git add src/server/db/client.ts
git commit -m "refactor: update db client for D1"
```

---

### Task 11: Create Worker Environment Types

**Files:**
- Create: `src/server/env.ts` (replace existing)

**Step 1: Create Worker environment type**

```typescript
// src/server/env.ts
export interface Env {
  // D1 Database
  DB: D1Database

  // Static Assets
  ASSETS: Fetcher

  // Environment
  ENVIRONMENT: string

  // App URL
  APP_URL: string

  // JWT
  JWT_SECRET: string
  JWT_EXPIRY_MINUTES: string

  // Google OAuth
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string

  // Refresh Token
  REFRESH_TOKEN_EXPIRY_DAYS: string

  // SendGrid
  SENDGRID_API_KEY: string
  SENDGRID_FROM_EMAIL: string
}

// Helper to get env with defaults
export function getEnv(env: Env) {
  return {
    ...env,
    JWT_EXPIRY_MINUTES: parseInt(env.JWT_EXPIRY_MINUTES || '15', 10),
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10),
  }
}
```

**Step 2: Commit**

```bash
git add src/server/env.ts
git commit -m "refactor: update env for Worker bindings"
```

---

### Task 12: Update Server Entry Point

**Files:**
- Modify: `src/server/index.ts`

**Step 1: Update to use Worker bindings**

```typescript
// src/server/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './env'
import { createDb } from './db/client'
import { auth } from './routes/auth'
import { api } from './routes/api'

// Hono app with bindings
const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: (origin, c) => origin || c.env.APP_URL,
  credentials: true,
}))

// Database middleware - create db instance per request
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  await next()
})

// Mount routes
app.route('/auth', auth)
app.route('/api', api)

export default app
```

**Step 2: Commit**

```bash
git add src/server/index.ts
git commit -m "refactor: update server entry for Workers"
```

---

### Task 13: Create API Router

**Files:**
- Create: `src/server/routes/api.ts`
- Modify: `src/server/routes/index.ts`

**Step 1: Create API router combining all resource routes**

```typescript
// src/server/routes/api.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { Env } from '../env'
import { users } from './users'
import { accounts } from './accounts'
import { invitationsRouter } from './invitations'
import { jwtAuth, accountMiddleware } from '../middleware'

const api = new OpenAPIHono<{ Bindings: Env }>()

// Apply auth middleware to all API routes
api.use('/*', jwtAuth)
api.use('/*', accountMiddleware)

// Mount resource routers
api.route('/users', users)
api.route('/accounts', accounts)
api.route('/invitations', invitationsRouter)

// OpenAPI documentation
api.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Hono Boilerplate API',
    version: '1.0.0',
  },
})

api.get('/docs', swaggerUI({ url: '/api/doc' }))

export { api }
```

**Step 2: Commit**

```bash
git add src/server/routes/api.ts
git commit -m "feat: create API router"
```

---

### Task 14: Update Auth Routes Path

**Files:**
- Modify: `src/server/routes/auth/index.ts`

**Step 1: Update auth router (keep at /auth, not /api/auth)**

The auth routes should already work at `/auth/*`. Verify the callback URL in OAuth config points to `/auth/callback`.

**Step 2: Update Google redirect URI in wrangler.json vars**

```json
"vars": {
  "GOOGLE_REDIRECT_URI": "http://localhost:3000/auth/callback"
}
```

**Step 3: Commit**

```bash
git add src/server/routes/auth/ wrangler.json
git commit -m "fix: ensure auth routes at /auth/*"
```

---

### Task 15: Create D1 Migration

**Files:**
- Create: `migrations/0001_initial.sql`

**Step 1: Create migrations folder**

```bash
mkdir -p migrations
```

**Step 2: Create initial migration from existing schema**

```sql
-- migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_accounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, account_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS account_email_idx ON invitations(account_id, email);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  user_id TEXT REFERENCES users(id),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Step 3: Commit**

```bash
git add migrations/
git commit -m "chore: add D1 initial migration"
```

---

## Phase 4: React Frontend Setup

### Task 16: Create React Entry Point

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/index.css`

**Step 1: Create main.tsx**

```typescript
// src/client/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from './router'
import { queryClient } from './lib/query-client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  </StrictMode>,
)
```

**Step 2: Create index.css with Tailwind**

```css
/* src/client/index.css */
@import "tailwindcss";

@theme {
  --font-sans: "Inter", sans-serif;
}

body {
  font-family: var(--font-sans);
}
```

**Step 3: Commit**

```bash
git add src/client/main.tsx src/client/index.css
git commit -m "feat: add React entry point"
```

---

### Task 17: Create Router Configuration

**Files:**
- Create: `src/client/router.ts`
- Create: `src/client/lib/query-client.ts`

**Step 1: Create router.ts**

```typescript
// src/client/router.ts
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

**Step 2: Create query-client.ts**

```typescript
// src/client/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})
```

**Step 3: Commit**

```bash
git add src/client/router.ts src/client/lib/query-client.ts
git commit -m "feat: add router and query client config"
```

---

### Task 18: Create Root Route

**Files:**
- Create: `src/client/routes/__root.tsx`

**Step 1: Create root route with layout**

```typescript
// src/client/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/client/routes/__root.tsx
git commit -m "feat: add root route"
```

---

### Task 19: Create Index Route

**Files:**
- Create: `src/client/routes/index.tsx`

**Step 1: Create home page**

```typescript
// src/client/routes/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Hono Boilerplate
        </h1>
        <p className="text-gray-600 mb-8">
          Multi-tenant SaaS starter with Cloudflare Workers
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/client/routes/index.tsx
git commit -m "feat: add home page"
```

---

### Task 20: Create Login Route

**Files:**
- Create: `src/client/routes/login.tsx`

**Step 1: Create login page**

```typescript
// src/client/routes/login.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const handleLogin = () => {
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Sign in to your account
        </h2>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/client/routes/login.tsx
git commit -m "feat: add login page"
```

---

### Task 21: Create Lib Utils

**Files:**
- Create: `src/client/lib/utils.ts`

**Step 1: Create cn utility for Tailwind**

```typescript
// src/client/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 2: Commit**

```bash
git add src/client/lib/utils.ts
git commit -m "feat: add cn utility"
```

---

### Task 22: Create Auth Hook

**Files:**
- Create: `src/client/hooks/use-auth.ts`

**Step 1: Create useAuth hook**

```typescript
// src/client/hooks/use-auth.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AuthUser } from '@shared/types'

interface AuthResponse {
  user: AuthUser
}

async function fetchMe(): Promise<AuthResponse | null> {
  const res = await fetch('/auth/me', { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

export function useAuth() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
    },
  })

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}
```

**Step 2: Commit**

```bash
git add src/client/hooks/use-auth.ts
git commit -m "feat: add useAuth hook"
```

---

### Task 23: Create Authenticated Layout

**Files:**
- Create: `src/client/routes/__authenticated.tsx`
- Create: `src/client/routes/__authenticated/dashboard.tsx`

**Step 1: Create authenticated layout route**

```typescript
// src/client/routes/__authenticated.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'

export const Route = createFileRoute('/__authenticated')({
  beforeLoad: async () => {
    const res = await fetch('/auth/me', { credentials: 'include' })
    if (!res.ok) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, logout, isLoggingOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hono Boilerplate</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
```

**Step 2: Create dashboard page**

```typescript
// src/client/routes/__authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h2>
      <p className="text-gray-600">Welcome to your dashboard.</p>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/client/routes/__authenticated.tsx src/client/routes/__authenticated/
git commit -m "feat: add authenticated layout and dashboard"
```

---

## Phase 5: Final Integration

### Task 24: Update Middleware for Workers

**Files:**
- Modify: `src/server/middleware/auth.ts`

**Step 1: Update auth middleware to use env from context**

The middleware needs to access `c.env.JWT_SECRET` instead of importing from env.ts. Update all middleware files to receive env from Hono context.

**Step 2: Commit**

```bash
git add src/server/middleware/
git commit -m "refactor: update middleware for Worker env"
```

---

### Task 25: Clean Up Old Files

**Files:**
- Delete: `src/server/index.ts` (old node server entry)
- Delete: `drizzle.config.ts` (if using wrangler migrations)

**Step 1: Remove old node-specific files**

```bash
rm -f src/server/app.ts  # If exists
rm -f drizzle.config.ts  # Using wrangler d1 migrations instead
```

**Step 2: Update .gitignore**

Add to .gitignore:
```
dist/
.wrangler/
.dev.vars
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up old files"
```

---

### Task 26: Test Local Development

**Step 1: Create local D1 database**

```bash
wrangler d1 create boilerplate-db --local
```

**Step 2: Apply migrations locally**

```bash
wrangler d1 migrations apply boilerplate-db --local
```

**Step 3: Create .dev.vars for secrets**

```
JWT_SECRET=development-secret-key-min-32-chars-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@example.com
```

**Step 4: Start development server**

```bash
npm run dev
```

**Step 5: Verify**
- Visit http://localhost:3000 - should see React home page
- Visit http://localhost:3000/login - should see login page
- Click login - should redirect to Google OAuth
- Visit http://localhost:3000/api/docs - should see Swagger UI

**Step 6: Commit .dev.vars.example**

```bash
cp .dev.vars .dev.vars.example
# Remove actual secrets from .dev.vars.example
git add .dev.vars.example
git commit -m "chore: add .dev.vars.example"
```

---

## Summary

This plan restructures the boilerplate from a Node.js server to Cloudflare Workers with:

1. **Phase 1**: Project configuration (package.json, wrangler.json, vite.config.ts)
2. **Phase 2**: Folder restructure (server/client/shared)
3. **Phase 3**: D1 database migration
4. **Phase 4**: React frontend with TanStack Router/Query
5. **Phase 5**: Final integration and testing

Total tasks: 26
