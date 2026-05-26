import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requestContext } from '@server/middleware/request-context'
import type { HonoEnv } from '@server/types'

function makeApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', requestContext)
  app.get('/', (c) =>
    c.json({
      transactionId: c.get('transactionId'),
      ip: c.get('ip'),
      userAgent: c.get('userAgent'),
    }),
  )
  return app
}

describe('requestContext', () => {
  it('sets a transactionId on every request', async () => {
    const res = await makeApp().request('/')
    const body = (await res.json()) as { transactionId?: string }
    expect(body.transactionId).toBeTruthy()
  })

  it('extracts the first IP from x-forwarded-for', async () => {
    const res = await makeApp().request('/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    const body = (await res.json()) as { ip?: string }
    expect(body.ip).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const res = await makeApp().request('/', { headers: { 'x-real-ip': '9.9.9.9' } })
    const body = (await res.json()) as { ip?: string }
    expect(body.ip).toBe('9.9.9.9')
  })

  it('uses "unknown" when no IP header is present', async () => {
    const res = await makeApp().request('/')
    const body = (await res.json()) as { ip?: string }
    expect(body.ip).toBe('unknown')
  })

  it('captures the user-agent header', async () => {
    const res = await makeApp().request('/', { headers: { 'user-agent': 'TestAgent/1.0' } })
    const body = (await res.json()) as { userAgent?: string }
    expect(body.userAgent).toBe('TestAgent/1.0')
  })

  it('uses "unknown" when no user-agent header is present', async () => {
    const res = await makeApp().request('/')
    const body = (await res.json()) as { userAgent?: string }
    expect(body.userAgent).toBe('unknown')
  })
})
