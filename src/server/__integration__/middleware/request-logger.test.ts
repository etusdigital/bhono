/**
 * Request Logger Middleware Integration Tests
 *
 * Tests the request logging functionality:
 * - Log format and structure
 * - Log levels based on status codes
 * - Request metadata capture
 * - User ID inclusion when authenticated
 */

import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../../types'
import { requestLogger } from '../../middleware/request-logger'
import { getEnv, getDb, type TestEnv } from '../setup'
import { sessionMiddleware } from '../../lib/session'
import { createUser, createUserSession } from '../fixtures'
import { errorHandler } from '../../middleware/error-handler'

/**
 * Creates a database wrapper
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('Request Logger Middleware Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    env = getEnv()
  })

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    app = new Hono<HonoEnv>()

    app.onError(errorHandler)

    // Set up middleware
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', 'test-transaction-123')
      c.set('ip', '192.168.1.100')
      c.set('userAgent', 'TestAgent/1.0')
      await next()
    })

    app.use('*', sessionMiddleware())
    // Optional auth: sets user if session exists but doesn't block
    app.use('*', async (c, next) => {
      const { getSession } = await import('../../lib/session')
      const session = getSession(c)
      if (session) {
        // Set user from session data
        c.set('user', {
          id: session.userId,
          email: session.email || '',
          name: session.name || '',
        } as any)
      }
      await next()
    })
    app.use('*', requestLogger())

    // Test routes
    app.get('/success', (c) => c.json({ status: 'ok' }))
    app.get('/not-found', (c) => c.json({ error: 'Not found' }, 404))
    app.get('/error', () => {
      throw new Error('Internal error')
    })
    app.get('/protected', (c) => {
      const user = c.get('user')
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return c.json({ user: user.id })
    })
    app.post('/data', async (c) => {
      const body = await c.req.json()
      return c.json({ received: body }, 201)
    })
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('Log format and structure', () => {
    it('should log request with correct JSON structure', async () => {
      await app.request('/success')

      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0][0]
      const log = JSON.parse(logCall)

      expect(log).toHaveProperty('level')
      expect(log).toHaveProperty('method')
      expect(log).toHaveProperty('path')
      expect(log).toHaveProperty('status')
      expect(log).toHaveProperty('duration')
      expect(log).toHaveProperty('transactionId')
      expect(log).toHaveProperty('ip')
      expect(log).toHaveProperty('userAgent')
      expect(log).toHaveProperty('timestamp')
    })

    it('should log correct request method', async () => {
      await app.request('/success', { method: 'GET' })

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.method).toBe('GET')
    })

    it('should log correct request path', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.path).toBe('/success')
    })

    it('should log POST requests correctly', async () => {
      await app.request('/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      })

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.method).toBe('POST')
      expect(log.status).toBe(201)
    })
  })

  describe('Log levels based on status codes', () => {
    it('should use "info" level for 2xx responses', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.level).toBe('info')
      expect(log.status).toBe(200)
    })

    it('should use "warn" level for 4xx responses', async () => {
      await app.request('/not-found')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.level).toBe('warn')
      expect(log.status).toBe(404)
    })

    it('should use "warn" level for 401 responses', async () => {
      await app.request('/protected')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.level).toBe('warn')
      expect(log.status).toBe(401)
    })

    it('should use "error" level for 5xx responses', async () => {
      await app.request('/error')

      // Error handler logs first (index 0), request logger logs second (index 1)
      const log = JSON.parse(consoleLogSpy.mock.calls[1][0])
      expect(log.level).toBe('error')
      expect(log.status).toBe(500)
    })
  })

  describe('Request metadata capture', () => {
    it('should capture transaction ID', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.transactionId).toBe('test-transaction-123')
    })

    it('should capture IP address', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.ip).toBe('192.168.1.100')
    })

    it('should capture user agent', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.userAgent).toBe('TestAgent/1.0')
    })

    it('should capture request duration', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.duration).toBeGreaterThanOrEqual(0)
      expect(typeof log.duration).toBe('number')
    })

    it('should capture timestamp in ISO format', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.timestamp).toBeTruthy()
      // Should be valid ISO date
      expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp)
    })
  })

  describe('User ID inclusion', () => {
    it('should not include userId for unauthenticated requests', async () => {
      await app.request('/success')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.userId).toBeUndefined()
    })

    it('should include userId for authenticated requests', async () => {
      const user = await createUser({ email: 'logtest@example.com', name: 'Log Test User' })
      const { headers } = await createUserSession(user.id, {
        email: user.email,
        name: user.name,
      })

      await app.request('/success', {
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.userId).toBe(user.id)
    })
  })

  describe('Fallback values', () => {
    it('should use fallback for missing context values', async () => {
      // Create app without context middleware
      const simpleApp = new Hono<HonoEnv>()
      simpleApp.use('*', requestLogger())
      simpleApp.get('/test', (c) => c.json({ ok: true }))

      await simpleApp.request('/test')

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.transactionId).toBe('unknown')
      expect(log.ip).toBe('unknown')
      expect(log.userAgent).toBe('unknown')
    })

    it('should use x-forwarded-for header as fallback for IP', async () => {
      const simpleApp = new Hono<HonoEnv>()
      simpleApp.use('*', requestLogger())
      simpleApp.get('/test', (c) => c.json({ ok: true }))

      await simpleApp.request('/test', {
        headers: {
          'x-forwarded-for': '10.0.0.1',
        },
      })

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.ip).toBe('10.0.0.1')
    })

    it('should use user-agent header as fallback', async () => {
      const simpleApp = new Hono<HonoEnv>()
      simpleApp.use('*', requestLogger())
      simpleApp.get('/test', (c) => c.json({ ok: true }))

      await simpleApp.request('/test', {
        headers: {
          'user-agent': 'CustomBrowser/2.0',
        },
      })

      const log = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(log.userAgent).toBe('CustomBrowser/2.0')
    })
  })

  describe('Multiple requests', () => {
    it('should log each request independently', async () => {
      await app.request('/success')
      await app.request('/not-found')
      await app.request('/success')

      expect(consoleLogSpy).toHaveBeenCalledTimes(3)

      const log1 = JSON.parse(consoleLogSpy.mock.calls[0][0])
      const log2 = JSON.parse(consoleLogSpy.mock.calls[1][0])
      const log3 = JSON.parse(consoleLogSpy.mock.calls[2][0])

      expect(log1.status).toBe(200)
      expect(log2.status).toBe(404)
      expect(log3.status).toBe(200)
    })
  })
})
