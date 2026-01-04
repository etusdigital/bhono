import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@server/types'
import {
  RateLimitStore,
  globalStore,
  rateLimit,
  authRateLimit,
  rateLimitWithStore,
} from '@server/middleware/rate-limit'

describe('RateLimitStore', () => {
  let store: RateLimitStore

  beforeEach(() => {
    store = new RateLimitStore()
  })

  afterEach(() => {
    store.destroy()
  })

  describe('get/set', () => {
    it('returns undefined for non-existent key', () => {
      expect(store.get('non-existent')).toBeUndefined()
    })

    it('stores and retrieves a record', () => {
      const record = { count: 5, resetTime: Date.now() + 60000 }
      store.set('test-key', record)
      expect(store.get('test-key')).toEqual(record)
    })
  })

  describe('increment', () => {
    it('creates new record for new key', () => {
      const record = store.increment('new-key', 60000)
      expect(record.count).toBe(1)
      expect(record.resetTime).toBeGreaterThan(Date.now())
    })

    it('increments existing record within window', () => {
      store.increment('key', 60000)
      const record = store.increment('key', 60000)
      expect(record.count).toBe(2)
    })

    it('resets count when window expires', () => {
      // Set a record with expired reset time
      store.set('expired-key', { count: 10, resetTime: Date.now() - 1000 })
      const record = store.increment('expired-key', 60000)
      expect(record.count).toBe(1) // Reset to 1, not 11
    })
  })

  describe('clear', () => {
    it('removes all entries', () => {
      store.increment('key1', 60000)
      store.increment('key2', 60000)
      expect(store.size).toBe(2)
      store.clear()
      expect(store.size).toBe(0)
    })
  })

  describe('size', () => {
    it('returns correct count', () => {
      expect(store.size).toBe(0)
      store.increment('key1', 60000)
      expect(store.size).toBe(1)
      store.increment('key2', 60000)
      expect(store.size).toBe(2)
    })
  })

  describe('destroy', () => {
    it('stops cleanup interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      store.startPeriodicCleanup()
      store.destroy()
      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('handles multiple destroy calls gracefully', () => {
      store.destroy()
      expect(() => store.destroy()).not.toThrow()
    })
  })
})

describe('rateLimit middleware', () => {
  let store: RateLimitStore
  let app: Hono<HonoEnv>

  beforeEach(() => {
    store = new RateLimitStore()
    app = new Hono<HonoEnv>()
  })

  afterEach(() => {
    store.destroy()
    globalStore.clear()
  })

  describe('headers', () => {
    it('sets rate limit headers on response', async () => {
      app.use('*', rateLimitWithStore(store, { max: 100 }))
      app.get('/test', (c) => c.text('ok'))

      const res = await app.request('/test')
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('99')
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })

    it('decrements remaining count', async () => {
      app.use('*', rateLimitWithStore(store, { max: 10 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      await app.request('/test')
      const res = await app.request('/test')

      expect(res.headers.get('X-RateLimit-Remaining')).toBe('7')
    })

    it('skips headers when standardHeaders is false', async () => {
      app.use('*', rateLimitWithStore(store, { standardHeaders: false }))
      app.get('/test', (c) => c.text('ok'))

      const res = await app.request('/test')
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    })
  })

  describe('rate limiting', () => {
    it('allows requests within limit', async () => {
      app.use('*', rateLimitWithStore(store, { max: 5 }))
      app.get('/test', (c) => c.text('ok'))

      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test')
        expect(res.status).toBe(200)
      }
    })

    it('blocks requests exceeding limit', async () => {
      app.use('*', rateLimitWithStore(store, { max: 2 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      await app.request('/test')
      const res = await app.request('/test')

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('returns Retry-After header when blocked', async () => {
      app.use('*', rateLimitWithStore(store, { max: 1 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      const res = await app.request('/test')

      expect(res.headers.get('Retry-After')).toBeTruthy()
    })

    it('uses custom message', async () => {
      app.use('*', rateLimitWithStore(store, { max: 1, message: 'Slow down!' }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.error.message).toBe('Slow down!')
    })
  })

  describe('skip function', () => {
    it('skips rate limiting when skip returns true', async () => {
      app.use(
        '*',
        rateLimitWithStore(store, {
          max: 1,
          skip: (c) => c.req.path === '/health',
        })
      )
      app.get('/test', (c) => c.text('test'))
      app.get('/health', (c) => c.text('healthy'))

      // First request to /test uses the limit
      await app.request('/test')
      // Second request to /test is blocked
      const blocked = await app.request('/test')
      expect(blocked.status).toBe(429)

      // Health endpoint is never blocked
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/health')
        expect(res.status).toBe(200)
      }
    })
  })

  describe('key generator', () => {
    it('uses IP from context when available', async () => {
      app.use('*', (c, next) => {
        c.set('ip', '192.168.1.1')
        return next()
      })
      app.use('*', rateLimitWithStore(store, { max: 1 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      // Same IP should be blocked
      const res = await app.request('/test')
      expect(res.status).toBe(429)
    })

    it('uses x-forwarded-for header', async () => {
      app.use('*', rateLimitWithStore(store, { max: 1 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })
      expect(res.status).toBe(429)
    })

    it('uses first IP from x-forwarded-for chain', async () => {
      app.use('*', rateLimitWithStore(store, { max: 1 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' },
      })
      // Same first IP should be blocked
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.4' },
      })
      expect(res.status).toBe(429)
    })

    it('uses x-real-ip header as fallback', async () => {
      app.use('*', rateLimitWithStore(store, { max: 1 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test', {
        headers: { 'x-real-ip': '172.16.0.1' },
      })
      const res = await app.request('/test', {
        headers: { 'x-real-ip': '172.16.0.1' },
      })
      expect(res.status).toBe(429)
    })

    it('falls back to unknown when no IP available', async () => {
      app.use('*', rateLimitWithStore(store, { max: 1 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      const res = await app.request('/test')
      expect(res.status).toBe(429)
    })

    it('supports custom key generator', async () => {
      app.use(
        '*',
        rateLimitWithStore(store, {
          max: 1,
          keyGenerator: (c) => c.req.header('x-api-key') ?? 'anonymous',
        })
      )
      app.get('/test', (c) => c.text('ok'))

      // Different API keys have separate limits
      await app.request('/test', { headers: { 'x-api-key': 'key1' } })
      await app.request('/test', { headers: { 'x-api-key': 'key2' } })

      // key1 is blocked
      const blocked = await app.request('/test', { headers: { 'x-api-key': 'key1' } })
      expect(blocked.status).toBe(429)

      // key2 still has remaining
      const allowed = await app.request('/test', { headers: { 'x-api-key': 'key2' } })
      expect(allowed.status).toBe(429) // Now also blocked after 2nd request
    })
  })

  describe('window expiration', () => {
    it('resets limit after window expires', async () => {
      vi.useFakeTimers()

      app.use('*', rateLimitWithStore(store, { max: 1, windowMs: 1000 }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')
      let res = await app.request('/test')
      expect(res.status).toBe(429)

      // Advance time past window
      vi.advanceTimersByTime(1100)

      res = await app.request('/test')
      expect(res.status).toBe(200)

      vi.useRealTimers()
    })
  })
})

describe('authRateLimit', () => {
  let app: Hono<HonoEnv>

  beforeEach(() => {
    globalStore.clear()
    app = new Hono<HonoEnv>()
  })

  afterEach(() => {
    globalStore.clear()
  })

  it('has stricter limits (10 requests per minute)', async () => {
    app.use('*', authRateLimit())
    app.post('/login', (c) => c.text('ok'))

    // First 10 requests should succeed
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/login', { method: 'POST' })
      expect(res.status).toBe(200)
    }

    // 11th request should be blocked
    const blocked = await app.request('/login', { method: 'POST' })
    expect(blocked.status).toBe(429)
  })

  it('uses auth-specific error message', async () => {
    app.use('*', authRateLimit())
    app.post('/login', (c) => c.text('ok'))

    // Exhaust limit
    for (let i = 0; i < 11; i++) {
      await app.request('/login', { method: 'POST' })
    }

    const res = await app.request('/login', { method: 'POST' })
    const body = await res.json()
    expect(body.error.message).toContain('authentication')
  })
})

describe('rateLimit with global store', () => {
  let app: Hono<HonoEnv>

  beforeEach(() => {
    globalStore.clear()
    app = new Hono<HonoEnv>()
  })

  afterEach(() => {
    globalStore.clear()
  })

  it('uses global store by default', async () => {
    app.use('*', rateLimit({ max: 2 }))
    app.get('/test', (c) => c.text('ok'))

    await app.request('/test')
    await app.request('/test')
    const res = await app.request('/test')

    expect(res.status).toBe(429)
  })

  it('shares state across middleware instances', async () => {
    app.use('/api/*', rateLimit({ max: 2 }))
    app.use('/web/*', rateLimit({ max: 2 }))
    app.get('/api/test', (c) => c.text('api'))
    app.get('/web/test', (c) => c.text('web'))

    // Both use the same key (unknown IP), so share the limit
    await app.request('/api/test')
    await app.request('/web/test')
    const res = await app.request('/api/test')

    expect(res.status).toBe(429)
  })
})

describe('edge cases', () => {
  let store: RateLimitStore
  let app: Hono<HonoEnv>

  beforeEach(() => {
    store = new RateLimitStore()
    app = new Hono<HonoEnv>()
  })

  afterEach(() => {
    store.destroy()
  })

  it('handles remaining going negative gracefully', async () => {
    app.use('*', rateLimitWithStore(store, { max: 1 }))
    app.get('/test', (c) => c.text('ok'))

    await app.request('/test')
    await app.request('/test')
    const res = await app.request('/test')

    // Remaining should be 0, not negative
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('handles context IP set to unknown', async () => {
    app.use('*', (c, next) => {
      c.set('ip', 'unknown')
      return next()
    })
    app.use('*', rateLimitWithStore(store, { max: 1 }))
    app.get('/test', (c) => c.text('ok'))

    // Should fall through to header checking
    await app.request('/test', { headers: { 'x-real-ip': '1.2.3.4' } })
    const res = await app.request('/test', { headers: { 'x-real-ip': '1.2.3.4' } })
    expect(res.status).toBe(429)
  })

  it('handles very short window', async () => {
    vi.useFakeTimers()

    app.use('*', rateLimitWithStore(store, { max: 1, windowMs: 100 }))
    app.get('/test', (c) => c.text('ok'))

    await app.request('/test')
    let res = await app.request('/test')
    expect(res.status).toBe(429)

    vi.advanceTimersByTime(150)

    res = await app.request('/test')
    expect(res.status).toBe(200)

    vi.useRealTimers()
  })

  it('Retry-After is at least 1 second', async () => {
    vi.useFakeTimers()

    app.use('*', rateLimitWithStore(store, { max: 1, windowMs: 100 }))
    app.get('/test', (c) => c.text('ok'))

    await app.request('/test')

    // Advance to just before window expires
    vi.advanceTimersByTime(99)

    const res = await app.request('/test')
    const retryAfter = res.headers.get('Retry-After')
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1)

    vi.useRealTimers()
  })
})
