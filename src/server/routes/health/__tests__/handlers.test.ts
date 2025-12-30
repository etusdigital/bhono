// src/server/routes/health/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types'
import { health } from '../index'
import { createMockEnv } from '../../../__tests__/setup'

describe('Health Routes', () => {
  let mockEnv: ReturnType<typeof createMockEnv>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
  })

  // Helper to create app with specific db mock
  function createApp(dbMock?: any) {
    const app = new Hono<HonoEnv>()

    // Setup middleware to inject mock environment
    app.use('*', async (c, next) => {
      // Set environment bindings by mutating c.env
      ;(c as any).env = mockEnv
      // Create mock db that supports sql template literal
      const mockDb = dbMock ?? {
        execute: vi.fn().mockResolvedValue({ rows: [{ 1: 1 }] }),
      }
      c.set('db', mockDb)
      await next()
    })

    app.route('/health', health)
    return app
  }

  describe('GET /health', () => {
    it('returns 200 when db and storage are up', async () => {
      // Mock R2 list to succeed
      mockEnv.R2_BUCKET.list = vi.fn().mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      })

      const app = createApp()
      const res = await app.request('/health', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('healthy')
      expect(body.checks.database).toBe('up')
      expect(body.checks.storage).toBe('up')
    })

    it('returns 503 when db is down', async () => {
      // Mock R2 list to succeed
      mockEnv.R2_BUCKET.list = vi.fn().mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      })

      // Create app with failing db
      const failingDb = {
        execute: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      }
      const app = createApp(failingDb)

      const res = await app.request('/health', {
        method: 'GET',
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('unhealthy')
      expect(body.checks.database).toBe('down')
    })

    it('returns 503 when storage is down', async () => {
      // Mock R2 list to fail
      mockEnv.R2_BUCKET.list = vi.fn().mockRejectedValue(new Error('R2 connection failed'))

      const app = createApp()
      const res = await app.request('/health', {
        method: 'GET',
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('unhealthy')
      expect(body.checks.storage).toBe('down')
    })

    it('includes status, timestamp, and checks object', async () => {
      // Mock R2 list to succeed
      mockEnv.R2_BUCKET.list = vi.fn().mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      })

      const app = createApp()
      const res = await app.request('/health', {
        method: 'GET',
      })

      const body = await res.json()

      expect(body).toHaveProperty('status')
      expect(body).toHaveProperty('timestamp')
      expect(body).toHaveProperty('checks')
      expect(body.checks).toHaveProperty('database')
      expect(body.checks).toHaveProperty('storage')
      expect(body).toHaveProperty('uptime')

      // Timestamp should be a valid ISO string
      expect(() => new Date(body.timestamp)).not.toThrow()
    })

    it('returns unhealthy when both db and storage are down', async () => {
      // Mock R2 list to fail
      mockEnv.R2_BUCKET.list = vi.fn().mockRejectedValue(new Error('R2 connection failed'))

      // Create app with failing db
      const failingDb = {
        execute: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      }
      const app = createApp(failingDb)

      const res = await app.request('/health', {
        method: 'GET',
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('unhealthy')
      expect(body.checks.database).toBe('down')
      expect(body.checks.storage).toBe('down')
    })
  })

  describe('GET /health/ready', () => {
    it('returns 200 when db is up', async () => {
      const app = createApp()
      const res = await app.request('/health/ready', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ready).toBe(true)
    })

    it('returns 503 when db is down', async () => {
      // Create app with failing db
      const failingDb = {
        execute: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      }
      const app = createApp(failingDb)

      const res = await app.request('/health/ready', {
        method: 'GET',
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.ready).toBe(false)
    })

    it('returns ready: true structure', async () => {
      const app = createApp()
      const res = await app.request('/health/ready', {
        method: 'GET',
      })

      const body = await res.json()
      expect(body).toHaveProperty('ready')
      expect(typeof body.ready).toBe('boolean')
    })
  })

  describe('GET /health/live', () => {
    it('always returns 200 with alive: true', async () => {
      const app = createApp()
      const res = await app.request('/health/live', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.alive).toBe(true)
    })

    it('returns alive even when db is down', async () => {
      // Create app with failing db
      const failingDb = {
        execute: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      }
      const app = createApp(failingDb)

      const res = await app.request('/health/live', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.alive).toBe(true)
    })

    it('returns alive even when storage is down', async () => {
      // Mock R2 list to fail
      mockEnv.R2_BUCKET.list = vi.fn().mockRejectedValue(new Error('R2 connection failed'))

      const app = createApp()
      const res = await app.request('/health/live', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.alive).toBe(true)
    })

    it('returns alive: true structure', async () => {
      const app = createApp()
      const res = await app.request('/health/live', {
        method: 'GET',
      })

      const body = await res.json()
      expect(body).toHaveProperty('alive')
      expect(typeof body.alive).toBe('boolean')
    })
  })
})
