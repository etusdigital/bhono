// @etus/auth instance factory (v0.7.0).
//
// Lazy singletons: the ETUS_* config vars only exist at request time in
// Cloudflare Workers, so the config + instance are built on the first request
// and cached for the isolate's lifetime (env is stable per deploy).
//
// We expose both `getAuth()` (the AuthInstance) and `getAuthConfig()` (the
// raw AuthConfig). The config is needed separately by `@etus/auth/dev`
// helpers (`createTestSession`, `devRoutes`) which don't take an instance.
//
// Sessions live in D1 (`createSqlSessionStore`, v0.6.0+), not KV. Authorization
// can be sourced from the gateway (`gatewayAuthority`, v0.8.0+): when enabled
// via ETUS_GATEWAY_AUTHORITY=true, the app derives a user's permissions from
// what the gateway resolved for it (RBAC ∪ access_grants), mapped to local
// permissions via SCOPE_MAP. ETUS_ADMIN_EMAILS stays required by the package as
// a bootstrap admin allowlist — with gatewayAuthority the gateway becomes the
// authority for permissions (admin is the `bhono:admin` scope → `['*']`), and
// the allowlist is just the day-0 fallback.
//
// Bootstrap a brand-new product without an admin: start with mode 'open' and
// one owner email in ETUS_ADMIN_EMAILS, then switch to 'approval-required'
// once the first admin is confirmed. See the auth-extend skill.

import {
  createAuth,
  createSqlSessionStore,
  validateAdminEmails,
  type AuthConfig,
  type AuthDatabase,
  type AuthInstance,
  type MailerAdapter,
} from '@etus/auth'
import type { Env } from '../env'
import { sendInvitationEmail } from '../lib/email'
import { PERMISSIONS_MATRIX, ROLE_HIERARCHY, ROLES, SCOPE_MAP } from './matrix'

function parseList(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseBool(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

let cachedConfig: AuthConfig | undefined
let cachedInstance: AuthInstance | undefined

function buildAuthConfig(env: Env): AuthConfig {
  // Bridge the package's MailerAdapter contract to our SendGrid wrapper.
  // env is captured via closure — the adapter methods don't receive it, and
  // the SendGrid call needs SENDGRID_API_KEY + SENDGRID_FROM_EMAIL from env.
  const mailer: MailerAdapter = {
    async sendInvitationEmail(to, link, ctx) {
      const inviterName = ctx.invitedBy.name ?? ctx.invitedBy.email
      const accountName = ctx.account.name
      // The package already built `link` from our multiTenant.invitationUrl
      // callback below — just pass it through.
      await sendInvitationEmail(env, to, inviterName, accountName, link)
    },
  }

  return {
    gateway: env.ETUS_GATEWAY,
    clientId: env.ETUS_CLIENT_ID,
    clientSecret: (e) => (e as Env).ETUS_CLIENT_SECRET ?? '',
    // v0.4.0 generalized `db` from D1Database to AuthDatabase (added a Postgres
    // adapter path). D1Database is structurally compatible at runtime but the
    // type misses an index signature, so we cast through unknown.
    db: (e) => (e as Env).DB as unknown as AuthDatabase,
    // v0.6.0: sessions moved off KV onto a pluggable SessionStore. The default
    // SQL store persists them in the same D1 `auth_sessions` table.
    sessionStore: (e) => createSqlSessionStore((e as Env).DB as unknown as AuthDatabase),
    access: {
      mode: 'approval-required',
      allowedDomains: parseList(env.ETUS_ALLOWED_DOMAINS),
      // validateAdminEmails (v0.5.0+) parses + validates the staff-admin
      // allowlist; throws a clear error if a non-production env list is empty,
      // or a production list is missing/contains invalid addresses.
      admins: validateAdminEmails(env.ETUS_ADMIN_EMAILS, env.ENVIRONMENT),
      roles: [...ROLES],
      // v0.5.0: invite without explicit role now uses defaultRole ?? "admin".
      // We pick "member" so new invitees can collaborate on resources without
      // jumping straight to admin or being stuck on read-only "guest".
      defaultRole: 'member',
    },
    permissions: PERMISSIONS_MATRIX,
    roleHierarchy: ROLE_HIERARCHY,
    // Gateway-as-authority (v0.8.0). Off by default so a freshly generated app
    // boots before its gateway resource + integration key exist; flip
    // ETUS_GATEWAY_AUTHORITY=true once onboarding is done (see SETUP-GUIDE).
    // When on, the gateway's resolved scopes become the permission source
    // (mapped via SCOPE_MAP) — making the gateway the authority for permissions
    // instead of the ETUS_ADMIN_EMAILS bootstrap list. Admin is just a scope that
    // maps to `['*']` (see SCOPE_MAP `bhono:admin`); gate with requirePermission,
    // not requireRole, so a revoked scope drops access on the next request.
    gatewayAuthority: {
      enabled: parseBool(env.ETUS_GATEWAY_AUTHORITY),
      resourceId: env.ETUS_RESOURCE_ID ?? '',
      integrationKey: (e) => (e as Env).ETUS_INTEGRATION_KEY ?? '',
      scopeMap: SCOPE_MAP,
      ttlSeconds: 300,
    },
    // Required in v0.5.0 when the invitation flow is active — without a
    // mailer, /accounts/:id/members/invite returns 501 MAILER_NOT_CONFIGURED.
    mailer,
    multiTenant: {
      enabled: true,
      // @etus/auth's account routes treat membership role "admin" as the
      // account administrator (PRIVILEGED_MEMBERSHIP_ROLE). Product-level
      // owner/admin/member/guest stays on auth_users.role and the permission
      // matrix; account membership writes are narrowed to admin/member/guest
      // (drops "owner") by auth/package-compat.ts.
      creatorRole: 'admin',
      // Required when `mailer` is set — the package owns no routing knowledge,
      // so we map invitation → SPA accept URL here.
      invitationUrl: (inv) => `${env.APP_URL}/invite/${inv.token}`,
    },
    audit: { enabled: true, retentionDays: 90 },
    session: { fingerprint: true, fingerprintMode: 'reauth' },
    // Double-guarded: the @etus/auth/dev subexport (devRoutes, createTestSession)
    // also asserts env.ENVIRONMENT !== 'production' before letting requests in,
    // so this flag alone never opens dev features in prod by accident.
    devMode: env.ENVIRONMENT !== 'production',
    redirects: {
      // Local SPA routes. afterLogout must NOT be /auth/login — that
      // path is the package's OAuth entry and would re-trigger a login.
      afterLogin: '/',
      afterLogout: '/login',
    },
  }
}

export function getAuthConfig(env: Env): AuthConfig {
  if (cachedConfig) return cachedConfig
  cachedConfig = buildAuthConfig(env)
  return cachedConfig
}

export function getAuth(env: Env): AuthInstance {
  if (cachedInstance) return cachedInstance
  cachedInstance = createAuth(getAuthConfig(env))
  return cachedInstance
}
