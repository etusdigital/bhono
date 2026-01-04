# Architecture Documentation - BHono

> Production-ready multi-tenant SaaS boilerplate with Hono.js backend and React frontend, deployed on Cloudflare Workers.

## Executive Summary

| Attribute | Value | Confidence |
|-----------|-------|------------|
| **Architecture Type** | Full-Stack Monolith (Single Deploy) | HIGH |
| **Deployment** | Cloudflare Workers (Edge Computing) | HIGH |
| **Backend** | Hono.js 4.x with OpenAPI | HIGH |
| **Frontend** | React 19 + TanStack Router | HIGH |
| **Database** | Cloudflare D1 (SQLite at Edge) | HIGH |
| **Sessions** | Cloudflare KV | HIGH |
| **Storage** | Cloudflare R2 | HIGH |
| **Auth** | Google OAuth 2.0 + Session Cookies | HIGH |
| **Multi-tenancy** | Account-based with RBAC | HIGH |

### Key Characteristics

- **Edge-first**: Entire stack runs at Cloudflare's edge, ~50ms latency globally
- **Multi-tenant**: Users belong to multiple Accounts with role-based permissions
- **Type-safe**: Full TypeScript with Zod validation on both client and server
- **API-first**: OpenAPI 3.0 spec with Swagger UI
- **Test coverage**: 94%+ server, 90%+ client, 363+ E2E tests

## Architecture Indicators Detected

| Indicator | Found | Location |
|-----------|-------|----------|
| Single Dockerfile | N/A | Serverless deployment |
| `wrangler.json` | YES | `config/wrangler.json` |
| D1 Database | YES | `config/wrangler.json:d1_databases` |
| KV Sessions | YES | `config/wrangler.json:kv_namespaces` |
| R2 Storage | YES | `config/wrangler.json:r2_buckets` |
| React SPA | YES | `src/client/*` |
| TanStack Router | YES | `src/client/routes/*` |
| Hono.js Backend | YES | `src/server/*` |
| OpenAPI/Swagger | YES | `src/server/routes/openapi.ts` |
| Multi-tenancy | YES | `src/server/auth/guards.ts` |

## Document Index

| Document | Description | Status |
|----------|-------------|--------|
| [c4-context.md](./c4-context.md) | C4 Level 1 - System Context | Complete |
| [c4-container.md](./c4-container.md) | C4 Level 2 - Containers | Complete |
| [c4-component.md](./c4-component.md) | C4 Level 3 - Components | Complete |
| [erd.md](./erd.md) | Entity Relationship Diagram | Complete |
| [api-catalog.md](./api-catalog.md) | REST API Endpoints | Complete |
| [dependencies.md](./dependencies.md) | Module Dependency Map | Complete |
| [tech-debt.md](./tech-debt.md) | Technical Debt Register | Complete |
| [data-requirements.md](./data-requirements.md) | Data Requirements Document | Legacy |
| [db-bootstrap.md](./db-bootstrap.md) | Database Bootstrap Guide | Legacy |
| [sql-standards.md](./sql-standards.md) | SQL Standards Guide | Legacy |

## Technology Stack

### Runtime & Infrastructure

| Component | Technology | Version | Confidence |
|-----------|------------|---------|------------|
| Runtime | Cloudflare Workers | - | HIGH |
| Database | Cloudflare D1 (SQLite) | - | HIGH |
| Session Store | Cloudflare KV | - | HIGH |
| File Storage | Cloudflare R2 | - | HIGH |
| CDN/Edge | Cloudflare | - | HIGH |

### Backend

| Component | Technology | Version | Confidence |
|-----------|------------|---------|------------|
| Framework | Hono.js | 4.11.x | HIGH |
| API Docs | @hono/zod-openapi | 1.2.x | HIGH |
| Swagger UI | @hono/swagger-ui | 0.5.x | HIGH |
| Validation | Zod | 4.3.x | HIGH |
| UUID | uuidv7 | 1.1.x | HIGH |

### Frontend

| Component | Technology | Version | Confidence |
|-----------|------------|---------|------------|
| UI Library | React | 19.2.x | HIGH |
| Routing | TanStack Router | 1.144.x | HIGH |
| Data Fetching | TanStack Query | 5.90.x | HIGH |
| Forms | React Hook Form | 7.70.x | HIGH |
| Styling | Tailwind CSS | 4.1.x | HIGH |
| UI Components | Radix UI | 1.x | HIGH |
| Icons | Lucide React | 0.562.x | HIGH |
| Toasts | Sonner | 2.0.x | HIGH |

### Testing

| Component | Technology | Version | Confidence |
|-----------|------------|---------|------------|
| Unit/Integration | Vitest | 4.0.x | HIGH |
| E2E | Playwright | 1.57.x | HIGH |
| Coverage | V8/Istanbul | - | HIGH |
| Browser Testing | Vitest Browser | 4.0.x | HIGH |

### DevOps

| Component | Technology | Version | Confidence |
|-----------|------------|---------|------------|
| Bundler | Vite | 7.3.x | HIGH |
| Wrangler | Wrangler | 4.54.x | HIGH |
| Linting | ESLint | 9.x | HIGH |
| Commit Lint | Commitlint | 20.x | HIGH |
| Changesets | @changesets/cli | 2.29.x | HIGH |
| Git Hooks | Husky | 9.x | HIGH |

## Security Assessment

| Area | Implementation | Confidence |
|------|----------------|------------|
| **Authentication** | Google OAuth 2.0 + Session Cookies | HIGH |
| **Authorization** | RBAC (7 roles) with Guards | HIGH |
| **Session Management** | KV-backed, httpOnly cookies | HIGH |
| **Token Security** | SHA-256 hashed refresh tokens | HIGH |
| **CSRF Protection** | SameSite=Strict cookies | HIGH |
| **Rate Limiting** | In-memory with lazy cleanup | HIGH |
| **Audit Logging** | All state changes logged | HIGH |
| **Soft Delete** | Users/Accounts retain data | HIGH |

## Project Structure Overview

```
├── config/                     # Configuration files
│   └── wrangler.json           # Cloudflare Workers config
├── src/
│   ├── server/                 # Hono.js Backend
│   │   ├── routes/             # API endpoints (OpenAPI)
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Request middleware
│   │   ├── auth/               # RBAC system
│   │   ├── db/                 # D1 database layer
│   │   └── lib/                # Utilities
│   ├── client/                 # React Frontend
│   │   ├── routes/             # TanStack file-based routing
│   │   ├── components/         # UI components
│   │   └── hooks/              # React hooks
│   └── shared/                 # Shared code
│       ├── schemas/            # Zod validation
│       └── types/              # TypeScript types
├── tests/                      # Centralized tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # Playwright E2E
└── packages/                   # Monorepo packages
    └── bhono-app/              # CLI scaffolding tool
```

## Quick Links

- **OpenAPI Spec**: `/api/doc`
- **Swagger UI**: `/api/swagger`
- **Health Check**: `/health`
- **Readiness Probe**: `/health/ready`
- **Liveness Probe**: `/health/live`

## Related Documentation

- `docs/app_spec.txt` - Canonical application specification
- `docs/testing.md` - Testing strategy and guidelines
- `CLAUDE.md` - AI assistant context file
