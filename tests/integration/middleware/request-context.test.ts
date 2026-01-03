/**
 * Integration tests for request-context middleware
 * Tests transactionId, IP, and userAgent extraction
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../../../src/server/types'
import { requestContext } from '../../../src/server/middleware/request-context'

describe('Request Context Middleware', () => {
  let app: Hono<HonoEnv>

  beforeEach(() => {
    app = new Hono<HonoEnv>()

    // Add request context middleware
    app.use('*', requestContext)

    // Add test route that returns context values
    app.get('/test', (c) => {
      return c.json({
        transactionId: c.get('transactionId'),
        ip: c.get('ip'),
        userAgent: c.get('userAgent'),
        user: c.get('user'),
        accountId: c.get('accountId'),
        userRole: c.get('userRole'),
        isSystemAdminAccess: c.get('isSystemAdminAccess'),
      })
    })
  })

  describe('transactionId', () => {
    it('should set a transactionId in context', async () => {
      const res = await app.request('/test')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.transactionId).toBeDefined()
      expect(typeof body.transactionId).toBe('string')
    })

    it('should generate unique transactionIds for each request', async () => {
      const res1 = await app.request('/test')
      const res2 = await app.request('/test')

      const body1 = await res1.json()
      const body2 = await res2.json()

      expect(body1.transactionId).not.toBe(body2.transactionId)
    })

    it('should generate UUIDv7 format transactionIds', async () => {
      const res = await app.request('/test')
      const body = await res.json()

      // UUIDv7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(body.transactionId).toMatch(uuidRegex)
    })
  })

  describe('IP extraction', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      const res = await app.request('/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      })

      const body = await res.json()
      expect(body.ip).toBe('192.168.1.100')
    })

    it('should extract IP from x-real-ip header when x-forwarded-for is absent', async () => {
      const res = await app.request('/test', {
        headers: {
          'x-real-ip': '10.0.0.50',
        },
      })

      const body = await res.json()
      expect(body.ip).toBe('10.0.0.50')
    })

    it('should prefer x-forwarded-for over x-real-ip', async () => {
      const res = await app.request('/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'x-real-ip': '10.0.0.50',
        },
      })

      const body = await res.json()
      expect(body.ip).toBe('192.168.1.100')
    })

    it('should default to "unknown" when no IP headers are present', async () => {
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.ip).toBe('unknown')
    })
  })

  describe('User Agent extraction', () => {
    it('should extract userAgent from user-agent header', async () => {
      const res = await app.request('/test', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      })

      const body = await res.json()
      expect(body.userAgent).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    })

    it('should default to "unknown" when user-agent header is absent', async () => {
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.userAgent).toBe('unknown')
    })
  })

  describe('Context initialization', () => {
    it('should initialize user to null', async () => {
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.user).toBeNull()
    })

    it('should initialize accountId to empty string', async () => {
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.accountId).toBe('')
    })

    it('should initialize userRole to null', async () => {
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.userRole).toBeNull()
    })

    it('should initialize isSystemAdminAccess to false', async () => {
      const res = await app.request('/test')

      const body = await res.json()
      expect(body.isSystemAdminAccess).toBe(false)
    })
  })
})
