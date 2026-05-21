import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthUser } from '@etus/auth'
import { requestLogger } from '@server/middleware/request-logger'
import type { HonoEnv } from '@server/types'

function makeApp(status: number, user?: AuthUser) {
  const app = new Hono<HonoEnv>()
  if (user) {
    app.use('*', async (c, next) => {
      c.set('authUser', user)
      await next()
    })
  }
  app.use('*', requestLogger())
  app.get('/', () => new Response('', { status }))
  return app
}

function lastLog(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1)
  return JSON.parse(String(call?.[0])) as Record<string, unknown>
}

describe('requestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs info level for a 2xx response', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await makeApp(200).request('/')
    const log = lastLog(spy)
    expect(log.level).toBe('info')
    expect(log.status).toBe(200)
  })

  it('logs warn level for a 4xx response', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await makeApp(404).request('/')
    expect(lastLog(spy).level).toBe('warn')
  })

  it('logs error level for a 5xx response', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await makeApp(500).request('/')
    expect(lastLog(spy).level).toBe('error')
  })

  it('includes userId when the request is authenticated', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await makeApp(200, { id: 'user-1' } as AuthUser).request('/')
    expect(lastLog(spy).userId).toBe('user-1')
  })

  it('omits userId for anonymous requests', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await makeApp(200).request('/')
    expect(lastLog(spy).userId).toBeUndefined()
  })
})
