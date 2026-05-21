// @etus/auth instance factory.
//
// Lazy singleton: the ETUS_* config vars only exist at request time in
// Cloudflare Workers, so createAuth() runs on the first request and the
// instance is cached for the isolate's lifetime (env is stable per deploy).
//
// Bootstrap a brand-new product without an admin: start with mode 'open' and
// one owner email in ETUS_ADMIN_EMAILS, then switch to 'approval-required'
// once the first admin is confirmed. See the auth-extend skill.

import { createAuth, type AuthInstance } from '@etus/auth'
import type { Env } from '../env'
import { PERMISSIONS_MATRIX, ROLE_HIERARCHY, ROLES } from './matrix'

function parseList(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

let cached: AuthInstance | undefined

export function getAuth(env: Env): AuthInstance {
  if (cached) return cached

  cached = createAuth({
    gateway: env.ETUS_GATEWAY,
    clientId: env.ETUS_CLIENT_ID,
    clientSecret: (e) => (e as Env).ETUS_CLIENT_SECRET,
    db: (e) => (e as Env).DB as D1Database,
    sessions: (e) => (e as Env).SESSIONS as KVNamespace,
    access: {
      mode: 'approval-required',
      allowedDomains: parseList(env.ETUS_ALLOWED_DOMAINS),
      admins: parseList(env.ETUS_ADMIN_EMAILS).map((email) => email.toLowerCase()),
      roles: [...ROLES],
      defaultRole: 'guest',
    },
    permissions: PERMISSIONS_MATRIX,
    roleHierarchy: ROLE_HIERARCHY,
    multiTenant: { enabled: true },
    audit: { enabled: true, retentionDays: 90 },
    session: { fingerprint: true, fingerprintMode: 'reauth' },
    redirects: {
      // Local SPA routes. afterLogout must NOT be /auth/login — that
      // path is the package's OAuth entry and would re-trigger a login.
      afterLogin: '/',
      afterLogout: '/login',
    },
  })

  return cached
}
