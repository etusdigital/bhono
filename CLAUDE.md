# Hono Boilerplate

Production-ready multi-tenant SaaS boilerplate with Hono.js backend and React frontend, deployed on Cloudflare Workers.

## Tech Stack

- **Runtime**: Cloudflare Workers (D1 database, KV sessions, R2 storage)
- **Backend**: Hono.js 4.6 + SQL (D1) + Zod validation
- **Frontend**: React 19 + TanStack Router + Tailwind CSS 4.0
- **Testing**: Vitest (unit/integration) + Playwright (E2E)
- **Auth**: Google OAuth 2.0 with session-based cookies

## Project Structure

```
├── config/                     # All configuration files
│   ├── vite.config.ts          # Vite build config
│   ├── vitest.config.ts        # Backend unit tests
│   ├── vitest.frontend.config.ts
│   ├── vitest.browser.config.ts
│   ├── eslint.config.js
│   └── wrangler.json           # Cloudflare Workers config
│
├── src/
│   ├── server/                 # Backend (Hono.js)
│   │   ├── routes/             # API endpoints (OpenAPI)
│   │   │   ├── auth/           # OAuth login, logout, me, refresh
│   │   │   ├── users/          # User CRUD
│   │   │   ├── accounts/       # Multi-tenant workspaces
│   │   │   ├── invitations/    # Team invite system
│   │   │   ├── audits/         # Audit log queries
│   │   │   ├── storage/        # R2 file operations
│   │   │   └── health/         # Health check
│   │   ├── services/           # Business logic layer
│   │   ├── middleware/         # Auth, CORS, logging, rate-limit
│   │   ├── db/records.ts       # DB record types for SQL mapping
│   │   ├── lib/                # Utilities (oauth, session, tokens)
│   │   └── auth/               # Roles, permissions, guards
│   │
│   ├── client/                 # Frontend (React)
│   │   ├── routes/             # TanStack file-based routing
│   │   │   └── _authenticated/ # Protected pages
│   │   ├── components/ui/      # Reusable UI components
│   │   └── hooks/              # React hooks (use-auth)
│   │
│   └── shared/                 # Shared between client/server
│       ├── schemas/            # Zod validation schemas
│       └── types/              # TypeScript types
│
├── tests/                      # All tests (centralized)
│   ├── unit/                   # Unit tests
│   │   ├── server/             # Backend unit tests
│   │   └── client/             # Frontend unit tests
│   ├── integration/            # Integration tests
│   ├── e2e/                    # Playwright E2E tests
│   │   ├── journeys/           # User journey tests
│   │   ├── crud/               # CRUD operation tests
│   │   ├── api/                # API tests
│   │   ├── a11y/               # Accessibility tests
│   │   ├── visual/             # Visual regression
│   │   └── mobile/             # Responsive tests
│   ├── fixtures/               # Test fixtures
│   ├── mocks/                  # Test mocks
│   └── helpers/                # Test utilities
│
├── packages/                   # Monorepo packages
│   └── bhono-app/        # Project scaffolding CLI
│
├── docs/                       # Documentation
├── scripts/                    # Build/utility scripts
└── migrations/                 # D1 SQL migrations
```

## Development

### Commands

```bash
pnpm dev                    # Start dev server (Vite + Wrangler)
pnpm build                  # Build for production
pnpm deploy                 # Deploy to Cloudflare Workers

# Database
pnpm db:migrate:local       # Apply migrations locally
pnpm db:migrate:remote      # Apply migrations to production
pnpm db:seed                # Seed test data

# Testing
pnpm test                   # Backend unit tests (watch)
pnpm test:run               # Backend tests (single run)
pnpm test:client            # Frontend unit tests
pnpm test:integration       # Integration tests
pnpm test:e2e               # Playwright E2E tests
pnpm test:e2e:ui            # Playwright interactive UI
pnpm test:coverage          # Coverage report

# Code quality
pnpm lint                   # ESLint
pnpm cf-typegen             # Generate Cloudflare types
```

### Workflow

1. Make changes
2. Run `pnpm test` for affected unit tests
3. Run `pnpm lint` to check code style
4. Run `pnpm test:e2e` for E2E validation
5. Verify build with `pnpm build`

### Path Aliases

Defined in `tsconfig.json`:
- `@/*` → `src/client/*`
- `@shared/*` → `src/shared/*`
- `@server/*` → `src/server/*`

## Architecture

### Multi-Tenancy

Users belong to multiple Accounts (workspaces). Each user-account relationship has a Role: `ADMIN`, `EDITOR`, `VIEWER`. Permissions checked via guards in `src/server/auth/guards.ts`.

### Authentication & Identity

Auth, users, accounts, memberships, invitations and audit logging are owned by the internal package **`@etus/auth`** (gateway-backed OAuth via `ag.etus.io`). The boilerplate configures it in `src/server/auth/setup.ts` (`getAuth(env)` lazy singleton) and mounts the package routes from `src/server/index.ts`:

- `/auth/*` — OAuth flow (`login`, `callback`, `logout`, `me`)
- `/auth/admin/*` — admin user management (admin-only)
- `/accounts/*` — accounts + memberships (multi-tenant)
- `/invitations/*` — accept pending invites
- `/audit/*` — audit log queries (admin-only)
- `/auth/test-login` — dev-only endpoint (`routes/dev-login.ts`); writes a session directly to KV/D1 for E2E
- `/api/*` — boilerplate's own API (currently only `/storage`); protected by `auth.middleware()`

The RBAC matrix (4 roles: `owner > admin > member > guest`) and the permission catalog live in `src/server/auth/matrix.ts`. App routes guard with `requirePermission(...)` from `src/server/auth/guards.ts`, which reads the permissions resolved by the package's pipeline.

Staff cross-product access is configured via `ETUS_ADMIN_EMAILS` (CSV) — listed emails receive `role='admin'` automatically on the OAuth callback. `@etus/auth` requires at least one; the template ships a generic placeholder (`admin@etus.com.br`) that each product must replace with its real admins.

Post-auth redirects are set in `src/server/auth/setup.ts` (`redirects.afterLogin: '/'`, `afterLogout: '/login'`) — both point at local SPA routes. `afterLogout` must NOT be `/auth/login` (the package's OAuth entry). Products with different route names adjust them there.

### Request Context

Every request gets a `transactionId` for tracing across logs. See `src/server/middleware/request-context.ts`.

### Audit Logging

Login, user lifecycle, account changes and invitations are logged automatically by `@etus/auth` (`audit.enabled=true` in `setup.ts`). Query programmatically via `auth.getAuditLogger().query(...)`.

## Key Files

| File | Purpose |
|------|---------|
| `src/server/index.ts` | Hono app entry, middleware stack |
| `src/server/routes/index.ts` | API router with OpenAPI/Swagger |
| `src/server/db/schema/` | Database schema definitions |
| `src/client/routes/__root.tsx` | React app root layout |
| `src/client/routes/_authenticated.tsx` | Protected routes wrapper |
| `config/wrangler.json` | Cloudflare Workers configuration |
| `playwright.config.ts` | E2E test configuration |

## API Documentation

- **OpenAPI JSON**: `/api/doc`
- **Swagger UI**: `/api/swagger`

## Testing Strategy

### Coverage Thresholds

| Layer | Statements | Branches | Functions |
|-------|------------|----------|-----------|
| Server Unit | 90% | 84% | 85% |
| Client Unit | 65% | 70% | 58% |
| Integration | 90%+ | 85%+ | 90%+ |

### E2E Test Tags

| Tag | Purpose |
|-----|---------|
| `@smoke` | Basic health checks |
| `@critical` | Must-pass paths |
| `@crud` | Create/Read/Update/Delete |
| `@a11y` | Accessibility compliance |
| `@visual` | Visual regression |
| `@mobile` | Mobile responsive |

### Test Authentication

E2E tests use `/auth/test-login` endpoint (dev only) or OAuth session capture for production testing.

## Environment Variables

Required in `.env` (see `.env.example`):

- `JWT_SECRET` - Session signing key (min 32 chars)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `SENDGRID_API_KEY` - Email service for invitations
- `APP_URL` - Application base URL

## Cloudflare Bindings

Defined in `config/wrangler.json`:

- `DB` - D1 database
- `SESSIONS` - KV namespace for sessions
- `R2_BUCKET` - R2 storage for files

## Common Patterns

### Adding a New API Route

1. Create route folder in `src/server/routes/{resource}/`
2. Define schemas in `schemas.ts` (Zod + OpenAPI)
3. Implement handlers in `handlers.ts`
4. Register routes in `routes.ts`
5. Export from `index.ts`
6. Mount in `src/server/routes/index.ts`

### Adding a Protected Page

1. Create file in `src/client/routes/_authenticated/{page}.tsx`
2. Use `createFileRoute` from TanStack Router
3. Access auth via `useAuth()` hook

### Database Changes

1. Update `schema.sql`
2. Apply with `pnpm db:schema:local`
3. (Optional) Seed with `pnpm db:seed:local`
