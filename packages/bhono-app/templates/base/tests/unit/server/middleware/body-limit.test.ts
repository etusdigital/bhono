import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { requestBodyLimit } from '@server/middleware/body-limit'

function makeApp(maxSize = 32, uploadMaxSize = 256) {
  const app = new Hono()
  app.use('*', requestBodyLimit(maxSize, uploadMaxSize))
  app.post('/api/resource', async (c) => {
    const body = await c.req.json()
    return c.json({ body })
  })
  app.put('/api/storage/upload/file.txt', (c) => c.text('ok'))
  return app
}

describe('requestBodyLimit', () => {
  it('allows JSON payloads within the configured limit', async () => {
    const res = await makeApp().request('/api/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ body: { ok: true } })
  })

  it('rejects oversized JSON payloads before the route parses the body', async () => {
    const res = await makeApp().request('/api/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(64) }),
    })

    expect(res.status).toBe(413)
    await expect(res.json()).resolves.toEqual({
      error: { message: 'Request body too large' },
    })
  })

  it('rejects oversized non-JSON payloads before the route parses the body', async () => {
    const res = await makeApp().request('/api/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'x'.repeat(64),
    })

    expect(res.status).toBe(413)
    await expect(res.json()).resolves.toEqual({
      error: { message: 'Request body too large' },
    })
  })

  it('rejects oversized payloads without relying on Content-Type', async () => {
    const res = await makeApp().request('/api/resource', {
      method: 'POST',
      body: 'x'.repeat(64),
    })

    expect(res.status).toBe(413)
    await expect(res.json()).resolves.toEqual({
      error: { message: 'Request body too large' },
    })
  })

  it('caps direct R2 upload bodies with the explicit upload limit', async () => {
    const res = await makeApp(32, 96).request('/api/storage/upload/file.txt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'x'.repeat(128),
    })

    expect(res.status).toBe(413)
  })

  it('allows direct R2 upload bodies within the explicit upload limit', async () => {
    const res = await makeApp().request('/api/storage/upload/file.txt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'x'.repeat(128),
    })

    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toBe('ok')
  })
})
