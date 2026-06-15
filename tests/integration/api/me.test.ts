import { describe, it, expect } from 'vitest'
import type { Hono } from 'hono'
import { buildApp } from '@server/index'
import type { HonoEnv } from '@server/types'
import type { Env } from '@server/env'
import { getEnv } from '../setup'

interface MeBody {
  accounts: { id: string; slug: string; name: string; role: string }[]
  superAdmin: boolean
}

// Mint a real session via the dev /auth/test-login endpoint and return the session
// cookie ("auth_sid=<id>"), so /api/me can be exercised as an authenticated user
// through the FULL production middleware — the same path E2E relies on. Both requests
// go to http://localhost (test-login is loopback-gated) with no fingerprint headers,
// so the login + follow-up share the same ("unknown") fingerprint.
async function login(
  app: Hono<HonoEnv>,
  env: Env,
  email: string,
  role = 'member',
): Promise<string> {
  const res = await app.request(
    'http://localhost/auth/test-login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: email.split('@')[0], role }),
    },
    env,
  )
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = /(?:^|,\s*)(auth_sid=[^;]+)/.exec(setCookie)
  if (!match) throw new Error(`no session cookie in Set-Cookie: ${setCookie}`)
  return match[1]
}

// GET /api/me exposes the caller's gateway accounts + super-admin flag, so it MUST
// sit behind the /api/* requireAuthContext gate wired in src/server/index.ts.
//
// The unit test (tests/unit/server/routes/me.test.ts) mounts the `me` router BARE
// — without that gate — so it cannot prove the production wiring rejects
// unauthenticated callers. This suite builds the REAL app via buildApp() and
// drives requests through the full middleware stack to verify the gate.
//
// `getEnv()` is passed as the third arg to app.request so c.env is populated for
// validateEnv + the auth middleware; the hostname is localhost so validateEnv
// runs in loopback mode.
describe('GET /api/me — auth gate (production wiring)', () => {
  it('returns 401 for an unauthenticated request (no session cookie)', async () => {
    const env = getEnv()
    const app = buildApp(env)

    const res = await app.request('http://localhost/api/me', { method: 'GET' }, env)

    expect(res.status).toBe(401)
    // The gate short-circuits before the handler runs, so no account/super-admin
    // info leaks to an unauthenticated caller.
    const body = await res.text()
    expect(body).not.toContain('"accounts"')
    expect(body).not.toContain('"superAdmin"')
  })

  it('keeps public routes reachable in the same app (the gate is scoped to /api/*, not a boot failure)', async () => {
    // Guards against a false-positive 401: if buildApp failed to boot, every route
    // would error. A reachable public /health proves the 401 above is the auth
    // gate specifically, not the whole app falling over.
    const env = getEnv()
    const app = buildApp(env)

    const res = await app.request('http://localhost/health', { method: 'GET' }, env)

    expect(res.status).toBe(200)
  })
})

// The dev gateway mock (src/server/dev/gateway-scenario.ts) lets the multi-tenant UI
// be validated without a live gateway. These tests drive it end-to-end: a real session
// (test-login) → the /api/* gate → the /api/me handler → the scenario fixture, proving
// the signed-in user's per-account gateway roles surface correctly.
describe('GET /api/me — gateway mock resolution', () => {
  // Enable the dev mock on top of the integration env (ENVIRONMENT='test' ≠ production).
  function mockEnv(): Env {
    return { ...getEnv(), ETUS_GATEWAY_MOCK: '1' }
  }

  it("resolves the signed-in user's scenario through the real middleware", async () => {
    const env = mockEnv()
    const app = buildApp(env)
    const cookie = await login(app, env, 'multi@example.com')

    const res = await app.request(
      'http://localhost/api/me',
      { method: 'GET', headers: { Cookie: cookie } },
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as MeBody
    expect(body.superAdmin).toBe(false)
    // The over-grant case: admin on an UNRELATED workspace (Initech) + viewer on Acme.
    expect(body.accounts).toEqual([
      { id: 'gw-initech', slug: 'initech', name: 'Initech', role: 'admin' },
      { id: 'gw-acme', slug: 'acme', name: 'Acme Corporation', role: 'viewer' },
    ])
  })

  it('reflects super-admin for a super-admin scenario user', async () => {
    const env = mockEnv()
    const app = buildApp(env)
    const cookie = await login(app, env, 'superadmin@example.com', 'owner')

    const res = await app.request(
      'http://localhost/api/me',
      { method: 'GET', headers: { Cookie: cookie } },
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as MeBody
    expect(body).toEqual({ accounts: [], superAdmin: true })
  })

  it('returns the safe empty shape when the mock is OFF (no flag set)', async () => {
    // Without ETUS_GATEWAY_MOCK the handler takes the real path; gatewayAuthority is
    // off in tests, so a valid session still resolves to the empty context.
    const env = getEnv()
    const app = buildApp(env)
    const cookie = await login(app, env, 'multi@example.com')

    const res = await app.request(
      'http://localhost/api/me',
      { method: 'GET', headers: { Cookie: cookie } },
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as MeBody
    expect(body).toEqual({ accounts: [], superAdmin: false })
  })
})
