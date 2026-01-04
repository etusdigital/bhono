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
- **Google OAuth authentication** with session management
- **Team collaboration** with email invitations
- **Comprehensive audit logging** for compliance
- **Full-stack type safety** from database to frontend
- **363+ E2E tests** covering all critical paths
- **94%+ test coverage** across all layers

---

## Features

### Authentication & Authorization
- Google OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Session-based authentication via Cloudflare KV
- Secure httpOnly cookies with SameSite protection
- Role-based access control: `ADMIN`, `EDITOR`, `VIEWER`
- Token refresh mechanism
- User-agent fingerprint validation

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
- CSRF protection via SameSite cookies
- XSS prevention with secure headers
- SQL injection protection via parameterized queries

### Testing
- Unit tests with Vitest (94%+ coverage)
- Integration tests (93%+ coverage)
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
- Google Cloud Console project (for OAuth)

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

The application will be available at `http://localhost:5173`

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRY_MINUTES=15
REFRESH_TOKEN_EXPIRY_DAYS=30

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Application
APP_URL=http://localhost:3000
CORS_ORIGINS=*
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
│   │   │   ├── auth/           # Authentication
│   │   │   ├── users/          # User CRUD
│   │   │   ├── accounts/       # Multi-tenant accounts
│   │   │   ├── invitations/    # Team invitations
│   │   │   ├── audits/         # Audit logs
│   │   │   └── storage/        # File storage (R2)
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Request middleware
│   │   ├── db/                 # Database (SQL helpers)
│   │   │   ├── client.ts       # D1 client wrapper
│   │   │   ├── records.ts      # Record typings (SQL results)
│   │   │   ├── sql.ts          # Query helpers (queryOne/queryAll/execute)
│   │   │   └── seed.ts         # Seed generator (seed.sql)
│   │   ├── auth/               # Roles, permissions, guards
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
-- Users
users (
  id UUID PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
)

-- Accounts (Workspaces/Organizations)
accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT UNIQUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
)

-- User-Account Mapping with Roles
user_accounts (
  user_id UUID REFERENCES users(id),
  account_id UUID REFERENCES accounts(id),
  role TEXT CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  PRIMARY KEY (user_id, account_id)
)

-- Audit Logs
audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  account_id UUID,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP
)

-- Invitations
invitations (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  account_id UUID,
  invited_by UUID,
  token TEXT UNIQUE,
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP
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
| `GET` | `/auth/login` | Initiate Google OAuth |
| `GET` | `/auth/callback` | OAuth callback |
| `POST` | `/auth/logout` | Destroy session |
| `GET` | `/auth/me` | Get current user |
| `POST` | `/auth/refresh` | Refresh token |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List users (paginated) |
| `POST` | `/api/users` | Create user |
| `GET` | `/api/users/:id` | Get user by ID |
| `PATCH` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/accounts` | List accounts |
| `POST` | `/api/accounts` | Create account |
| `GET` | `/api/accounts/:id` | Get account |
| `PATCH` | `/api/accounts/:id` | Update account |
| `GET` | `/api/accounts/:id/members` | List members |
| `POST` | `/api/accounts/:id/members` | Add member |
| `DELETE` | `/api/accounts/:id/members/:userId` | Remove member |

### Invitations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/invitations` | List invitations |
| `POST` | `/api/invitations` | Send invitation |
| `POST` | `/api/invitations/:id/accept` | Accept invitation |
| `POST` | `/api/invitations/:id/cancel` | Cancel invitation |

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
| **Integration** | 93.19% | 84.88% | 92.48% | 93.51% |
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

- **CSRF**: SameSite cookies + CORS validation
- **XSS**: Secure headers + React's built-in escaping
- **Session Hijacking**: httpOnly cookies, secure flag in production
- **SQL Injection**: Parameterized queries via SQL helpers
- **Rate Limiting**: In-memory store with configurable limits per route
- **Fingerprint Validation**: User-agent validation for sessions

### Audit Logging

All state-changing operations are logged:

```typescript
{
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT',
  resourceType: 'user' | 'account' | 'invitation',
  resourceId: string,
  changes: { before: any, after: any },
  ipAddress: string,
  userAgent: string,
  transactionId: string,
  createdAt: timestamp
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
- Maintain coverage thresholds (90%+ for server, 85%+ for client)
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
