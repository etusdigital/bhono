---
title: Migrate Auth to @etus/auth
type: refactor
date: 2026-02-03
deepened: 2026-02-03
status: superseded
superseded_by: docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md
superseded_on: 2026-05-19
superseded_reason: |
  Plano escrito quando @etus/auth era mais limitado. A v0.4.1 (atual) entrega RBAC,
  permissions com wildcards, multi-tenant, audit e invitations built-in.
  Conclusões deste plano (manter custom ou hibridizar) não se aplicam mais.
  Ver requirements doc atualizado em docs/ets/brainstorms/.
---

> ⚠️ **SUPERSEDED 2026-05-19** — Este plano foi escrito assumindo um `@etus/auth` mais limitado.
> A versão atual (v0.4.1) muda as premissas fundamentais.
> **Use o requirements doc atualizado**: [`docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md`](../ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md)

# Migrate Auth to @etus/auth

## Enhancement Summary

**Deepened on:** 2026-02-03
**Research agents used:** Security Sentinel, Architecture Strategist, Data Migration Expert, Performance Oracle, Best Practices (x2), TypeScript Reviewer, Simplicity Reviewer

### Critical Findings

| Finding | Severity | Action Required |
|---------|----------|-----------------|
| Session fingerprinting removed | 🔴 HIGH | Implement custom fingerprint middleware |
| MANAGER→admin privilege escalation | 🔴 HIGH | Review case-by-case before migration |
| SQL ignores user_accounts.role | 🔴 CRITICAL | Rewrite migration script |
| Multi-tenant RBAC destroyed | 🔴 CRITICAL | Keep user_accounts table |
| 27 permissions never used | 🟡 MEDIUM | Delete before migration |
| jwtAuth legacy code | 🟡 MEDIUM | Delete before migration |

### Recommended Approach: HYBRID

**Use @etus/auth for authentication only, keep local authorization system.**

```typescript
// Hybrid: Package handles OAuth/sessions, local code handles RBAC
app.route("/auth", auth.routes());        // @etus/auth: OAuth flow
app.use("/api/*", auth.middleware());     // @etus/auth: Session validation
app.use("/api/*", accountMiddleware());   // LOCAL: Multi-tenant context
app.use("/api/*", requireRole('EDITOR')); // LOCAL: RBAC guards
```

### Alternative: Cancel Migration

The Simplicity Reviewer found:
- 27 granular permissions are **never used** (delete `permissions.ts`)
- `jwtAuth` middleware is marked legacy but still maintained (delete it)
- 5 role utility functions are never imported (delete them)

**Simplifying current code removes ~340 LOC without losing features or adding dependencies.**

---

## Overview

Migrate the boilerplate's custom authentication system to use the `@etus/auth` package, which provides OAuth via a centralized gateway, session management, and user provisioning.

## Problem Statement / Motivation

The boilerplate currently has ~12 files implementing auth from scratch. Using `@etus/auth`:
- Centralizes OAuth through `ag.etus.io` gateway
- Reduces maintenance burden
- Provides consistent auth UX across ETUS tools
- Simplifies onboarding for new projects

## Proposed Solution

Replace custom auth implementation with `@etus/auth` while:
1. Keeping multi-tenant `accountMiddleware` (not in @etus/auth)
2. Simplifying RBAC from 7 hierarchical roles to 3 simple roles
3. Removing granular permissions (not supported by @etus/auth)
4. Integrating audit logging via hooks

## Technical Considerations

### Breaking Changes

| Current | After Migration |
|---------|-----------------|
| 7 roles (ADMIN, MANAGER, EDITOR, AUTHOR, VIEWER, BILLING, ANALYTICS) | 3 roles (admin, editor, viewer) |
| 27 granular permissions | Role-based only |
| Direct Google OAuth | Gateway-proxied OAuth |
| Session fingerprinting (IP+UA) | No fingerprinting |
| `users` + `user_accounts` tables | `auth_users` + `auth_sessions` (auto-created) |

### Database Migration

Option A: **Fresh start** - Let @etus/auth create new tables, migrate users manually
Option B: **Map tables** - Point @etus/auth to existing tables (requires schema match)

**Recommendation:** Option A for clean break. Run migration script to copy active users.

### Multi-Tenant Strategy

@etus/auth doesn't support Accounts. Strategy:

```typescript
// Keep accountMiddleware separate
app.route("/auth", auth.routes());
app.use("/api/*", auth.middleware());
app.use("/api/*", accountMiddleware()); // Our custom middleware
```

## Acceptance Criteria

- [ ] Install and configure @etus/auth with gateway
- [ ] Remove 12 auth files from boilerplate
- [ ] Update all imports of `requireRole`, `Role`, etc.
- [ ] Keep `accountMiddleware` for multi-tenant support
- [ ] Migrate existing users to new schema
- [ ] Update frontend `useAuth` hook
- [ ] Update E2E tests (no more `/auth/test-login`)
- [ ] Document role mapping (MANAGER → admin, EDITOR → editor, etc.)

## Implementation Phases

### Phase 1: Setup @etus/auth

**Files to create/modify:**

```typescript
// src/server/auth.ts (NEW)
import { createAuth } from "@etus/auth";

export const auth = createAuth({
  gateway: "https://ag.etus.io",
  clientId: process.env.AUTH_CLIENT_ID!,
  clientSecret: process.env.AUTH_CLIENT_SECRET,
  db: (env) => env.DB,
  sessions: (env) => env.SESSIONS,
  access: {
    mode: "open",
    allowedDomains: ["brius.com.br", "etus.com.br"],
    admins: ["admin@brius.com.br"],
    roles: ["admin", "editor", "viewer"],
    defaultRole: "viewer",
  },
  onNewUser: async (user) => {
    // Integrate with existing audit logging
    await logAuthEvent(/* ... */);
  },
  onLogin: async (user) => {
    await logAuthEvent(/* ... */);
  },
});
```

### Phase 2: Remove Old Auth Files

**Delete these files:**

```
src/server/auth/roles.ts
src/server/auth/permissions.ts
src/server/auth/guards.ts
src/server/auth/index.ts
src/server/lib/oauth.ts
src/server/lib/session.ts
src/server/lib/tokens.ts
src/server/services/auth.ts
src/server/routes/auth/handlers.ts
src/server/routes/auth/routes.ts
src/server/routes/auth/schemas.ts
src/server/routes/auth/test-login.ts
src/server/routes/auth/index.ts
src/server/types/auth.ts
```

### Phase 3: Update Route Files

**Files to modify:**

| File | Change |
|------|--------|
| `src/server/index.ts` | Mount `auth.routes()`, remove sessionMiddleware import |
| `src/server/routes/index.ts` | Use `auth.middleware()` instead of `sessionAuth` |
| `src/server/routes/users/index.ts` | Import `requireRole` from `@etus/auth` or our wrapper |
| `src/server/routes/accounts/index.ts` | Same |
| `src/server/routes/invitations/index.ts` | Same |
| `src/server/routes/audits/index.ts` | Same |
| `src/server/routes/storage/index.ts` | Same |

### Phase 4: Update Services

**Files to modify:**

| File | Change |
|------|--------|
| `src/server/services/invitations.ts` | Update Role type import |
| `src/server/services/accounts.ts` | Update `hasMinimumRole` logic |
| `src/server/services/users.ts` | Update Role type import |

### Phase 5: Update Frontend

**Files to modify:**

| File | Change |
|------|--------|
| `src/client/hooks/use-auth.ts` | Update to match @etus/auth `/auth/me` response |
| `src/client/routes/_authenticated.tsx` | Verify prefetch still works |

### Phase 6: Update Tests

**Delete these test files:**

```
tests/unit/server/auth/guards.test.ts
tests/unit/server/auth/roles.test.ts
tests/unit/server/auth/permissions.test.ts
tests/unit/server/lib/oauth.test.ts
tests/unit/server/services/auth.test.ts
tests/integration/auth/auth-service.test.ts
tests/integration/auth/oauth.test.ts
tests/integration/lib/oauth.test.ts
```

**Modify these test files:**

```
tests/unit/server/middleware/auth.test.ts
tests/integration/middleware/auth.test.ts
tests/fixtures/server.ts
```

### Phase 7: Data Migration

```sql
-- Migration script: Copy users from old to new schema
INSERT INTO auth_users (id, email, name, picture, role, status, created_at, last_login_at)
SELECT
  id,
  email,
  name,
  avatar_url,
  CASE
    WHEN is_super_admin = 1 THEN 'admin'
    ELSE 'viewer'
  END as role,
  CASE
    WHEN status = 'active' THEN 'active'
    WHEN status = 'suspended' THEN 'suspended'
    ELSE 'pending'
  END as status,
  created_at,
  updated_at as last_login_at
FROM users
WHERE deleted_at IS NULL;
```

## Critical Gaps Identified

### Schema Inconsistency (Pre-existing)

**Descoberta:** O código TypeScript define 7 roles, mas o `schema.sql` só permite 4:
```sql
CHECK (role IN ('viewer', 'user', 'manager', 'admin'))
```

**Ação:** Resolver inconsistência antes da migração.

### Gaps Prioritários

| # | Gap | Impacto | Decisão Necessária |
|---|-----|---------|-------------------|
| 1 | Role mapping 7→3 | Usuários perdem permissões | Mapeamento documentado acima |
| 2 | 27 permissions removidas | Guards quebram | Refatorar para role-based |
| 3 | BILLING/ANALYTICS roles | Acessos especiais perdidos | Aceitar ou criar workaround |
| 4 | Session fingerprinting | Segurança reduzida | Aceitar ou implementar custom |
| 5 | E2E `/auth/test-login` | Testes quebram | Usar gateway mock ou session injection |
| 6 | Pending invitations | Roles inválidos | Migrar antes do deploy |

### Questões Abertas

1. **Session invalidation**: Forçar re-login de todos os usuários no deploy?
2. **User notification**: Notificar usuários cujos roles mudam?
3. **Rollback strategy**: Manter backup por quanto tempo?

## Dependencies & Risks

### Dependencies

- @etus/auth v0.1.0+ installed
- Gateway registered client (run `npx @etus/auth init`)
- Environment variables: `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`

### Risks

| Risk | Mitigation |
|------|------------|
| Existing users lose access | Run data migration before deploy |
| Role mapping incorrect | Document and test each role transition |
| E2E tests break | Update test auth to use gateway or mock |
| Multi-tenant breaks | Keep accountMiddleware, test thoroughly |
| Schema inconsistency | Fix CHECK constraints before migration |
| Pending invitations invalid | Migrate invitation roles first |

## Environment Variables

**Add:**
```env
AUTH_GATEWAY=https://ag.etus.io
AUTH_CLIENT_ID=boilerplate-hono
AUTH_CLIENT_SECRET=<from gateway registration>
```

**Remove:**
```env
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
JWT_SECRET
JWT_EXPIRY_MINUTES
REFRESH_TOKEN_EXPIRY_DAYS
```

## Role Mapping Reference

| Old Role | New Role | Notes |
|----------|----------|-------|
| ADMIN | admin | Full access |
| MANAGER | admin | Promoted to admin |
| EDITOR | editor | Content editing |
| AUTHOR | editor | Merged with editor |
| VIEWER | viewer | Read-only |
| BILLING | viewer | Special access lost |
| ANALYTICS | viewer | Special access lost |

## Research Insights

### Security Considerations

**Session Hijacking Risk (HIGH)**
- Current: Session invalidated when User-Agent changes (fingerprinting)
- After: No fingerprint validation → stolen cookies work from any device

**Mitigation - Custom Fingerprint Middleware:**
```typescript
const fingerprintMiddleware = createMiddleware(async (c, next) => {
  const session = auth.getUser(c);
  if (!session) { await next(); return; }

  const currentUA = c.req.header('user-agent');
  const storedUA = await getSessionMetadata(c, 'userAgent');

  if (storedUA && currentUA !== storedUA) {
    await logSecurityEvent(c, 'SESSION_HIJACK_ATTEMPT', { userId: session.id });
    throw new HTTPException(401, { message: 'Session invalidated' });
  }
  await next();
});
```

**Role Escalation Risk (HIGH)**
- MANAGER users become admin (full access) instead of team management only
- Review all MANAGER users before migration

### Data Migration Corrections

**Current SQL is WRONG - ignores user_accounts.role:**
```sql
-- WRONG: Only looks at is_super_admin
CASE WHEN is_super_admin = 1 THEN 'admin' ELSE 'viewer' END
```

**Corrected approach:**
```sql
-- Must preserve per-account roles from user_accounts
-- Cannot use single-role auth_users table for multi-tenant RBAC
-- Keep user_accounts alongside auth_users
```

**Multi-Tenant Strategy:**
1. Keep `user_accounts` table for per-account roles
2. Use `auth_users` only for global user data
3. `accountMiddleware` reads from `user_accounts`

### Performance Insights

**OAuth Latency: ACCEPTABLE**
- Gateway adds +40-200ms to OAuth flow
- OAuth happens once per session (24h+) → imperceptible

**Real Bottleneck: DB query per request**
- Current: Every request queries DB for user data
- Fix: Embed user data in KV session, query DB only on session creation

```typescript
// Optimized session data
interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;  // Add role to session
  status: string;
  version: number;  // For cache invalidation
}
```

### Migration Strategy

**Gradual > Big Bang**
- 70% of big-bang migrations fail
- Use feature flags for gradual rollout

**Rollout Percentages:**
```
0.1%  → Internal users only
1%    → Monitor for auth failures
5%    → Check support ticket volume
10%   → Validate at scale
25%   → Monitor edge cases
50%   → Last chance for issues
100%  → Full deployment
```

**Feature Flags:**
```typescript
const AUTH_FLAGS = {
  USE_NEW_AUTH: 'auth.new_system_enabled',
  DUAL_SESSION_READ: 'auth.session_dual_read',
  MIGRATE_ON_ACCESS: 'auth.migrate_session_on_access',
};
```

### TypeScript Fixes Required

**1. Environment Variables:**
```typescript
// BAD
clientId: process.env.AUTH_CLIENT_ID!,

// GOOD (Cloudflare Workers)
export const createAppAuth = (env: HonoEnv["Bindings"]) => {
  if (!env.AUTH_CLIENT_ID) throw new Error("AUTH_CLIENT_ID required");
  return createAuth({ clientId: env.AUTH_CLIENT_ID, ... });
};
```

**2. Error Handling in Hooks:**
```typescript
onNewUser: async (user) => {
  try {
    await logAuthEvent({ type: "user.created", userId: user.id });
  } catch (error) {
    console.error("Failed to log:", error);  // Don't block user creation
  }
},
```

### Code Cleanup (Before Migration)

**Delete unused code (~340 LOC):**
```
DELETE: src/server/auth/permissions.ts (entire file - 140 LOC)
DELETE: roles.ts lines 50-141 (unused functions - 91 LOC)
DELETE: guards.ts lines 59-92 (requirePermission - 33 LOC)
DELETE: middleware/auth.ts lines 134-210 (jwtAuth legacy - 76 LOC)
```

**Actually used roles:**
- ADMIN, MANAGER, EDITOR, AUTHOR (4 roles)
- VIEWER is implicit (no guard = viewer access)
- BILLING: never used
- ANALYTICS: used once in audits route

## Decision Required

Before proceeding, choose one:

**Option A: Hybrid Migration (Recommended)**
- Use @etus/auth for OAuth/sessions only
- Keep local roles, permissions, guards, accountMiddleware
- Preserves multi-tenant RBAC
- Preserves security features (fingerprinting)

**Option B: Full Migration**
- Accept loss of fingerprinting (security risk)
- Accept role consolidation 7→3 (data loss)
- Accept multi-tenant RBAC changes
- Requires extensive data migration

**Option C: Cancel Migration**
- Clean up unused code (~340 LOC)
- Keep current auth system
- No new dependencies
- No security regression

## References

- [@etus/auth README](node_modules/@etus/auth/README.md)
- [@etus/auth API Documentation](node_modules/@etus/auth/documentation/API.md)
- Current auth implementation: `src/server/auth/`, `src/server/lib/`
- [DoorDash Session Migration](https://careersatdoordash.com/blog/session-management-migration/)
- [Descope Session Migration](https://www.descope.com/blog/post/session-migration)
- [BankInfoSecurity - Evolution vs Big Bang](https://www.bankinfosecurity.com/evolution-beats-big-bang-migration-in-iam-a-30361)
