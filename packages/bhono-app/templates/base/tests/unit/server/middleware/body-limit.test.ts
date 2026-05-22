import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { requestBodyLimit } from '@server/middleware/body-limit'

function makeApp(maxSize = 32) {
  const app = new Hono()
  app.use('*', requestBodyLimit(maxSize))
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

  it('does not cap direct R2 upload bodies with the JSON API limit', async () => {
    const res = await makeApp().request('/api/storage/upload/file.txt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'x'.repeat(128),
    })

    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toBe('ok')
  })
})
