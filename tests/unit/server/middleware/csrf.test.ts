import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '@server/middleware/error-handler'
import { csrfProtection } from '@server/middleware/csrf'
import type { HonoEnv } from '@server/types'
import { createMockEnv } from '@tests/helpers/server'

function makeApp(options?: Parameters<typeof csrfProtection>[0]) {
  const app = new Hono<HonoEnv>()
  app.onError(errorHandler)
  app.use('*', csrfProtection(options))
  app.get('/api/resource', (c) => c.json({ ok: true }))
  app.post('/api/resource', (c) => c.json({ ok: true }))
  app.post('/auth/logout', (c) => c.json({ ok: true }))
  app.put('/api/storage/upload/file.txt', (c) => c.json({ ok: true }))
  app.post('/auth/test-login', (c) => c.json({ ok: true }))
  app.post('/invitations/tok-123/accept', (c) => c.json({ ok: true }))
  app.post('/invitations/tok-123/decline', (c) => c.json({ ok: true }))
  app.post('/api/webhooks/stripe', (c) => c.json({ ok: true }))
  return app
}

describe('csrfProtection', () => {
  it('lets safe methods pass without CSRF headers', async () => {
    const res = await makeApp().request('/api/resource', {}, createMockEnv())
    expect(res.status).toBe(200)
  })

  it('rejects state-changing requests without an Origin or Referer', async () => {
    const res = await makeApp().request(
      '/api/resource',
      {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: { message: 'Untrusted request origin' },
    })
  })

  it('rejects a state-changing request from an untrusted origin', async () => {
    const res = await makeApp().request(
      '/api/resource',
      {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
        headers: {
          Origin: 'https://evil.example',
          'Content-Type': 'application/json',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(403)
  })

  it('rejects JSON endpoints posted as a simple form content type', async () => {
    const res = await makeApp().request(
      '/api/resource',
      {
        method: 'POST',
        body: 'ok=true',
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(415)
  })

  it('allows trusted JSON mutations without a decorative CSRF token header', async () => {
    const res = await makeApp().request(
      '/api/resource',
      {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'application/json',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(200)
  })

  it('allows empty-body logout requests from trusted origins', async () => {
    const res = await makeApp().request(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:8787',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(200)
  })

  it('allows storage upload content types while keeping origin checks', async () => {
    const res = await makeApp().request(
      '/api/storage/upload/file.txt',
      {
        method: 'PUT',
        body: 'file',
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'text/plain',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(200)
  })

  it('exempts localhost-only test login from browser CSRF requirements', async () => {
    const res = await makeApp().request('/auth/test-login', { method: 'POST' }, createMockEnv())
    expect(res.status).toBe(200)
  })

  it('allows empty-body invitation accept', async () => {
    const res = await makeApp().request(
      '/invitations/tok-123/accept',
      {
        method: 'POST',
        headers: { Origin: 'http://localhost:8787' },
      },
      createMockEnv(),
    )
    expect(res.status).toBe(200)
  })

  it('allows empty-body invitation decline (widened from accept-only)', async () => {
    const res = await makeApp().request(
      '/invitations/tok-123/decline',
      {
        method: 'POST',
        headers: { Origin: 'http://localhost:8787' },
      },
      createMockEnv(),
    )
    expect(res.status).toBe(200)
  })

  it('accepts non-JSON content on routes registered via nonJsonPathPrefixes', async () => {
    // Simulates a webhook receiver that needs to accept form-encoded payloads
    // — without this option the strict JSON contract would 415 the request.
    const res = await makeApp({ nonJsonPathPrefixes: ['/api/webhooks/'] }).request(
      '/api/webhooks/stripe',
      {
        method: 'POST',
        body: 'payload=1',
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
      createMockEnv(),
    )
    expect(res.status).toBe(200)
  })

  it('skips all checks for additional exemptPaths so consumers can wire their own gates', async () => {
    const app = new Hono<HonoEnv>()
    app.onError(errorHandler)
    app.use('*', csrfProtection({ exemptPaths: ['/internal/cron'] }))
    app.post('/internal/cron', (c) => c.json({ ok: true }))

    const res = await app.request('/internal/cron', { method: 'POST' }, createMockEnv())
    expect(res.status).toBe(200)
  })

  it('treats additional emptyBodyPaths as allowed without Content-Type', async () => {
    const app = new Hono<HonoEnv>()
    app.onError(errorHandler)
    app.use('*', csrfProtection({ emptyBodyPaths: ['/auth/refresh'] }))
    app.post('/auth/refresh', (c) => c.json({ ok: true }))

    const res = await app.request(
      '/auth/refresh',
      {
        method: 'POST',
        headers: { Origin: 'http://localhost:8787' },
      },
      createMockEnv(),
    )
    expect(res.status).toBe(200)
  })

  it('treats additional emptyBodyPatterns as allowed without Content-Type', async () => {
    // Same idea as emptyBodyPaths but for token/id-keyed routes that need a
    // pattern instead of an exact match.
    const app = new Hono<HonoEnv>()
    app.onError(errorHandler)
    app.use(
      '*',
      csrfProtection({ emptyBodyPatterns: [/^\/api\/jobs\/[^/]+\/cancel$/] }),
    )
    app.post('/api/jobs/:id/cancel', (c) => c.json({ ok: true }))

    const res = await app.request(
      '/api/jobs/abc-123/cancel',
      {
        method: 'POST',
        headers: { Origin: 'http://localhost:8787' },
      },
      createMockEnv(),
    )
    expect(res.status).toBe(200)
  })

  it('points the 415 error at the opt-out so the operator knows how to fix it', async () => {
    const res = await makeApp().request(
      '/api/resource',
      {
        method: 'POST',
        body: 'whatever',
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'application/octet-stream',
        },
      },
      createMockEnv(),
    )
    expect(res.status).toBe(415)
    await expect(res.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining('nonJsonPathPrefixes') },
    })
  })
})
