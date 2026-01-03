/**
 * Performance Response Times Integration Tests
 *
 * Tests API endpoint response times to ensure they meet performance SLAs.
 * These tests run against the real test infrastructure with in-memory database
 * to measure baseline performance characteristics.
 *
 * Performance Thresholds:
 * - Health endpoints: < 50ms
 * - List endpoints: < 200ms
 * - Create endpoints: < 300ms
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import {
  createTestScenario,
  createAccount,
  addUserToAccount,
} from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { health } from '../../routes/health'
import { errorHandler } from '../../middleware/error-handler'
import { sessionMiddleware } from '../../lib/session'

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  health: 50, // Health endpoints should be very fast
  list: 200, // List endpoints with pagination
  create: 300, // Create operations (includes validation + DB write)
}

/**
 * Creates a database wrapper that adds the `execute` method
 */
function createTestDb() {
  const db = getDb()
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as unknown as Record<string | symbol, unknown>)[prop]
    },
  })
}

/**
 * Helper to measure async function execution time
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await fn()
  const durationMs = performance.now() - start
  return { result, durationMs }
}

describe('Performance Response Times Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      // Inject environment bindings
      ;(c as unknown as { env: TestEnv }).env = env

      // Set up database
      const db = createTestDb()
      c.set('db', db)

      // Set up request context variables
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Session middleware
    app.use('*', sessionMiddleware())

    // Mount routes
    app.route('/health', health)
    app.route('/api', api)
  })

  // ==========================================================================
  // Health Endpoint Performance
  // ==========================================================================

  describe('Health Endpoint Performance (< 50ms)', () => {
    it('GET /health responds under 50ms', async () => {
      // Warm up request (first request may include initialization overhead)
      await app.request('/health', { method: 'GET' })

      // Measure actual performance
      const { result: res, durationMs } = await measureTime(() =>
        app.request('/health', { method: 'GET' })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.health)

      console.log(`GET /health: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.health}ms)`)
    })

    it('GET /health/ready responds under 50ms', async () => {
      // Warm up
      await app.request('/health/ready', { method: 'GET' })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/health/ready', { method: 'GET' })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.health)

      console.log(`GET /health/ready: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.health}ms)`)
    })

    it('GET /health/live responds under 50ms', async () => {
      // Warm up
      await app.request('/health/live', { method: 'GET' })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/health/live', { method: 'GET' })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.health)

      console.log(`GET /health/live: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.health}ms)`)
    })

    it('health endpoints handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10

      const { durationMs } = await measureTime(async () => {
        const requests = Array(concurrentRequests)
          .fill(null)
          .map(() => app.request('/health', { method: 'GET' }))

        const responses = await Promise.all(requests)

        // All should succeed
        for (const res of responses) {
          expect(res.status).toBe(200)
        }
      })

      // Average time per request should still be low
      const avgTime = durationMs / concurrentRequests
      expect(avgTime).toBeLessThan(THRESHOLDS.health)

      console.log(
        `${concurrentRequests} concurrent /health requests: ` +
          `total ${durationMs.toFixed(2)}ms, avg ${avgTime.toFixed(2)}ms`
      )
    })
  })

  // ==========================================================================
  // List Endpoint Performance
  // ==========================================================================

  describe('List Endpoint Performance (< 200ms)', () => {
    it('GET /api/users responds under 200ms', async () => {
      const scenario = await createTestScenario({
        userName: 'List Perf User',
        userEmail: 'listperf@example.com',
        role: 'VIEWER',
      })

      // Warm up
      await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.list)

      console.log(`GET /api/users: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.list}ms)`)
    })

    it('GET /api/accounts responds under 200ms', async () => {
      const scenario = await createTestScenario({
        userName: 'Account Perf User',
        userEmail: 'accountperf@example.com',
        role: 'VIEWER',
      })

      // Warm up
      await app.request('/api/accounts', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.list)

      console.log(`GET /api/accounts: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.list}ms)`)
    })

    it('GET /api/audits responds under 200ms', async () => {
      // Audit logs require ADMIN or ANALYTICS role
      const scenario = await createTestScenario({
        userName: 'Audit Perf User',
        userEmail: 'auditperf@example.com',
        role: 'ADMIN',
      })

      // Warm up
      await app.request('/api/audits', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/audits', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.list)

      console.log(`GET /api/audits: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.list}ms)`)
    })

    it('GET /api/users with pagination responds under 200ms', async () => {
      const scenario = await createTestScenario({
        userName: 'Pagination Perf User',
        userEmail: 'paginationperf@example.com',
        role: 'VIEWER',
      })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/users?page=1&limit=10', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.list)

      console.log(`GET /api/users (paginated): ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.list}ms)`)
    })

    it('GET /api/users with search query responds under 200ms', async () => {
      const scenario = await createTestScenario({
        userName: 'Search Perf User',
        userEmail: 'searchperf@example.com',
        role: 'VIEWER',
      })

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/users?query=Search', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      )

      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.list)

      console.log(`GET /api/users (search): ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.list}ms)`)
    })
  })

  // ==========================================================================
  // Create Endpoint Performance
  // ==========================================================================

  describe('Create Endpoint Performance (< 300ms)', () => {
    it('POST /api/accounts responds under 300ms', async () => {
      const scenario = await createTestScenario({
        userName: 'Create Perf Admin',
        userEmail: 'createperfadmin@example.com',
        role: 'ADMIN',
        isSuperAdmin: true,
      })

      // Each test uses a unique account name
      const uniqueName = `Performance Test Account ${Date.now()}`

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: uniqueName,
            description: 'Performance test account',
          }),
        })
      )

      expect(res.status).toBe(201)
      expect(durationMs).toBeLessThan(THRESHOLDS.create)

      console.log(`POST /api/accounts: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.create}ms)`)
    })

    it('POST /api/invitations responds under 300ms', async () => {
      const scenario = await createTestScenario({
        userName: 'Invite Perf Admin',
        userEmail: 'inviteperfadmin@example.com',
        role: 'ADMIN',
      })

      const uniqueEmail = `invite-perf-${Date.now()}@example.com`

      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: uniqueEmail,
            role: 'VIEWER',
          }),
        })
      )

      // Invitations endpoint returns 200 on success
      expect(res.status).toBe(200)
      expect(durationMs).toBeLessThan(THRESHOLDS.create)

      console.log(`POST /api/invitations: ${durationMs.toFixed(2)}ms (threshold: ${THRESHOLDS.create}ms)`)
    })
  })

  // ==========================================================================
  // Performance Under Load
  // ==========================================================================

  describe('Performance Under Load', () => {
    it('list endpoints maintain performance with multiple sequential requests', async () => {
      const scenario = await createTestScenario({
        userName: 'Sequential Perf User',
        userEmail: 'sequentialperf@example.com',
        role: 'VIEWER',
      })

      const requestCount = 5
      const times: number[] = []

      for (let i = 0; i < requestCount; i++) {
        const { result: res, durationMs } = await measureTime(() =>
          app.request('/api/users', {
            method: 'GET',
            headers: {
              ...scenario.headers,
              'User-Agent': 'IntegrationTest/1.0',
              'account-id': scenario.account.id,
            },
          })
        )

        expect(res.status).toBe(200)
        times.push(durationMs)
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)

      // Average should be under threshold
      expect(avgTime).toBeLessThan(THRESHOLDS.list)

      // No single request should be significantly slower (2x threshold)
      expect(maxTime).toBeLessThan(THRESHOLDS.list * 2)

      console.log(
        `${requestCount} sequential requests: ` +
          `avg ${avgTime.toFixed(2)}ms, max ${maxTime.toFixed(2)}ms`
      )
    })

    it('multiple endpoints respond efficiently in parallel', async () => {
      // Use ADMIN role as audits endpoint requires ADMIN or ANALYTICS role
      const scenario = await createTestScenario({
        userName: 'Parallel Perf User',
        userEmail: 'parallelperf@example.com',
        role: 'ADMIN',
      })

      const headers = {
        ...scenario.headers,
        'User-Agent': 'IntegrationTest/1.0',
        'account-id': scenario.account.id,
      }

      const { durationMs } = await measureTime(async () => {
        const [usersRes, accountsRes, auditsRes] = await Promise.all([
          app.request('/api/users', { method: 'GET', headers }),
          app.request('/api/accounts', { method: 'GET', headers }),
          app.request('/api/audits', { method: 'GET', headers }),
        ])

        expect(usersRes.status).toBe(200)
        expect(accountsRes.status).toBe(200)
        expect(auditsRes.status).toBe(200)
      })

      // Total time for 3 parallel requests should be roughly same as single request
      expect(durationMs).toBeLessThan(THRESHOLDS.list * 1.5)

      console.log(`3 parallel list requests: ${durationMs.toFixed(2)}ms`)
    })
  })

  // ==========================================================================
  // Response Size Considerations
  // ==========================================================================

  describe('Response Size Impact on Performance', () => {
    it('large result sets still respond within threshold', async () => {
      const scenario = await createTestScenario({
        userName: 'Large Set Perf User',
        userEmail: 'largesetperf@example.com',
        role: 'VIEWER',
      })

      // Request a larger page size
      const { result: res, durationMs } = await measureTime(() =>
        app.request('/api/users?limit=50', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
      )

      expect(res.status).toBe(200)
      // Allow slightly more time for larger results
      expect(durationMs).toBeLessThan(THRESHOLDS.list * 1.5)

      console.log(`GET /api/users (limit=50): ${durationMs.toFixed(2)}ms`)
    })
  })
})
