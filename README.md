# Hono Boilerplate

A production-ready, fully-typed, multi-tenant SaaS boilerplate built with **Hono.js** and **React**, designed for deployment on **Cloudflare Workers**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.6-orange?logo=hono)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Playwright](https://img.shields.io/badge/Playwright-1.57-green?logo=playwright)](https://playwright.dev/)
[![Coverage](https://img.shields.io/badge/Coverage-94%25-brightgreen)](/)

---

## Overview

This boilerplate provides everything you need to build a modern, secure, and scalable SaaS application:

- **Multi-tenant architecture** with role-based access control
- **Gateway-backed OAuth** via `@etus/auth` and `ag.etus.io`
- **Team collaboration** with email invitations
- **Comprehensive audit logging** for compliance
- **Full-stack type safety** from database to frontend
- **363+ E2E tests** covering all critical paths
- **94%+ test coverage** across all layers

---

## Features

### Authentication & Authorization
- OAuth flow owned by `@etus/auth` through the ETUS auth gateway
- Session-based authentication via Cloudflare KV and D1 session references
- HTTP-only cookies with `SameSite=Lax` and `Secure` on HTTPS
- Product RBAC catalog: `owner`, `admin`, `member`, `guest`
- Multi-tenant account context resolved by `auth.accountMiddleware()`
- Session fingerprint validation using client IP and user-agent metadata

### Multi-Tenant Architecture
- Workspaces/Organizations (Accounts)
- Users can belong to multiple accounts
- Fine-grained permissions per account
- Invitation system with email notifications

### Developer Experience
- Full TypeScript with strict mode
- Auto-generated OpenAPI documentation
- Request context tracking (transactionId, IP, userAgent)
- Comprehensive error handling
- Hot module replacement in development

### Security
- Rate limiting middleware (in-memory with lazy cleanup)
- CSRF protection for cookie-authenticated mutations
- Strict credentialed CORS allowlist
- XSS defense-in-depth with CSP, nonced scripts, and secure headers
- JSON payload limits for state-changing API calls
- SQL injection protection via parameterized queries

### Testing
- Unit tests with Vitest (94%+ coverage)
- Integration tests for D1/KV/R2 wiring and auth schema constraints
- E2E tests with Playwright (363+ tests)
- Visual regression testing
- Accessibility testing (WCAG compliance)
- Mobile device emulation
- Production testing with OAuth session capture

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Cloudflare Workers |
| **Backend** | Hono.js 4.6 |
| **Frontend** | React 19 + TanStack Router |
| **Database** | Cloudflare D1 (SQLite) |
| **Data Access** | SQL helpers (D1) |
| **Sessions** | Cloudflare KV |
| **Storage** | Cloudflare R2 |
| **Styling** | Tailwind CSS 4.0 |
| **Validation** | Zod |
| **Testing** | Vitest + Playwright |
| **Email** | SendGrid |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended), npm, or yarn
- Cloudflare account (for deployment)
- ETUS auth gateway client (`ETUS_CLIENT_ID` and `ETUS_CLIENT_SECRET`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hono-boilerplate.git
cd hono-boilerplate

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Apply database schema
pnpm db:schema:local

# Seed test data (optional)
pnpm db:seed:local

# Start development server
pnpm dev
```

The application will be available at `http://localhost:8787`

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# ETUS Auth (OAuth Gateway via @etus/auth)
ETUS_GATEWAY=https://ag.etus.io
ETUS_CLIENT_ID=your-client-id-from-npx-etus-auth-init
ETUS_CLIENT_SECRET=your-client-secret-from-npx-etus-auth-init
ETUS_ALLOWED_DOMAINS=yourdomain.com,anotherdomain.com
ETUS_ADMIN_EMAILS=admin@yourdomain.com

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Application
APP_URL=http://localhost:8787
CORS_ORIGINS=http://localhost:3000,http://localhost:8787
LOG_LEVEL=info
```

---

## Project Structure

```
├── config/                     # Configuration files
│   ├── eslint.config.js        # ESLint configuration
│   ├── wrangler.json           # Cloudflare Workers config
│   └── ...
│
├── src/
│   ├── server/                 # Backend (Hono.js)
│   │   ├── routes/             # API endpoints
│   │   │   ├── health/         # Health checks
│   │   │   └── storage/        # App-owned API protected by @etus/auth
│   │   ├── middleware/         # Request middleware
│   │   ├── db/                 # Database (SQL helpers)
│   │   │   ├── client.ts       # D1 client wrapper
│   │   │   ├── records.ts      # Record typings (SQL results)
│   │   │   ├── sql.ts          # Query helpers (queryOne/queryAll/execute)
│   │   │   └── seed.ts         # Seed generator (seed.sql)
│   │   ├── auth/               # @etus/auth setup, RBAC matrix, guards
│   │   └── lib/                # Utilities
│   │
│   ├── client/                 # Frontend (React)
│   │   ├── routes/             # File-based routing
│   │   │   ├── _authenticated/ # Protected pages
│   │   │   └── ...
│   │   ├── components/         # UI components
│   │   │   ├── ui/             # Base components
│   │   │   └── layout/         # Layout components
│   │   ├── hooks/              # React hooks
│   │   └── lib/                # Client utilities
│   │
│   └── shared/                 # Shared code
│       ├── schemas/            # Zod validation
│       └── types/              # TypeScript types
│
├── tests/                      # All tests
│   ├── e2e/                    # End-to-end tests (Playwright)
│   │   ├── crud/               # CRUD operations
│   │   ├── journeys/           # User journeys
│   │   ├── api/                # API tests
│   │   ├── a11y/               # Accessibility
│   │   ├── mobile/             # Mobile responsive
│   │   ├── visual/             # Visual regression
│   │   ├── .auth/              # Auth state files
│   │   └── auth.setup.ts       # Auth setup
│   │
│   └── integration/            # Integration tests
│       ├── auth/               # Auth tests
│       ├── accounts/           # Account tests
│       ├── users/              # User tests
│       ├── security/           # Security tests
│       └── ...
│
├── scripts/                    # Utility scripts
│   └── capture-prod-session.ts # OAuth session capture
│
├── docs/                       # Documentation
│   └── testing.md              # Testing guide
│
├── schema.sql                  # D1 schema (source of truth)
└── seed.sql                    # Generated seed data
```

---

## Documentation

- `docs/app_spec.txt` - Canonical app specification and architecture overview
- `docs/architecture/README.md` - Architecture docs index
- `docs/security.md` - Current auth and browser security baseline
- `docs/testing.md` - Testing guide

---

## Internal CLI (BHono)

Use the internal CLI to scaffold new apps:

```bash
# Recommended (no global install)
pnpm dlx @etus/bhono-app <project-name>

# npm shortcut (uses create-bhono-app)
npm init bhono-app <project-name>
```

If the CLI cannot find local templates, it will clone the default Bhono template repo. You can override this by setting `BHONO_TEMPLATE_REPO` (or `ETUS_TEMPLATE_REPO`) to a git URL.

---

## Database Schema

### Core Tables

```sql
-- Users provisioned by @etus/auth after OAuth callback
auth_users (
  id TEXT PRIMARY KEY,
  gateway_user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'guest',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT,
  created_at TEXT,
  last_login_at TEXT
)

-- Session references for listing/revocation; full session payload lives in KV
auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  last_active_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER
)

-- Accounts and memberships for multi-tenant workspaces
auth_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
)

auth_memberships (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by TEXT,
  invited_at TEXT,
  joined_at TEXT,
  created_at TEXT,
  UNIQUE(account_id, user_id)
)

-- Invitations and audit logs
auth_invitations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  invited_by TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT
)

auth_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  target_id TEXT,
  target_type TEXT,
  account_id TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT
)
```

### Database Schema

```bash
# Apply schema.sql locally
pnpm db:schema:local

# Apply schema.sql to production (optional)
pnpm db:schema:remote

# Generate + seed locally
pnpm db:seed:local

# Full reset (schema + seed)
pnpm db:reset:local

# Generate Cloudflare types
pnpm cf-typegen
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/login` | Start ETUS gateway OAuth flow |
| `GET` | `/auth/callback` | OAuth callback handled by `@etus/auth` |
| `POST` | `/auth/logout` | Destroy session and clear cookie |
| `GET` | `/auth/me` | Get current user/session context |
| `POST` | `/auth/test-login` | Localhost-only dev/E2E session helper |

### Admin Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/admin/users` | List users |
| `GET` | `/auth/admin/users/:id` | Get user by ID |
| `POST` | `/auth/admin/users/invite` | Invite a user |
| `POST` | `/auth/admin/users/:id/approve` | Approve pending user |
| `POST` | `/auth/admin/users/:id/deny` | Deny pending user |
| `PATCH` | `/auth/admin/users/:id` | Update user role/status |
| `DELETE` | `/auth/admin/users/:id` | Delete user and invalidate sessions |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/accounts` | List current user's accounts |
| `POST` | `/accounts` | Create account |
| `GET` | `/accounts/:id` | Get account and membership |
| `PATCH` | `/accounts/:id` | Update account |
| `DELETE` | `/accounts/:id` | Delete account |
| `GET` | `/accounts/:id/members` | List members |
| `POST` | `/accounts/:id/members/invite` | Invite member |
| `PATCH` | `/accounts/:id/members/:userId` | Update member role |
| `DELETE` | `/accounts/:id/members/:userId` | Remove member |

### Invitations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/invitations/:token` | Read invitation details |
| `POST` | `/invitations/:token/accept` | Accept invitation |

### Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/audit/logs` | Query audit logs (admin-only) |

### App API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/storage/upload-url` | Generate an upload URL |
| `PUT` | `/api/storage/upload/:key` | Upload a file to R2 |
| `GET` | `/api/storage/files/:key` | Get a file |
| `DELETE` | `/api/storage/files/:key` | Delete a file |

### Documentation

| Endpoint | Description |
|----------|-------------|
| `/api/doc` | OpenAPI 3.0 JSON |
| `/api/swagger` | Swagger UI |

---

## Testing

### Test Coverage

| Layer | Statements | Branches | Functions | Lines |
|-------|------------|----------|-----------|-------|
| **Server Unit** | 94.50% | 85.98% | 96.15% | 94.74% |
| **Integration** | Diagnostic | Diagnostic | Diagnostic | Behavioral |
| **Client Unit** | 90.82% | 87.82% | 96.87% | 91.97% |
| **E2E** | 363 tests | - | - | 100% pass |

### Unit Tests

```bash
# Run server tests in watch mode
pnpm test

# Run server tests once with coverage
pnpm test:unit:server

# Run client tests with coverage
pnpm test:unit:client

# Run all unit tests
pnpm test:unit
```

### Integration Tests

```bash
# Run integration tests
pnpm test:integration

# Run integration tests in watch mode
pnpm test:integration:watch
```

### End-to-End Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui

# Visible browser
pnpm test:e2e:headed

# Debug mode
pnpm test:e2e:debug

# View HTML report
pnpm test:e2e:report

# Run specific tests by tag
npx playwright test --grep "@smoke"
npx playwright test --grep "@critical"
npx playwright test --grep "@visual"
npx playwright test --grep "@a11y"
```

### Production Testing

Test against the live production deployment with OAuth authentication:

```bash
# Step 1: Capture OAuth session (opens browser for manual login)
pnpm test:e2e:prod:auth

# Step 2: Run tests against production
pnpm test:e2e:prod

# Or with custom URL
BASE_URL=https://your-app.workers.dev pnpm test:e2e
```

### Test Categories

| Tag | Description |
|-----|-------------|
| `@smoke` | Basic smoke tests |
| `@critical` | Critical paths (all browsers) |
| `@crud` | CRUD operations |
| `@mobile` | Mobile responsive |
| `@visual` | Visual regression |
| `@a11y` | Accessibility |
| `@api` | API integration |

---

## Deployment

### Cloudflare Workers

```bash
# Build the application
pnpm build

# Deploy to Cloudflare
wrangler deploy --config config/wrangler.json
```

### Cloudflare Configuration (`config/wrangler.json`)

```json
{
  "name": "hono-boilerplate",
  "main": "../src/server/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "boilerplate-db"
  }],
  "r2_buckets": [{
    "binding": "R2_BUCKET",
    "bucket_name": "boilerplate-storage"
  }],
  "kv_namespaces": [{
    "binding": "SESSIONS",
    "id": "your-kv-namespace-id"
  }],
  "assets": {
    "directory": "../dist",
    "run_worker_first": ["/api/*", "/auth/*"]
  }
}
```

### Required Cloudflare Resources

1. **D1 Database**: Create via Cloudflare dashboard or CLI
2. **R2 Bucket**: For file storage
3. **KV Namespace**: For session management

```bash
# Create D1 database
wrangler d1 create boilerplate-db

# Create R2 bucket
wrangler r2 bucket create boilerplate-storage

# Create KV namespace
wrangler kv:namespace create SESSIONS
```

---

## Architecture

### Request Flow

```
Client (React SPA)
        │
        ▼
   Fetch API (cookies)
        │
        ▼
┌───────────────────────────────────┐
│         Cloudflare Worker         │
│                                   │
│  ┌─────────────────────────────┐  │
│  │      Middleware Stack       │  │
│  │  - Error Handler            │  │
│  │  - Request Context          │  │
│  │  - Request Logger           │  │
│  │  - CORS                     │  │
│  │  - Security Headers         │  │
│  │  - Rate Limiting            │  │
│  │  - CSRF / Origin Checks     │  │
│  │  - JSON Body Limit          │  │
│  │  - Session Auth             │  │
│  │  - Account Context          │  │
│  └─────────────────────────────┘  │
│              │                    │
│              ▼                    │
│  ┌─────────────────────────────┐  │
│  │      Route Handler          │  │
│  │  (Zod validation)           │  │
│  └─────────────────────────────┘  │
│              │                    │
│              ▼                    │
│  ┌─────────────────────────────┐  │
│  │      Service Layer          │  │
│  │  (Business logic)           │  │
│  └─────────────────────────────┘  │
│              │                    │
│              ▼                    │
│  ┌─────────────────────────────┐  │
│  │      SQL Helpers            │  │
│  └─────────────────────────────┘  │
│              │                    │
└──────────────┼────────────────────┘
               ▼
        ┌──────────────┐
        │  D1 Database │
        └──────────────┘
```

### Path Aliases

```typescript
import { Button } from '@/components/ui/button'      // Client
import { userSchema } from '@shared/schemas'          // Shared
import { createUser } from '@server/services/users'  // Server
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript checks |
| **Database** | |
| `pnpm db:schema:local` | Apply schema.sql locally |
| `pnpm db:schema:remote` | Apply schema.sql remotely |
| `pnpm db:seed` | Generate seed.sql |
| `pnpm db:seed:local` | Generate + seed locally |
| `pnpm db:reset:local` | Apply schema + seed locally |
| `pnpm cf-typegen` | Generate Cloudflare types |
| **API** | |
| `pnpm api:spec` | Generate OpenAPI spec (docs/openapi.json) |
| `pnpm api:types` | Generate TypeScript types from OpenAPI |
| **Testing** | |
| `pnpm test` | Run backend unit tests (watch) |
| `pnpm test:unit:server` | Backend tests with coverage |
| `pnpm test:unit:client` | Frontend tests with coverage |
| `pnpm test:integration` | Integration tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm test:e2e:ui` | E2E interactive mode |
| `pnpm test:e2e:prod` | E2E against production |
| `pnpm test:e2e:prod:auth` | Capture OAuth session |
| **Deployment** | |
| `wrangler deploy --config config/wrangler.json` | Deploy to Cloudflare |

---

## Security

### Built-in Protections

- **Session Auth**: `@etus/auth` issues HTTP-only cookies backed by KV sessions and D1 session references
- **CSRF**: mutating requests require a trusted `Origin`/`Referer` plus `X-CSRF-Token` or `X-Requested-With`
- **CORS**: credentialed CORS uses explicit origins from `APP_URL` and `CORS_ORIGINS`; wildcard origins are rejected in production
- **XSS**: React escaping, no client-side raw HTML sinks, CSP with nonced scripts, `frame-ancestors 'none'`, `nosniff`, and referrer policy
- **Session Hijacking**: secure cookie flags on HTTPS and session fingerprint validation
- **SQL Injection**: Parameterized queries via SQL helpers
- **Rate Limiting**: In-memory store with configurable limits per route
- **Payload DoS**: JSON API bodies are capped before route parsing while direct R2 uploads stay route-scoped
- **Frontend Secrets**: client guardrails reject auth token storage, dangerous DOM sinks, and non-public env exposure

### Audit Logging

Auth, user lifecycle, account, membership, invitation and session events are logged by `@etus/auth` when `audit.enabled=true`:

```typescript
{
  type: 'auth.login' | 'auth.logout' | 'user.updated' | 'account.invitation_sent',
  actorId: string | null,
  actorEmail: string | null,
  targetId: string | null,
  targetType: 'user' | 'account' | 'invitation' | 'session',
  accountId: string | null,
  metadata: Record<string, unknown>,
  createdAt: string
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Quality

- Run `pnpm lint` before committing
- Ensure all tests pass: `pnpm test:unit && pnpm test:integration && pnpm test:e2e`
- Maintain unit coverage thresholds (server and client gates)
- Follow existing code patterns

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Hono.js](https://hono.dev/) - Ultrafast web framework
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless SQLite
- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Playwright](https://playwright.dev/) - E2E testing framework
