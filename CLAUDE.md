# Hono Boilerplate

Production-ready multi-tenant SaaS boilerplate with Hono.js backend and React frontend, deployed on Cloudflare Workers.

## Tech Stack

- **Runtime**: Cloudflare Workers (D1 database, KV sessions, R2 storage)
- **Backend**: Hono.js 4.6 + Drizzle ORM + Zod validation
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
│   │   ├── db/schema/          # Drizzle table definitions
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
│   └── create-etus-app/        # Project scaffolding CLI
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

### Authentication Flow

1. `/auth/login` → Redirects to Google OAuth
2. `/auth/callback` → Handles OAuth response, creates session in KV
3. Session cookie (`__Host-sid`) sent with all requests
4. `sessionAuth` middleware validates session on protected routes

### Request Context

Every request gets a `transactionId` for tracing across logs. See `src/server/middleware/request-context.ts`.

### Audit Logging

All state changes logged to `audit_logs` table. See `src/server/lib/audit.ts`.

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

1. Modify schema in `src/server/db/schema/`
2. Run `pnpm drizzle-kit generate` to create migration
3. Apply with `pnpm db:migrate:local`
