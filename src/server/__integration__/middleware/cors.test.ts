/**
 * CORS Middleware Integration Tests
 *
 * Tests the configurable CORS middleware:
 * - Origin validation
 * - Credentials handling
 * - Allowed headers and methods
 * - OPTIONS preflight requests
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { configurableCors } from '../../middleware/cors'

describe('CORS Middleware Integration', () => {
  describe('configurableCors with explicit origins', () => {
    let app: Hono

    beforeAll(() => {
      app = new Hono()

      app.use(
        '*',
        configurableCors({
          corsOrigins: ['http://localhost:3000', 'http://localhost:5173', 'https://app.example.com'],
          appUrl: 'http://localhost:8787',
        })
      )

      app.get('/api/test', (c) => c.json({ message: 'success' }))
      app.post('/api/test', (c) => c.json({ message: 'created' }))
      app.options('/api/test', (c) => c.text('OK'))
    })

    it('should allow requests from whitelisted origins', async () => {
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })

    it('should allow multiple whitelisted origins', async () => {
      const origins = ['http://localhost:3000', 'http://localhost:5173', 'https://app.example.com']

      for (const origin of origins) {
        const res = await app.request('/api/test', {
          method: 'GET',
          headers: { Origin: origin },
        })

        expect(res.status).toBe(200)
        expect(res.headers.get('access-control-allow-origin')).toBe(origin)
      }
    })

    it('should reject requests from non-whitelisted origins', async () => {
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: {
          Origin: 'http://malicious-site.com',
        },
      })

      expect(res.status).toBe(200) // Request still succeeds
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('should handle requests without Origin header', async () => {
      const res = await app.request('/api/test', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('should include credentials header', async () => {
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    })

    it('should handle OPTIONS preflight requests', async () => {
      const res = await app.request('/api/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      })

      expect(res.status).toBeLessThan(400)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
      expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    })

    it('should include allowed headers', async () => {
      const res = await app.request('/api/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      })

      const allowedHeaders = res.headers.get('access-control-allow-headers')
      expect(allowedHeaders).toContain('Content-Type')
      expect(allowedHeaders).toContain('Authorization')
      expect(allowedHeaders).toContain('Account-ID')
    })

    it('should include all allowed methods', async () => {
      const res = await app.request('/api/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'DELETE',
        },
      })

      const allowedMethods = res.headers.get('access-control-allow-methods')
      expect(allowedMethods).toContain('GET')
      expect(allowedMethods).toContain('POST')
      expect(allowedMethods).toContain('PUT')
      expect(allowedMethods).toContain('PATCH')
      expect(allowedMethods).toContain('DELETE')
      expect(allowedMethods).toContain('OPTIONS')
    })
  })

  describe('configurableCors with empty origins (fallback to appUrl)', () => {
    let app: Hono

    beforeAll(() => {
      app = new Hono()

      app.use(
        '*',
        configurableCors({
          corsOrigins: [],
          appUrl: 'http://localhost:8787',
        })
      )

      app.get('/api/test', (c) => c.json({ message: 'success' }))
    })

    it('should fallback to appUrl when corsOrigins is empty', async () => {
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:8787',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8787')
    })

    it('should reject other origins when corsOrigins is empty', async () => {
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })
  })

  describe('CORS with different request methods', () => {
    let app: Hono

    beforeAll(() => {
      app = new Hono()

      app.use(
        '*',
        configurableCors({
          corsOrigins: ['http://localhost:3000'],
          appUrl: 'http://localhost:8787',
        })
      )

      app.get('/api/data', (c) => c.json({ method: 'GET' }))
      app.post('/api/data', (c) => c.json({ method: 'POST' }))
      app.put('/api/data', (c) => c.json({ method: 'PUT' }))
      app.patch('/api/data', (c) => c.json({ method: 'PATCH' }))
      app.delete('/api/data', (c) => c.json({ method: 'DELETE' }))
    })

    it('should handle GET requests with CORS', async () => {
      const res = await app.request('/api/data', {
        method: 'GET',
        headers: { Origin: 'http://localhost:3000' },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })

    it('should handle POST requests with CORS', async () => {
      const res = await app.request('/api/data', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: 'test' }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })

    it('should handle PUT requests with CORS', async () => {
      const res = await app.request('/api/data', {
        method: 'PUT',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: 'updated' }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })

    it('should handle DELETE requests with CORS', async () => {
      const res = await app.request('/api/data', {
        method: 'DELETE',
        headers: { Origin: 'http://localhost:3000' },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    })
  })

  describe('CORS edge cases', () => {
    it('should handle origin with trailing slash', async () => {
      const app = new Hono()

      app.use(
        '*',
        configurableCors({
          corsOrigins: ['http://localhost:3000'], // No trailing slash
          appUrl: 'http://localhost:8787',
        })
      )

      app.get('/api/test', (c) => c.json({ success: true }))

      // Origin with trailing slash should not match
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: { Origin: 'http://localhost:3000/' }, // Trailing slash
      })

      expect(res.status).toBe(200)
      // Exact match required, so this should be null
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('should handle case-sensitive origins', async () => {
      const app = new Hono()

      app.use(
        '*',
        configurableCors({
          corsOrigins: ['http://localhost:3000'],
          appUrl: 'http://localhost:8787',
        })
      )

      app.get('/api/test', (c) => c.json({ success: true }))

      // Different case should not match
      const res = await app.request('/api/test', {
        method: 'GET',
        headers: { Origin: 'http://LOCALHOST:3000' },
      })

      expect(res.status).toBe(200)
      // URLs are case-insensitive for host, but we do exact string match
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('should handle subdomain correctly', async () => {
      const app = new Hono()

      app.use(
        '*',
        configurableCors({
          corsOrigins: ['https://app.example.com'],
          appUrl: 'https://example.com',
        })
      )

      app.get('/api/test', (c) => c.json({ success: true }))

      // Subdomain should match if explicitly listed
      const res1 = await app.request('/api/test', {
        method: 'GET',
        headers: { Origin: 'https://app.example.com' },
      })

      expect(res1.headers.get('access-control-allow-origin')).toBe('https://app.example.com')

      // Different subdomain should not match
      const res2 = await app.request('/api/test', {
        method: 'GET',
        headers: { Origin: 'https://other.example.com' },
      })

      expect(res2.headers.get('access-control-allow-origin')).toBeNull()
    })
  })
})
