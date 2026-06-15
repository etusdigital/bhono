import { describe, it, expect } from 'vitest'
import { buildApp } from '@server/index'
import { getEnv } from '../setup'

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
