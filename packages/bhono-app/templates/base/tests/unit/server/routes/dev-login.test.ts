import { describe, expect, it } from 'vitest'
import { devLogin } from '@server/routes/dev-login'
import { createMockEnv } from '@tests/helpers/server'

describe('devLogin', () => {
  it('rejects requests outside localhost', async () => {
    const env = createMockEnv()
    const res = await devLogin.request(
      'https://example.com/',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'e2e@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    )

    expect(res.status).toBe(403)
  })

  it('creates a package-compatible session, fingerprint, and default account', async () => {
    const env = createMockEnv()
    const res = await devLogin.request(
      'http://localhost/',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'e2e@example.com', name: 'E2E User' }),
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '127.0.0.1',
          'User-Agent': 'Vitest',
        },
      },
      env,
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      user: { email: 'e2e@example.com', name: 'E2E User', role: 'admin' },
      accountId: expect.any(String),
    })
    expect(res.headers.get('set-cookie')).toContain('auth_sid=')

    // Session cookie issued, and the session written to D1 auth_sessions — that
    // INSERT is what @etus/auth's createSqlSessionStore (v0.6.0+) reads. The
    // mock D1 doesn't persist rows, so assert the write happened, and that the
    // session is NO LONGER mirrored to KV.
    const sessionId = (res.headers.get('set-cookie') ?? '').match(/auth_sid=([^;]+)/)?.[1]
    expect(sessionId).toBeTruthy()

    const prepareCalls = (env.DB.prepare as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const insertedSession = prepareCalls.some(
      (call) => typeof call[0] === 'string' && /INSERT INTO auth_sessions/i.test(call[0]),
    )
    expect(insertedSession).toBe(true)
    expect(env.SESSIONS._mock._store.size).toBe(0)
  })

  it('rejects roles outside the configured @etus/auth role catalog', async () => {
    const env = createMockEnv()
    const res = await devLogin.request(
      'http://localhost/',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'e2e@example.com', role: 'viewer' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: { message: 'invalid role: viewer' },
    })
  })

  it('sets the session cookie with SameSite=Lax so an accidental downgrade to None is caught', async () => {
    // The CSRF strategy this boilerplate ships with (Origin + Referer check,
    // no token) relies on the browser refusing to send the session cookie on
    // cross-site state-changing requests. SameSite=None would silently undo
    // that, leaving auth open to CSRF. This test fails fast if someone flips
    // it without rethinking the protection model.
    const env = createMockEnv()
    const res = await devLogin.request(
      'http://localhost/',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'e2e@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env,
    )

    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/SameSite=(Lax|Strict)/i)
    expect(cookie).not.toMatch(/SameSite=None/i)
  })
})
