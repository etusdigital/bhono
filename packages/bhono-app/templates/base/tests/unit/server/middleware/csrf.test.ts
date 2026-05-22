import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '@server/middleware/error-handler'
import { csrfProtection } from '@server/middleware/csrf'
import type { HonoEnv } from '@server/types'
import { createMockEnv } from '@tests/helpers/server'

function makeApp() {
  const app = new Hono<HonoEnv>()
  app.onError(errorHandler)
  app.use('*', csrfProtection())
  app.get('/api/resource', (c) => c.json({ ok: true }))
  app.post('/api/resource', (c) => c.json({ ok: true }))
  app.post('/auth/logout', (c) => c.json({ ok: true }))
  app.put('/api/storage/upload/file.txt', (c) => c.json({ ok: true }))
  app.post('/auth/test-login', (c) => c.json({ ok: true }))
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
          'X-CSRF-Token': '1',
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
          'X-CSRF-Token': '1',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(403)
  })

  it('rejects a state-changing request missing the intentional CSRF header', async () => {
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

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: { message: 'Missing CSRF protection header' },
    })
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
          'X-CSRF-Token': '1',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(415)
  })

  it('allows trusted JSON mutations with the CSRF header', async () => {
    const res = await makeApp().request(
      '/api/resource',
      {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'application/json',
          'X-CSRF-Token': '1',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(200)
  })

  it('allows empty-body logout requests with the CSRF header', async () => {
    const res = await makeApp().request(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:8787',
          'X-CSRF-Token': '1',
        },
      },
      createMockEnv(),
    )

    expect(res.status).toBe(200)
  })

  it('allows storage upload content types while keeping origin and CSRF checks', async () => {
    const res = await makeApp().request(
      '/api/storage/upload/file.txt',
      {
        method: 'PUT',
        body: 'file',
        headers: {
          Origin: 'http://localhost:8787',
          'Content-Type': 'text/plain',
          'X-CSRF-Token': '1',
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
})
