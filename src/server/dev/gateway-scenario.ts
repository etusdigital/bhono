// src/server/dev/gateway-scenario.ts
//
// DEV-ONLY mock of the gateway's per-account role resolution (gateway-as-authority,
// @etus/auth v0.9.1). In production the per-account roles are resolved by the gateway
// over HTTP and read via `auth.getGatewayAccounts(c)`. Locally there is no gateway, so
// this fixture lets you validate the multi-tenant UI and write tests against a known
// scenario WITHOUT a live gateway.
//
// Gated TWICE: it only ever activates when ENVIRONMENT !== 'production' AND
// ETUS_GATEWAY_MOCK is truthy. The `/api/me` route consults resolveMockGatewayContext
// before the real gateway resolution, so production behaviour is untouched.
//
// The scenario is keyed by the signed-in user's email and is deliberately aligned with
// src/server/db/seed.ts, so the same users that exist locally (and can log in via
// /auth/test-login) also carry gateway roles here. Treat it as a replaceable starting
// point for your own demo data, not a contract.

import type { Env } from '../env'

export type GatewayAccountRole = 'viewer' | 'editor' | 'manager' | 'admin'

export interface MockGatewayAccount {
  id: string
  slug: string
  name: string
  role: GatewayAccountRole
}

export interface MockGatewayContext {
  accounts: MockGatewayAccount[]
  superAdmin: boolean
}

// Gateway "orgs"/workspaces in the demo scenario. ids are stable so tests can assert on
// them. These are GATEWAY accounts (migration 0070), distinct from the app's own local
// accounts in auth_accounts.
type GatewayOrg = Omit<MockGatewayAccount, 'role'>
const ACME: GatewayOrg = { id: 'gw-acme', slug: 'acme', name: 'Acme Corporation' }
const GLOBEX: GatewayOrg = { id: 'gw-globex', slug: 'globex', name: 'Globex Inc' }
const INITECH: GatewayOrg = { id: 'gw-initech', slug: 'initech', name: 'Initech' }

function at(org: GatewayOrg, role: GatewayAccountRole): MockGatewayAccount {
  return { ...org, role }
}

// email → gateway context. Keys are lowercase; lookups are lowercased too.
export const GATEWAY_MOCK_SCENARIO: Record<string, MockGatewayContext> = {
  // Super-admin: no per-account rows needed — counts as admin everywhere.
  'superadmin@example.com': { accounts: [], superAdmin: true },
  // Single-workspace admin.
  'admin@example.com': { accounts: [at(ACME, 'admin')], superAdmin: false },
  // Multi-workspace, mixed roles: manager on Acme, read-only on Globex.
  'manager@example.com': { accounts: [at(ACME, 'manager'), at(GLOBEX, 'viewer')], superAdmin: false },
  // Editor on a single workspace.
  'editor@example.com': { accounts: [at(GLOBEX, 'editor')], superAdmin: false },
  // Read-only.
  'viewer@example.com': { accounts: [at(ACME, 'viewer')], superAdmin: false },
  // OVER-GRANT GUARD CASE: admin on an UNRELATED workspace (Initech) + viewer on Acme.
  // Because @etus/auth unions ACCOUNT_ROLE_MAP across EVERY account a user holds, this
  // user must NOT gain wildcard/destructive app-wide perms from the Initech admin role
  // — the conservative map in src/server/auth/matrix.ts is what keeps that closed. The
  // Workspaces UI shows the two distinct per-account roles side by side.
  'multi@example.com': { accounts: [at(INITECH, 'admin'), at(ACME, 'viewer')], superAdmin: false },
}

/** True when the dev gateway mock may activate (never in production). */
export function isGatewayMockEnabled(env: Env): boolean {
  return (
    env.ENVIRONMENT !== 'production' &&
    (env.ETUS_GATEWAY_MOCK === 'true' || env.ETUS_GATEWAY_MOCK === '1')
  )
}

/**
 * The mocked gateway context for `email`, or null when the mock is disabled (so the
 * caller falls back to the real gateway resolution). When enabled, an unknown email
 * resolves to the safe empty context — the same shape a user with no gateway accounts
 * would get from the real gateway.
 */
export function resolveMockGatewayContext(
  env: Env,
  email: string | null | undefined,
): MockGatewayContext | null {
  if (!isGatewayMockEnabled(env)) return null
  const key = (email ?? '').toLowerCase()
  return GATEWAY_MOCK_SCENARIO[key] ?? { accounts: [], superAdmin: false }
}
