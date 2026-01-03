/**
 * Production Behavior Integration Tests
 *
 * Tests that verify the application behaves correctly when running in production mode.
 * These tests mock the production environment to ensure:
 * - Development-only endpoints are disabled
 * - Error messages are sanitized (no stack traces exposed)
 * - Debug headers are not exposed
 * - CORS is properly configured for production origins
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getEnv, getDb, type TestEnv } from '../setup'
import type { HonoEnv } from '../../types'
import { auth } from '../../routes/auth'
import { errorHandler } from '../../middleware/error-handler'
import { configurableCors } from '../../middleware/cors'
import { sessionMiddleware } from '../../lib/session'
import { secureHeaders } from 'hono/secure-headers'
import { uuidv7 } from 'uuidv7'

/**
 * Creates a database wrapper that adds the `execute` method
 * The better-sqlite3 drizzle doesn't have execute, but D1 does
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

/**
 * Creates a test environment configured for production
 */
function createProductionEnv(): TestEnv {
  const baseEnv = getEnv()
  return {
    ...baseEnv,
    ENVIRONMENT: 'production',
    APP_URL: 'https://app.production.example.com',
    CORS_ORIGINS: 'https://app.production.example.com,https://admin.production.example.com',
  }
}

/**
 * Creates a test app configured with production environment
 */
function createProductionApp(): Hono<HonoEnv> {
  const productionEnv = createProductionEnv()
  const app = new Hono<HonoEnv>()

  // Error handler
  app.onError(errorHandler)

  // Inject production environment
  app.use('*', async (c, next) => {
    ;(c as any).env = productionEnv

    // Set up database
    c.set('db', createTestDb())

    // Set up request context variables
    c.set('transactionId', uuidv7())
    c.set('ip', '127.0.0.1')
    c.set('userAgent', 'IntegrationTest/1.0')

    await next()
  })

  // CORS middleware
  app.use('*', async (c, next) => {
    const corsOrigins = productionEnv.CORS_ORIGINS
      ? productionEnv.CORS_ORIGINS.split(',').map((o) => o.trim())
      : []
    return configurableCors({
      corsOrigins,
      appUrl: productionEnv.APP_URL,
    })(c, next)
  })

  // Security headers
  app.use('*', secureHeaders())

  // Session middleware
  app.use('*', sessionMiddleware())

  // Mount auth routes
  app.route('/auth', auth)

  // Test route that throws an error (for error sanitization tests)
  app.get('/api/test/error', () => {
    throw new Error('Sensitive internal error with stack trace')
  })

  // Test route that throws an HTTPException
  app.get('/api/test/http-error', () => {
    throw new HTTPException(500, { message: 'Internal server error' })
  })

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }))

  return app
}

describe('Production Behavior', () => {
  let productionApp: Hono<HonoEnv>

  beforeAll(() => {
    productionApp = createProductionApp()
  })

  // ============================================================================
  // Test Login Endpoint Disabled in Production
  // ============================================================================

  describe('Test Login Endpoint in Production', () => {
    it('should return 403 when test-login is called in production', async () => {
      const res = await productionApp.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({
          email: 'attacker@example.com',
          name: 'Attacker',
        }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toBeDefined()
      expect(body.error.message).toBe('Not available in production')
    })

    it('should return 403 regardless of valid user data in production', async () => {
      const res = await productionApp.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({
          email: 'admin@company.com',
          name: 'Admin User',
        }),
      })

      expect(res.status).toBe(403)
    })

    it('should work in non-production environment (test)', async () => {
      // Create a test environment app
      const testEnv = getEnv() // Default test env has ENVIRONMENT: 'test'
      const testApp = new Hono<HonoEnv>()

      testApp.onError(errorHandler)

      testApp.use('*', async (c, next) => {
        ;(c as any).env = testEnv
        c.set('db', createTestDb())
        c.set('transactionId', uuidv7())
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'IntegrationTest/1.0')
        await next()
      })

      testApp.use('*', sessionMiddleware())
      testApp.route('/auth', auth)

      const res = await testApp.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
          name: 'Test User',
        }),
      })

      expect(res.status).toBe(200)
    })

    it('should work in staging environment', async () => {
      const stagingEnv = {
        ...getEnv(),
        ENVIRONMENT: 'staging',
      }
      const stagingApp = new Hono<HonoEnv>()

      stagingApp.onError(errorHandler)

      stagingApp.use('*', async (c, next) => {
        ;(c as any).env = stagingEnv
        c.set('db', createTestDb())
        c.set('transactionId', uuidv7())
        c.set('ip', '127.0.0.1')
        c.set('userAgent', 'IntegrationTest/1.0')
        await next()
      })

      stagingApp.use('*', sessionMiddleware())
      stagingApp.route('/auth', auth)

      const res = await stagingApp.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({
          email: 'staging-user@example.com',
          name: 'Staging User',
        }),
      })

      expect(res.status).toBe(200)
    })
  })

  // ============================================================================
  // Error Message Sanitization in Production
  // ============================================================================

  describe('Error Message Sanitization', () => {
    it('should not expose stack traces in error responses', async () => {
      const res = await productionApp.request('http://localhost:8787/api/test/error', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(500)

      const body = await res.json()

      // Should have a sanitized error message
      expect(body.error).toBeDefined()
      expect(body.error.message).toBe('Internal server error')

      // Should NOT contain stack trace in the response body
      expect(JSON.stringify(body)).not.toContain('at ')
      expect(JSON.stringify(body)).not.toContain('.ts:')
      expect(JSON.stringify(body)).not.toContain('.js:')
      expect(JSON.stringify(body)).not.toContain('Sensitive internal error')
    })

    it('should return generic error message for unhandled errors', async () => {
      const res = await productionApp.request('http://localhost:8787/api/test/error', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const body = await res.json()

      // Generic error message, not the actual error
      expect(body.error.message).toBe('Internal server error')
      expect(body.error.status).toBe(500)
    })

    it('should return HTTPException message when explicitly set', async () => {
      const res = await productionApp.request('http://localhost:8787/api/test/http-error', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error.message).toBe('Internal server error')
    })

    it('should include error code and timestamp but not stack', async () => {
      const res = await productionApp.request('http://localhost:8787/api/test/error', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const body = await res.json()

      // Should have standard error fields
      expect(body.error.code).toBeDefined()
      expect(body.error.timestamp).toBeDefined()
      expect(body.error.status).toBe(500)

      // Should NOT have stack or internal details
      expect(body.error.stack).toBeUndefined()
      expect(body.error.cause).toBeUndefined()
    })
  })

  // ============================================================================
  // Debug Headers Not Exposed in Production
  // ============================================================================

  describe('Debug Headers Not Exposed', () => {
    it('should not expose X-Transaction-ID header in production', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)

      // Should NOT expose transaction ID in headers
      expect(res.headers.get('x-transaction-id')).toBeNull()
      expect(res.headers.get('X-Transaction-ID')).toBeNull()
    })

    it('should not expose X-Debug headers in production', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Check for common debug headers that should NOT be present
      expect(res.headers.get('x-debug')).toBeNull()
      expect(res.headers.get('x-debug-info')).toBeNull()
      expect(res.headers.get('x-request-id')).toBeNull()
      expect(res.headers.get('x-powered-by')).toBeNull()
    })

    it('should not expose server version headers', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Server header should not expose version info
      const serverHeader = res.headers.get('server')
      if (serverHeader) {
        // If present, should not contain version numbers
        expect(serverHeader).not.toMatch(/\d+\.\d+/)
      }
    })

    it('should have security headers from secureHeaders middleware', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Should have security headers
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    })
  })

  // ============================================================================
  // CORS Configuration for Production Origins
  // ============================================================================

  describe('CORS Configuration for Production Origins', () => {
    it('should allow requests from configured production origins', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'Origin': 'https://app.production.example.com',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://app.production.example.com'
      )
    })

    it('should allow requests from secondary production origin', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'Origin': 'https://admin.production.example.com',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://admin.production.example.com'
      )
    })

    it('should NOT allow requests from unauthorized origins', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'Origin': 'https://malicious.example.com',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200) // Request still succeeds

      // But CORS header should NOT include the malicious origin
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('should NOT allow requests from localhost in production', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)

      // Localhost should not be allowed in production CORS
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('should handle OPTIONS preflight request for production origins', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://app.production.example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Preflight should succeed
      expect(res.status).toBe(204)

      // Should have CORS headers for the allowed origin
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://app.production.example.com'
      )
      expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    })

    it('should include credentials support in CORS', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'Origin': 'https://app.production.example.com',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    })

    it('should not expose wildcard origin in production', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'GET',
        headers: {
          'Origin': 'https://app.production.example.com',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Should never return wildcard in production
      expect(res.headers.get('access-control-allow-origin')).not.toBe('*')
    })

    it('should allow Account-ID header in CORS', async () => {
      const res = await productionApp.request('http://localhost:8787/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://app.production.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Account-ID',
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const allowHeaders = res.headers.get('access-control-allow-headers')
      expect(allowHeaders).toContain('Account-ID')
    })
  })

  // ============================================================================
  // Environment-Specific Behavior Verification
  // ============================================================================

  describe('Environment Detection', () => {
    it('should correctly identify production environment', async () => {
      // The test-login endpoint is the canonical way to check production detection
      const res = await productionApp.request('http://localhost:8787/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      })

      // 403 means production was correctly detected
      expect(res.status).toBe(403)
    })

    it('should allow normal authentication flow in production', async () => {
      // The /auth/login endpoint (OAuth initiation) should still work
      const res = await productionApp.request('http://localhost:8787/auth/login', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Should redirect to Google OAuth (302) not be disabled
      expect(res.status).toBe(302)
    })
  })
})
