# Hono Boilerplate

Production-ready multi-tenant SaaS boilerplate with Hono.js backend and React frontend, deployed on Cloudflare Workers.

## Tech Stack

- **Runtime**: Cloudflare Workers (D1 database, KV sessions, R2 storage)
- **Backend**: Hono.js 4.6 + Drizzle ORM + Zod validation
- **Frontend**: React 19 + TanStack Router + Tailwind CSS 4.0
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Auth**: Google OAuth 2.0 with session-based cookies

## Project Structure

```
src/
├── server/                     # Backend (Hono.js)
│   ├── routes/                 # API endpoints (OpenAPI)
│   │   ├── auth/               # OAuth login, logout, me, refresh
│   │   ├── users/              # User CRUD
│   │   ├── accounts/           # Multi-tenant workspaces
│   │   ├── invitations/        # Team invite system
│   │   ├── audits/             # Audit log queries
│   │   ├── storage/            # R2 file operations
│   │   └── health/             # Health check
│   ├── services/               # Business logic layer
│   ├── middleware/             # Auth, CORS, logging, error handling
│   ├── db/
│   │   ├── schema/             # Drizzle table definitions
│   │   └── migrations/         # SQL migrations (Drizzle Kit)
│   ├── lib/                    # Utilities (oauth, session, tokens, email)
│   └── auth/                   # Roles, permissions, guards
│
├── client/                     # Frontend (React)
│   ├── routes/                 # TanStack file-based routing
│   │   ├── _authenticated/     # Protected pages (dashboard, team, settings)
│   │   └── *.tsx               # Public pages (login, invite)
│   ├── components/
│   │   └── ui/                 # Reusable UI components
│   └── hooks/                  # React hooks (use-auth)
│
├── shared/                     # Shared between client/server
│   ├── schemas/                # Zod validation schemas
│   └── types/                  # TypeScript types
│
├── e2e/                        # Playwright E2E tests
│   ├── crud/                   # CRUD operation tests
│   ├── journeys/               # User journey tests
│   ├── api/                    # API integration tests
│   ├── a11y/                   # Accessibility tests
│   ├── mobile/                 # Responsive tests
│   └── visual/                 # Visual regression snapshots
│
└── migrations/                 # D1 SQL migrations (production)
```

## Development

### Commands

```bash
npm run dev                 # Start dev server (Vite + Wrangler)
npm run build               # Build for production
npm run deploy              # Deploy to Cloudflare Workers

# Database
npm run db:migrate:local    # Apply migrations locally
npm run db:migrate:remote   # Apply migrations to production
npm run db:seed             # Seed test data

# Testing
npm test                    # Backend unit tests (watch)
npm run test:run            # Backend tests (single run)
npm run test:client         # Frontend tests
npm run test:e2e            # Playwright E2E tests
npm run test:e2e:ui         # Playwright interactive UI
npm run test:coverage       # Coverage report

# Code quality
npm run lint                # ESLint
npm run cf-typegen          # Generate Cloudflare types
```

### Workflow

1. Make changes
2. Run `npm test` for affected unit tests
3. Run `npm run lint` to check code style
4. Run `npm run test:e2e` for E2E validation
5. Verify build with `npm run build`

### Path Aliases

```typescript
import { Button } from '@/components/ui/button'     // src/client/*
import { userSchema } from '@shared/schemas'        // src/shared/*
import { createUser } from '@server/services'       // src/server/*
```

## Architecture

### Multi-Tenancy

- **Users** belong to multiple **Accounts** (workspaces)
- Each user-account relationship has a **Role**: `ADMIN`, `EDITOR`, `VIEWER`
- Permissions are checked via guards in `src/server/auth/guards.ts`

### Authentication Flow

1. `/auth/login` → Redirects to Google OAuth
2. `/auth/callback` → Handles OAuth response, creates session in KV
3. Session cookie (`session_id`) sent with all requests
4. `sessionAuth` middleware validates session on protected routes

### Request Context

Every request gets a `transactionId` for tracing across logs.
See `src/server/middleware/request-context.ts`.

### Audit Logging

All state changes are logged to `audit_logs` table.
See `src/server/lib/audit.ts` and `src/server/lib/audited-db.ts`.

## Key Files

| File | Purpose |
|------|---------|
| `src/server/index.ts` | Hono app entry, middleware stack |
| `src/server/routes/index.ts` | API router with OpenAPI/Swagger |
| `src/server/db/schema/` | Database schema definitions |
| `src/client/routes/__root.tsx` | React app root layout |
| `src/client/routes/_authenticated.tsx` | Protected routes wrapper |
| `wrangler.json` | Cloudflare Workers configuration |
| `playwright.config.ts` | E2E test configuration |

## API Documentation

- **OpenAPI JSON**: `/api/doc`
- **Swagger UI**: `/api/swagger`

## Testing Strategy

### Unit Tests (Vitest)

- Backend: `src/server/**/*.test.ts`
- Frontend: `src/client/**/*.test.tsx`
- Coverage thresholds: 90% backend, 85% frontend, 95% shared

### E2E Tests (Playwright)

| Tag | Purpose |
|-----|---------|
| `@smoke` | Basic health checks |
| `@critical` | Must-pass paths (runs on all browsers) |
| `@crud` | Create/Read/Update/Delete operations |
| `@a11y` | Accessibility compliance |
| `@visual` | Visual regression snapshots |
| `@mobile` | Mobile responsive behavior |

### Test Authentication

E2E tests use `/auth/test-login` endpoint (dev only) to create sessions.
See `src/server/routes/auth/test-login.ts` and `e2e/auth.setup.ts`.

## Environment Variables

Required in `.env` (see `.env.example`):

- `JWT_SECRET` - Session signing key (min 32 chars)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `SENDGRID_API_KEY` - Email service for invitations
- `APP_URL` - Application base URL

## Cloudflare Bindings

Defined in `wrangler.json`:

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
2. Run `npx drizzle-kit generate` to create migration
3. Apply with `npm run db:migrate:local`
