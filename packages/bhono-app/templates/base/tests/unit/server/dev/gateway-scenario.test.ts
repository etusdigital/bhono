import { describe, it, expect } from 'vitest'
import type { Env } from '@server/env'
import {
  GATEWAY_MOCK_SCENARIO,
  isGatewayMockEnabled,
  resolveMockGatewayContext,
  type GatewayAccountRole,
} from '@server/dev/gateway-scenario'

const ROLES: GatewayAccountRole[] = ['viewer', 'editor', 'manager', 'admin']

// The resolver only reads ENVIRONMENT + ETUS_GATEWAY_MOCK; build a minimal Env.
function env(environment: string, mock?: string): Env {
  return { ENVIRONMENT: environment, ETUS_GATEWAY_MOCK: mock } as unknown as Env
}

describe('gateway mock — dev gating', () => {
  it('is disabled in production even with the flag set', () => {
    expect(isGatewayMockEnabled(env('production', '1'))).toBe(false)
    // null → real path (the caller falls back to the live gateway resolution).
    expect(resolveMockGatewayContext(env('production', '1'), 'admin@example.com')).toBeNull()
  })

  it('is disabled in dev without the flag', () => {
    expect(isGatewayMockEnabled(env('development', undefined))).toBe(false)
    expect(resolveMockGatewayContext(env('development'), 'admin@example.com')).toBeNull()
  })

  it('is enabled in a non-production env with the flag ("1" or "true")', () => {
    expect(isGatewayMockEnabled(env('development', '1'))).toBe(true)
    expect(isGatewayMockEnabled(env('test', 'true'))).toBe(true)
  })
})

describe('gateway mock — resolution (enabled)', () => {
  const e = env('development', '1')

  it('resolves a known user to their scenario', () => {
    expect(resolveMockGatewayContext(e, 'admin@example.com')).toEqual({
      accounts: [{ id: 'gw-acme', slug: 'acme', name: 'Acme Corporation', role: 'admin' }],
      superAdmin: false,
    })
  })

  it('is case-insensitive on email', () => {
    expect(resolveMockGatewayContext(e, 'ADMIN@EXAMPLE.COM')).toEqual(
      resolveMockGatewayContext(e, 'admin@example.com'),
    )
  })

  it('resolves an unknown / missing email to the safe empty context', () => {
    const empty = { accounts: [], superAdmin: false }
    expect(resolveMockGatewayContext(e, 'nobody@example.com')).toEqual(empty)
    expect(resolveMockGatewayContext(e, null)).toEqual(empty)
    expect(resolveMockGatewayContext(e, undefined)).toEqual(empty)
  })

  it('models a super-admin as superAdmin:true with no per-account rows', () => {
    expect(resolveMockGatewayContext(e, 'superadmin@example.com')).toEqual({
      accounts: [],
      superAdmin: true,
    })
  })

  // The headline scenario: this is the cross-account over-grant case the conservative
  // ACCOUNT_ROLE_MAP guards (see tests/unit/server/auth/matrix.test.ts). Pinning the
  // fixture keeps the demo honest — admin on an UNRELATED workspace + viewer on Acme —
  // so the Workspaces UI and the over-grant tests stay in sync.
  it('models the over-grant case: admin on initech + viewer on acme', () => {
    const ctx = resolveMockGatewayContext(e, 'multi@example.com')
    expect(ctx?.superAdmin).toBe(false)
    expect(ctx?.accounts).toEqual([
      { id: 'gw-initech', slug: 'initech', name: 'Initech', role: 'admin' },
      { id: 'gw-acme', slug: 'acme', name: 'Acme Corporation', role: 'viewer' },
    ])
  })
})

describe('gateway mock — fixture invariants', () => {
  it('every account has id/slug/name and a valid role', () => {
    for (const [email, ctx] of Object.entries(GATEWAY_MOCK_SCENARIO)) {
      expect(typeof ctx.superAdmin, `${email}.superAdmin`).toBe('boolean')
      for (const acct of ctx.accounts) {
        expect(acct.id, `${email} account id`).toBeTruthy()
        expect(acct.slug, `${email} account slug`).toBeTruthy()
        expect(acct.name, `${email} account name`).toBeTruthy()
        expect(ROLES, `${email} → ${acct.slug} role "${acct.role}"`).toContain(acct.role)
      }
    }
  })

  it('scenario keys are lowercase emails (lookups are lowercased)', () => {
    for (const email of Object.keys(GATEWAY_MOCK_SCENARIO)) {
      expect(email).toBe(email.toLowerCase())
    }
  })
})
