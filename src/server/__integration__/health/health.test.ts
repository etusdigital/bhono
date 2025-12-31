/**
 * Health Check Integration Tests
 *
 * Tests the health check endpoints against the real test infrastructure:
 * - In-memory SQLite database (D1-compatible)
 * - Mock R2 bucket
 *
 * Endpoints tested:
 * - GET /health - Overall health check with dependency status
 * - GET /health/ready - Readiness probe (database connectivity)
 * - GET /health/live - Liveness probe (process alive)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import type { HonoEnv } from '../../types'
import { health } from '../../routes/health'

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
 * We add it as an alias to `run` for test compatibility
 */
function createTestDb() {
  const db = getDb()
  // Add execute method that delegates to run (both execute statements)
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'execute') {
        return target.run.bind(target)
      }
      return (target as any)[prop]
    },
  })
}

describe('Health Check Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up middleware to inject test environment and database
    app.use('*', async (c, next) => {
      // Inject environment bindings (cast to any to allow assignment)
      ;(c as any).env = env

      // Use a wrapped drizzle instance that has execute method for D1 compatibility
      const db = createTestDb()
      c.set('db', db)

      await next()
    })

    // Mount health routes
    app.route('/health', health)
  })

  describe('GET /health', () => {
    it('should return 200 with healthy status when all services are up', async () => {
      const res = await app.request('/health', { method: 'GET' })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('healthy')
    })

    it('should include checks object with database and storage status', async () => {
      const res = await app.request('/health', { method: 'GET' })
      const body = await res.json()

      expect(body).toHaveProperty('checks')
      expect(body.checks).toHaveProperty('database')
      expect(body.checks).toHaveProperty('storage')

      // With our test infrastructure, both should be up
      expect(body.checks.database).toBe('up')
      expect(body.checks.storage).toBe('up')
    })

    it('should include timestamp in ISO format', async () => {
      const beforeRequest = new Date()
      const res = await app.request('/health', { method: 'GET' })
      const afterRequest = new Date()

      const body = await res.json()

      expect(body).toHaveProperty('timestamp')

      // Validate timestamp is a valid ISO string
      const timestamp = new Date(body.timestamp)
      expect(timestamp.toString()).not.toBe('Invalid Date')

      // Timestamp should be within the request window
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000)
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000)
    })

    it('should include uptime field', async () => {
      const res = await app.request('/health', { method: 'GET' })
      const body = await res.json()

      expect(body).toHaveProperty('uptime')
      expect(typeof body.uptime).toBe('number')
    })

    it('should return complete health response structure', async () => {
      const res = await app.request('/health', { method: 'GET' })
      const body = await res.json()

      // Verify all required fields are present
      expect(body).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        checks: {
          database: expect.stringMatching(/^(up|down)$/),
          storage: expect.stringMatching(/^(up|down)$/),
        },
        uptime: expect.any(Number),
      })
    })
  })

  describe('GET /health/ready', () => {
    it('should return 200 when database is connected', async () => {
      const res = await app.request('/health/ready', { method: 'GET' })

      expect(res.status).toBe(200)
    })

    it('should return ready: true when database is accessible', async () => {
      const res = await app.request('/health/ready', { method: 'GET' })
      const body = await res.json()

      expect(body).toHaveProperty('ready')
      expect(body.ready).toBe(true)
    })

    it('should return proper response structure', async () => {
      const res = await app.request('/health/ready', { method: 'GET' })
      const body = await res.json()

      expect(body).toMatchObject({
        ready: expect.any(Boolean),
      })
    })
  })

  describe('GET /health/live', () => {
    it('should return 200 indicating process is alive', async () => {
      const res = await app.request('/health/live', { method: 'GET' })

      expect(res.status).toBe(200)
    })

    it('should return alive: true', async () => {
      const res = await app.request('/health/live', { method: 'GET' })
      const body = await res.json()

      expect(body).toHaveProperty('alive')
      expect(body.alive).toBe(true)
    })

    it('should always return alive regardless of other service states', async () => {
      // The liveness probe should always succeed if the process is running
      const res = await app.request('/health/live', { method: 'GET' })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.alive).toBe(true)
    })

    it('should return proper response structure', async () => {
      const res = await app.request('/health/live', { method: 'GET' })
      const body = await res.json()

      expect(body).toMatchObject({
        alive: expect.any(Boolean),
      })
    })
  })

  describe('Response Headers', () => {
    it('should return JSON content-type for /health', async () => {
      const res = await app.request('/health', { method: 'GET' })

      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return JSON content-type for /health/ready', async () => {
      const res = await app.request('/health/ready', { method: 'GET' })

      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return JSON content-type for /health/live', async () => {
      const res = await app.request('/health/live', { method: 'GET' })

      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('Error Handling', () => {
    it('should handle /health gracefully even under normal load', async () => {
      // Execute multiple health checks in parallel
      const requests = Array(5)
        .fill(null)
        .map(() => app.request('/health', { method: 'GET' }))

      const responses = await Promise.all(requests)

      // All requests should succeed
      for (const res of responses) {
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.status).toBe('healthy')
      }
    })
  })
})
