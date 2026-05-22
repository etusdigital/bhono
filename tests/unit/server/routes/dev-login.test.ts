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

    const sessionKey = Array.from(env.SESSIONS._mock._store.keys()).find((key) =>
      key.startsWith('auth_sid:'),
    )
    expect(sessionKey).toBeDefined()

    const stored = env.SESSIONS._mock._store.get(sessionKey ?? '')
    expect(stored).toBeDefined()
    expect(JSON.parse(stored?.value ?? '{}')).toMatchObject({
      userId: expect.any(String),
      fingerprint: {
        ip: '127.0.0.1',
        userAgent: 'Vitest',
      },
    })
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
})
