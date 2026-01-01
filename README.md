# Hono Boilerplate

A production-ready, fully-typed, multi-tenant SaaS boilerplate built with **Hono.js** and **React**, designed for deployment on **Cloudflare Workers**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.6-orange?logo=hono)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Playwright](https://img.shields.io/badge/Playwright-1.57-green?logo=playwright)](https://playwright.dev/)

---

## Overview

This boilerplate provides everything you need to build a modern, secure, and scalable SaaS application:

- **Multi-tenant architecture** with role-based access control
- **Google OAuth authentication** with session management
- **Team collaboration** with email invitations
- **Comprehensive audit logging** for compliance
- **Full-stack type safety** from database to frontend
- **130+ E2E tests** covering all critical paths

---

## Features

### Authentication & Authorization
- Google OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Session-based authentication via Cloudflare KV
- Secure httpOnly cookies with SameSite protection
- Role-based access control: `ADMIN`, `EDITOR`, `VIEWER`
- Token refresh mechanism

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

### Testing
- Unit tests with Vitest (90%+ coverage)
- E2E tests with Playwright
- Visual regression testing
- Accessibility testing (WCAG compliance)
- Mobile device emulation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Cloudflare Workers |
| **Backend** | Hono.js 4.6 |
| **Frontend** | React 19 + TanStack Router |
| **Database** | Cloudflare D1 (SQLite) |
| **ORM** | Drizzle ORM |
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
- pnpm, npm, or yarn
- Cloudflare account (for deployment)
- Google Cloud Console project (for OAuth)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hono-boilerplate.git
cd hono-boilerplate

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Apply database migrations
npm run db:migrate:local

# Seed test data (optional)
npm run db:seed

# Start development server
npm run dev
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
src/
├── server/                 # Backend (Hono.js)
│   ├── routes/             # API endpoints
│   │   ├── auth/           # Authentication
│   │   ├── users/          # User CRUD
│   │   ├── accounts/       # Multi-tenant accounts
│   │   ├── invitations/    # Team invitations
│   │   ├── audits/         # Audit logs
│   │   └── storage/        # File storage (R2)
│   ├── services/           # Business logic
│   ├── middleware/         # Request middleware
│   ├── db/                 # Database (Drizzle ORM)
│   │   ├── schema/         # Table definitions
│   │   └── migrations/     # SQL migrations
│   └── lib/                # Utilities
│
├── client/                 # Frontend (React)
│   ├── routes/             # File-based routing
│   │   ├── _authenticated/ # Protected pages
│   │   └── ...
│   ├── components/         # UI components
│   │   ├── ui/             # Base components
│   │   └── layout/         # Layout components
│   ├── hooks/              # React hooks
│   └── lib/                # Client utilities
│
├── shared/                 # Shared code
│   ├── schemas/            # Zod validation
│   └── types/              # TypeScript types
│
└── e2e/                    # End-to-end tests
    ├── crud/               # CRUD operations
    ├── journeys/           # User journeys
    ├── api/                # API tests
    ├── a11y/               # Accessibility
    ├── mobile/             # Mobile responsive
    └── visual/             # Visual regression
```

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

### Migrations

```bash
# Apply migrations locally
npm run db:migrate:local

# Apply migrations to production
npm run db:migrate:remote

# Generate Cloudflare types
npm run cf-typegen
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

### Unit Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Frontend tests
npm run test:client
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Interactive mode
npm run test:e2e:ui

# Visible browser
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Run specific tests
npx playwright test --grep "@smoke"
npx playwright test --grep "@critical"
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

### Coverage Thresholds

| Area | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| Backend | 90% | 85% | 85% | 90% |
| Frontend | 85% | 70% | 60% | 85% |
| Shared | 95% | 95% | 95% | 95% |

---

## Deployment

### Cloudflare Workers

```bash
# Build the application
npm run build

# Deploy to Cloudflare
npm run deploy
```

### Cloudflare Configuration (`wrangler.json`)

```json
{
  "name": "hono-boilerplate",
  "main": "./src/server/index.ts",
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
    "directory": "./dist/client",
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
│  │      Drizzle ORM            │  │
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
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run db:migrate:local` | Apply local migrations |
| `npm run db:migrate:remote` | Apply remote migrations |
| `npm run db:seed` | Seed database |
| `npm run cf-typegen` | Generate Cloudflare types |
| `npm test` | Run backend tests |
| `npm run test:client` | Run frontend tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |

---

## Security

### Built-in Protections

- **CSRF**: SameSite cookies + CORS validation
- **XSS**: Secure headers + React's built-in escaping
- **Session Hijacking**: httpOnly cookies, secure flag in production
- **SQL Injection**: Parameterized queries via Drizzle ORM
- **Rate Limiting**: Configurable per route (not implemented by default)

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

- Run `npm run lint` before committing
- Ensure all tests pass: `npm test && npm run test:e2e`
- Maintain coverage thresholds
- Follow existing code patterns

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Hono.js](https://hono.dev/) - Ultrafast web framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
