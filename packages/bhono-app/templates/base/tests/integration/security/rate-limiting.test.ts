/**
 * Rate Limiting Integration Tests
 *
 * Tests that the API has rate limiting protection against abuse:
 * - Returns 429 when rate limit exceeded
 * - Includes proper rate limit headers (X-RateLimit-*, Retry-After)
 * - Resets rate limit after window expires
 * - Different limits for different endpoints (e.g., stricter auth limits)
 * - Proper key generation (per-IP)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import { createTestScenario } from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { auth } from '../../../src/server/routes/auth'
import { health } from '../../../src/server/routes/health'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { requestContext } from '../../../src/server/middleware/request-context'
import { sessionMiddleware } from '../../../src/server/lib/session'
import {
  RateLimitStore,
  rateLimitWithStore,
  rateLimit,
  authRateLimit,
} from '../../../src/server/middleware/rate-limit'

/**
 * Creates a database wrapper that adds the `execute` method
 */
function createTestDb() {
  return getDb()
}

describe('Rate Limiting', () => {
  let env: TestEnv
  let store: RateLimitStore

  beforeAll(() => {
    env = getEnv()
  })

  beforeEach(() => {
    // Create a fresh store for each test
    store = new RateLimitStore()
  })

  afterEach(() => {
    // Clean up the store
    store.destroy()
  })

  /**
   * Create a test app with rate limiting using the test store
   */
  function createTestApp(options?: { maxRequests?: number; windowMs?: number }) {
    const app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      ;(c as any).env = env
      const db = createTestDb()
      c.set('db', db)
      await next()
    })

    // Request context for IP tracking
    app.use('*', requestContext)

    // Rate limiting with test store
    app.use(
      '*',
      rateLimitWithStore(store, {
        max: options?.maxRequests ?? 10, // Lower limit for testing
        windowMs: options?.windowMs ?? 60000,
      })
    )

    // Session middleware
    app.use('*', sessionMiddleware())

    // Mount routes
    app.route('/health', health)
    app.route('/auth', auth)
    app.route('/api', api)

    return app
  }

  // ============================================================================
  // Basic Rate Limiting Tests
  // ============================================================================

  describe('Basic Rate Limiting', () => {
    it('allows requests under the rate limit', async () => {
      const app = createTestApp({ maxRequests: 10 })

      // Make 5 requests (under the limit of 10)
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.1.100' },
        })
        expect(res.status).toBe(200)
      }
    })

    it('returns 429 when rate limit is exceeded', async () => {
      const app = createTestApp({ maxRequests: 5 })

      // Make 5 requests to reach the limit
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.1.101' },
        })
        expect(res.status).toBe(200)
      }

      // 6th request should be rate limited
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.101' },
      })

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('includes Retry-After header on 429', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Exhaust rate limit
      for (let i = 0; i < 2; i++) {
        await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.1.102' },
        })
      }

      // Make request that should be rate limited
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.102' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeDefined()
      const retryAfter = Number.parseInt(res.headers.get('Retry-After') ?? '0', 10)
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
    })

    it('includes retryAfter in response body', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Exhaust rate limit
      for (let i = 0; i < 2; i++) {
        await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.1.103' },
        })
      }

      // Make request that should be rate limited
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.103' },
      })

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.retryAfter).toBeDefined()
      expect(body.error.retryAfter).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Standard Rate Limit Headers Tests
  // ============================================================================

  describe('Standard Rate Limit Headers', () => {
    it('includes X-RateLimit-Limit header', async () => {
      const app = createTestApp({ maxRequests: 100 })

      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.110' },
      })

      expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
    })

    it('includes X-RateLimit-Remaining header that decrements', async () => {
      const app = createTestApp({ maxRequests: 10 })

      // First request
      const res1 = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.111' },
      })
      expect(res1.headers.get('X-RateLimit-Remaining')).toBe('9')

      // Second request
      const res2 = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.111' },
      })
      expect(res2.headers.get('X-RateLimit-Remaining')).toBe('8')

      // Third request
      const res3 = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.111' },
      })
      expect(res3.headers.get('X-RateLimit-Remaining')).toBe('7')
    })

    it('X-RateLimit-Remaining shows 0 when limit exceeded', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Make 2 requests to reach limit
      for (let i = 0; i < 2; i++) {
        await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.1.112' },
        })
      }

      // Make request that exceeds limit
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.112' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('includes X-RateLimit-Reset header with future timestamp', async () => {
      const app = createTestApp({ maxRequests: 10 })

      const beforeRequest = Date.now()
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.113' },
      })

      const resetTimestamp = Number.parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10)
      expect(resetTimestamp).toBeGreaterThan(Math.floor(beforeRequest / 1000))
    })
  })

  // ============================================================================
  // Per-IP Rate Limiting Tests
  // ============================================================================

  describe('Per-IP Rate Limiting', () => {
    it('tracks rate limits separately per IP address', async () => {
      const app = createTestApp({ maxRequests: 3 })

      // Exhaust rate limit for first IP
      for (let i = 0; i < 3; i++) {
        await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.1.200' },
        })
      }

      // First IP should be rate limited
      const res1 = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.200' },
      })
      expect(res1.status).toBe(429)

      // Second IP should still work
      const res2 = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.201' },
      })
      expect(res2.status).toBe(200)
    })

    it('uses X-Forwarded-For header for IP detection', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Make requests with specific X-Forwarded-For
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '10.0.0.1' },
      })

      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '10.0.0.1' },
      })

      // This should be rate limited
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '10.0.0.1' },
      })
      expect(res.status).toBe(429)
    })

    it('uses X-Real-IP as fallback for IP detection', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Make requests with X-Real-IP
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Real-IP': '172.16.0.1' },
      })

      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Real-IP': '172.16.0.1' },
      })

      // This should be rate limited
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Real-IP': '172.16.0.1' },
      })
      expect(res.status).toBe(429)
    })

    it('takes first IP from comma-separated X-Forwarded-For list', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Make requests with multiple IPs in X-Forwarded-For
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.50, 10.0.0.1, 172.16.0.1' },
      })

      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.50, 10.0.0.2, 172.16.0.2' },
      })

      // Should be rate limited based on first IP (192.168.1.50)
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.50, 10.0.0.3, 172.16.0.3' },
      })
      expect(res.status).toBe(429)

      // Different first IP should work
      const res2 = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.51, 10.0.0.1' },
      })
      expect(res2.status).toBe(200)
    })
  })

  // ============================================================================
  // Window Reset Tests
  // ============================================================================

  describe('Rate Limit Window Reset', () => {
    it('resets rate limit after window expires', async () => {
      // Use a very short window for testing
      const app = createTestApp({ maxRequests: 2, windowMs: 100 }) // 100ms window

      const ip = '192.168.1.250'

      // Exhaust rate limit
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })

      // Should be rate limited
      const limitedRes = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      expect(limitedRes.status).toBe(429)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Should be allowed again
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('1')
    })
  })

  // ============================================================================
  // Authenticated Endpoint Tests
  // ============================================================================

  describe('Rate Limiting on Authenticated Endpoints', () => {
    it('applies rate limiting to authenticated API routes', async () => {
      const app = createTestApp({ maxRequests: 3 })

      const scenario = await createTestScenario({
        userName: 'Rate Limit Test User',
        userEmail: 'ratelimit@example.com',
        role: 'viewer',
      })

      const ip = '192.168.1.180'

      // Make requests to authenticated endpoint
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'X-Forwarded-For': ip,
            'account-id': scenario.account.id,
          },
        })
        expect(res.status).toBe(200)
      }

      // Should be rate limited
      const res = await app.request('/api/accounts', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'X-Forwarded-For': ip,
          'account-id': scenario.account.id,
        },
      })

      expect(res.status).toBe(429)
    })

    it('rate limit is shared across different authenticated routes for same IP', async () => {
      const app = createTestApp({ maxRequests: 4 })

      const scenario = await createTestScenario({
        userName: 'Multi Route Test User',
        userEmail: 'multiroute@example.com',
        role: 'viewer',
      })

      const ip = '192.168.1.181'

      // Make requests to different routes
      await app.request('/api/accounts', {
        method: 'GET',
        headers: { ...scenario.headers, 'X-Forwarded-For': ip, 'account-id': scenario.account.id },
      })

      await app.request('/api/users', {
        method: 'GET',
        headers: { ...scenario.headers, 'X-Forwarded-For': ip, 'account-id': scenario.account.id },
      })

      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })

      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })

      // 5th request should be rate limited regardless of route
      const res = await app.request('/api/accounts', {
        method: 'GET',
        headers: { ...scenario.headers, 'X-Forwarded-For': ip, 'account-id': scenario.account.id },
      })

      expect(res.status).toBe(429)
    })
  })

  // ============================================================================
  // Response Format Tests
  // ============================================================================

  describe('Rate Limit Response Format', () => {
    it('returns JSON response for rate limit errors', async () => {
      const app = createTestApp({ maxRequests: 1 })

      // Exhaust rate limit
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.220' },
      })

      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.220' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('content-type')).toContain('application/json')

      const body = await res.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('message')
      expect(body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED')
      expect(body.error).toHaveProperty('retryAfter')
    })

    it('provides meaningful error message', async () => {
      const app = createTestApp({ maxRequests: 1 })

      // Exhaust rate limit
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.221' },
      })

      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.221' },
      })

      const body = await res.json()
      expect(body.error.message).toContain('Too many requests')
    })
  })

  // ============================================================================
  // Store Management Tests
  // ============================================================================

  describe('Rate Limit Store', () => {
    it('store tracks multiple IPs correctly', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Make requests from multiple IPs
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4', '192.168.1.5']

      for (const ip of ips) {
        await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': ip },
        })
      }

      // Store should have 5 entries
      expect(store.size).toBe(5)
    })

    it('clear() removes all entries', async () => {
      const app = createTestApp({ maxRequests: 10 })

      // Make some requests
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.230' },
      })

      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.1.231' },
      })

      expect(store.size).toBeGreaterThan(0)

      store.clear()

      expect(store.size).toBe(0)
    })
  })

  // ============================================================================
  // Stress Tests
  // ============================================================================

  describe('Rate Limiting Stress Tests', () => {
    it('handles burst of requests correctly', async () => {
      const app = createTestApp({ maxRequests: 50 })
      const ip = '192.168.1.240'

      // Send 100 requests in parallel
      const requests = Array.from({ length: 100 }, () =>
        app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': ip },
        })
      )

      const responses = await Promise.all(requests)

      // First 50 should succeed, remaining should be rate limited
      const successfulResponses = responses.filter((r) => r.status === 200)
      const rateLimitedResponses = responses.filter((r) => r.status === 429)

      expect(successfulResponses.length).toBe(50)
      expect(rateLimitedResponses.length).toBe(50)
    })

    it('handles requests from many different IPs', async () => {
      const app = createTestApp({ maxRequests: 2 })

      // Make requests from 50 different IPs
      const requests = Array.from({ length: 50 }, (_, i) =>
        app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': `10.0.0.${i}` },
        })
      )

      const responses = await Promise.all(requests)

      // All should succeed (different IPs, each under limit)
      const successfulResponses = responses.filter((r) => r.status === 200)
      expect(successfulResponses.length).toBe(50)
    })
  })

  // ============================================================================
  // Skip Option Tests
  // ============================================================================

  describe('Skip Option', () => {
    it('should skip rate limiting when skip returns true', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)

      // Rate limit with skip for health endpoints
      app.use(
        '*',
        rateLimitWithStore(store, {
          max: 2,
          skip: (c) => c.req.path === '/health',
        })
      )

      app.route('/health', health)

      // Make many requests to skipped endpoint
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/health', {
          method: 'GET',
          headers: { 'X-Forwarded-For': '192.168.2.1' },
        })
        expect(res.status).toBe(200)
      }
    })

    it('should apply rate limiting when skip returns false', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)

      // Rate limit with skip for non-health endpoints
      app.use(
        '*',
        rateLimitWithStore(store, {
          max: 2,
          skip: (c) => c.req.path === '/not-this-path',
        })
      )

      app.route('/health', health)

      // Make requests to non-skipped endpoint
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.2.2' },
      })
      await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.2.2' },
      })

      // 3rd request should be rate limited
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.2.2' },
      })
      expect(res.status).toBe(429)
    })

    it('should skip rate limiting using rateLimit() with skip option', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      // Use rateLimit() instead of rateLimitWithStore()
      app.use(
        '*',
        rateLimit({
          max: 2,
          skip: (c) => c.req.header('X-Skip-RateLimit') === 'true',
        })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      // Make many requests with skip header
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/test', {
          method: 'GET',
          headers: {
            'X-Forwarded-For': '192.168.2.3',
            'X-Skip-RateLimit': 'true',
          },
        })
        expect(res.status).toBe(200)
      }

      // Without skip header, should be rate limited after 2 requests
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.2.4' },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.2.4' },
      })
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.2.4' },
      })
      expect(res.status).toBe(429)
    })
  })

  // ============================================================================
  // authRateLimit Tests
  // ============================================================================

  describe('authRateLimit', () => {
    it('should apply stricter rate limits for auth endpoints', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use('*', authRateLimit())

      app.get('/test', (c) => c.json({ ok: true }))

      const ip = '192.168.3.1'

      // authRateLimit defaults to 10 requests per minute
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/test', {
          method: 'GET',
          headers: { 'X-Forwarded-For': ip },
        })
        expect(res.status).toBe(200)
      }

      // 11th request should be rate limited
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      expect(res.status).toBe(429)

      const body = await res.json()
      expect(body.error.message).toContain('authentication attempts')
    })

    it('should include standard rate limit headers', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use('*', authRateLimit())

      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '192.168.3.2' },
      })

      expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
    })
  })

  // ============================================================================
  // defaultKeyGenerator Fallback Tests
  // ============================================================================

  describe('defaultKeyGenerator fallbacks', () => {
    it('should use X-Forwarded-For when context IP is not set', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      // Note: NOT using requestContext middleware, so c.get('ip') will be undefined
      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use(
        '*',
        rateLimitWithStore(store, { max: 2 })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '10.10.10.1' },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '10.10.10.1' },
      })

      // 3rd request should be rate limited
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '10.10.10.1' },
      })
      expect(res.status).toBe(429)
    })

    it('should use X-Real-IP when X-Forwarded-For is not set', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      // Note: NOT using requestContext middleware
      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use(
        '*',
        rateLimitWithStore(store, { max: 2 })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Real-IP': '20.20.20.1' },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Real-IP': '20.20.20.1' },
      })

      // 3rd request should be rate limited
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Real-IP': '20.20.20.1' },
      })
      expect(res.status).toBe(429)
    })

    it('should fallback to unknown when no IP headers present', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      // Note: NOT using requestContext middleware
      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use(
        '*',
        rateLimitWithStore(store, { max: 2 })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      // Requests without any IP headers
      await app.request('/test', { method: 'GET' })
      await app.request('/test', { method: 'GET' })

      // 3rd request should be rate limited (all fall back to 'unknown')
      const res = await app.request('/test', { method: 'GET' })
      expect(res.status).toBe(429)
    })

    it('should handle comma-separated X-Forwarded-For without context IP', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      // Note: NOT using requestContext middleware
      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use(
        '*',
        rateLimitWithStore(store, { max: 2 })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      // First IP in the list should be used
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '30.30.30.1, 30.30.30.2, 30.30.30.3' },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '30.30.30.1, proxy1, proxy2' },
      })

      // 3rd request with same first IP should be rate limited
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '30.30.30.1' },
      })
      expect(res.status).toBe(429)

      // Different first IP should work
      const res2 = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '30.30.30.2' },
      })
      expect(res2.status).toBe(200)
    })
  })

  // ============================================================================
  // Store Cleanup Tests
  // ============================================================================

  describe('Store cleanup', () => {
    it('should cleanup expired entries on access', async () => {
      // Use a very short window
      const testStore = new RateLimitStore()

      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use(
        '*',
        rateLimitWithStore(testStore, { max: 2, windowMs: 50 }) // 50ms window
      )

      app.get('/test', (c) => c.json({ ok: true }))

      // Make requests from two different IPs
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '40.40.40.1' },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '40.40.40.2' },
      })

      expect(testStore.size).toBe(2)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Make a new request - this creates a new entry for a new window
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '40.40.40.1' },
      })

      // Original entry for 40.40.40.1 was expired and replaced with new one
      // Entry for 40.40.40.2 is expired but not cleaned until accessed
      // So we should have 2 entries still
      expect(testStore.size).toBe(2)

      testStore.destroy()
    })

    it('should allow requests after window expires', async () => {
      const testStore = new RateLimitStore()

      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use(
        '*',
        rateLimitWithStore(testStore, { max: 2, windowMs: 50 })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      const ip = '50.50.50.1'

      // Exhaust rate limit
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })

      // Should be rate limited
      const limitedRes = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      expect(limitedRes.status).toBe(429)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should be allowed again
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': ip },
      })
      expect(res.status).toBe(200)

      testStore.destroy()
    })
  })

  // ============================================================================
  // standardHeaders Option Tests
  // ============================================================================

  describe('standardHeaders option', () => {
    it('should include rate limit headers when standardHeaders is true (default)', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use(
        '*',
        rateLimitWithStore(store, { max: 10, standardHeaders: true })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '60.60.60.1' },
      })

      expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('should not include rate limit headers when standardHeaders is false', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use(
        '*',
        rateLimitWithStore(store, { max: 10, standardHeaders: false })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '60.60.60.2' },
      })

      expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
      expect(res.headers.get('X-RateLimit-Remaining')).toBeNull()
      expect(res.headers.get('X-RateLimit-Reset')).toBeNull()
    })
  })

  // ============================================================================
  // Custom Key Generator Tests
  // ============================================================================

  describe('Custom key generator', () => {
    it('should use custom key generator when provided', async () => {
      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      // Use API key as rate limit key
      app.use(
        '*',
        rateLimitWithStore(store, {
          max: 2,
          keyGenerator: (c) => c.req.header('X-API-Key') ?? 'anonymous',
        })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      // Same API key should share rate limit
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'key-123', 'X-Forwarded-For': '70.70.70.1' },
      })
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'key-123', 'X-Forwarded-For': '70.70.70.2' }, // Different IP
      })

      // 3rd request with same API key should be rate limited
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'key-123', 'X-Forwarded-For': '70.70.70.3' },
      })
      expect(res.status).toBe(429)

      // Different API key should work
      const res2 = await app.request('/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'key-456', 'X-Forwarded-For': '70.70.70.1' },
      })
      expect(res2.status).toBe(200)
    })
  })

  // ============================================================================
  // Custom Message Tests
  // ============================================================================

  describe('Custom message', () => {
    it('should use custom message when rate limit exceeded', async () => {
      const customMessage = 'Slow down there, partner!'

      const app = new Hono<HonoEnv>()
      app.onError(errorHandler)

      app.use('*', async (c, next) => {
        ;(c as any).env = env
        const db = createTestDb()
        c.set('db', db)
        await next()
      })

      app.use('*', requestContext)
      app.use(
        '*',
        rateLimitWithStore(store, { max: 1, message: customMessage })
      )

      app.get('/test', (c) => c.json({ ok: true }))

      // Exhaust rate limit
      await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '80.80.80.1' },
      })

      // Should get custom message
      const res = await app.request('/test', {
        method: 'GET',
        headers: { 'X-Forwarded-For': '80.80.80.1' },
      })

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.message).toBe(customMessage)
    })
  })
})
