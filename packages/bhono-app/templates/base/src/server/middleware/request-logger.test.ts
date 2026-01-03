import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { requestLogger } from './request-logger'

describe('requestLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  const createApp = () => {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('transactionId', 'test-tx-id')
      c.set('user', null)
      await next()
    })
    app.use('*', requestLogger())
    return app
  }

  it('logs successful requests with info level', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ ok: true }))

    await app.request('/api/users')

    expect(consoleSpy).toHaveBeenCalled()
    const logArg = consoleSpy.mock.calls[0][0]
    const log = JSON.parse(logArg)

    expect(log.level).toBe('info')
    expect(log.method).toBe('GET')
    expect(log.path).toBe('/api/users')
    expect(log.status).toBe(200)
    expect(log.transactionId).toBe('test-tx-id')
    expect(typeof log.duration).toBe('number')
  })

  it('logs 4xx as warn level', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ error: 'Not found' }, 404))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(log.level).toBe('warn')
    expect(log.status).toBe(404)
  })

  it('logs 5xx as error level', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ error: 'Server error' }, 500))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(log.level).toBe('error')
    expect(log.status).toBe(500)
  })

  it('includes userId when authenticated', async () => {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('transactionId', 'test-tx-id')
      c.set('user', { id: 'user-123' })
      await next()
    })
    app.use('*', requestLogger())
    app.get('/api/users', (c) => c.json({ ok: true }))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(log.userId).toBe('user-123')
  })

  it('includes timestamp in ISO format', async () => {
    const app = createApp()
    app.get('/api/users', (c) => c.json({ ok: true }))

    await app.request('/api/users')

    const log = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(() => new Date(log.timestamp)).not.toThrow()
  })
})
