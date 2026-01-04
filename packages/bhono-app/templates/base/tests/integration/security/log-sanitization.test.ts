/**
 * Log Sanitization Security Tests
 *
 * Tests that sensitive data is properly sanitized from logs to prevent
 * information disclosure through logging systems:
 * - Passwords should never appear in logs
 * - JWT tokens should not be exposed in logs
 * - API keys should not be logged
 * - Session IDs should not appear in error responses
 * - User credentials should be masked in audit logs
 *
 * Security rationale:
 * Logs are often stored in centralized systems (CloudWatch, Datadog, etc.)
 * with different access controls than the application database. Leaking
 * sensitive data to logs can expose credentials to unauthorized personnel.
 */

import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import { createTestScenario } from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { auth } from '../../../src/server/routes/auth'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { requestLogger } from '../../../src/server/middleware/request-logger'
import { sessionMiddleware } from '../../../src/server/lib/session'

/**
 * Creates a database wrapper that adds the `execute` method
 */
function createTestDb() {
  return getDb()
}

describe('Log Sanitization', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let capturedLogs: string[]

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      // Inject environment bindings
      ;(c as any).env = env

      // Set up database
      const db = createTestDb()
      c.set('db', db)

      // Set up request context variables
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Request logger middleware
    app.use('*', requestLogger())

    // Session middleware
    app.use('*', sessionMiddleware())

    // Mount auth routes
    app.route('/auth', auth)

    // Mount API routes
    app.route('/api', api)
  })

  beforeEach(() => {
    capturedLogs = []
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      capturedLogs.push(args.map(String).join(' '))
    })
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  // ============================================================================
  // Password Sanitization Tests
  // ============================================================================

  describe('Password Sanitization', () => {
    it('should not log passwords in request bodies', async () => {
      // Simulate a request that might contain a password field
      // (even though this API uses OAuth, test the sanitization behavior)
      const sensitivePayload = {
        email: 'test@example.com',
        password: 'super-secret-password-123!',
        name: 'Test User',
      }

      // Make a request that would fail (invalid endpoint, but tests logging)
      await app.request('/api/nonexistent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify(sensitivePayload),
      })

      // Check all captured logs for password exposure
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain('super-secret-password-123!')
      expect(allLogs).not.toContain(sensitivePayload.password)
    })

    it('should not include password-like fields in error details', async () => {
      const scenario = await createTestScenario({
        userName: 'Password Log Test',
        userEmail: 'password-log@example.com',
        role: 'VIEWER',
      })

      // Make a request with password-like data in various fields
      const res = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test',
          secretPassword: 'my-secret-pass',
          credentials: { apiKey: 'sk-12345' },
        }),
      })

      // Check response doesn't expose password fields
      const body = await res.text()
      expect(body).not.toContain('my-secret-pass')

      // Check logs don't expose password fields
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain('my-secret-pass')
    })

    it('should not log password reset tokens in error messages', async () => {
      const resetToken = 'reset-token-abc123xyz789'

      // Attempt to use an invalid reset token (simulated endpoint)
      const res = await app.request(`/auth/reset-password?token=${resetToken}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // The reset token should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(resetToken)
    })
  })

  // ============================================================================
  // JWT Token Sanitization Tests
  // ============================================================================

  describe('JWT Token Sanitization', () => {
    it('should not log JWT tokens from Authorization headers', async () => {
      const fakeJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'

      // Make request with JWT in header
      await app.request('/api/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fakeJwt}`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // JWT should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(fakeJwt)
      expect(allLogs).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })

    it('should not expose JWT tokens in error responses', async () => {
      const fakeJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalid'

      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fakeJwt}`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const body = await res.text()

      // Error response should not include the JWT
      expect(body).not.toContain(fakeJwt)
      expect(body).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })

    it('should not log refresh tokens', async () => {
      const refreshToken = 'rt_' + crypto.randomUUID().replaceAll('-', '')

      // Attempt to use refresh token
      await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({ refreshToken }),
      })

      // Refresh token should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(refreshToken)
    })
  })

  // ============================================================================
  // API Key Sanitization Tests
  // ============================================================================

  describe('API Key Sanitization', () => {
    it('should not log API keys from headers', async () => {
      const apiKey = 'sk_live_abcdef123456789'

      await app.request('/api/users', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // API key should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(apiKey)
      expect(allLogs).not.toContain('sk_live_')
    })

    it('should not log API keys from request body', async () => {
      const apiKey = 'api_key_secret_12345'

      await app.request('/api/nonexistent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({
          apiKey: apiKey,
          data: 'some data',
        }),
      })

      // API key should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(apiKey)
    })

    it('should not expose SendGrid API key in error messages', async () => {
      // Attempt a request that might trigger email-related errors
      const scenario = await createTestScenario({
        userName: 'API Key Test User',
        userEmail: 'apikey-test@example.com',
        role: 'ADMIN',
      })

      await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invite@example.com',
          role: 'VIEWER',
        }),
      })

      // SendGrid API key should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(env.SENDGRID_API_KEY)
    })
  })

  // ============================================================================
  // Session ID Sanitization Tests
  // ============================================================================

  describe('Session ID Sanitization', () => {
    it('should not expose session IDs in error responses', async () => {
      const fakeSessionId = crypto.randomUUID()

      // Make request with session cookie
      const res = await app.request('/api/users', {
        method: 'GET',
        headers: {
          'Cookie': `sid=${fakeSessionId}`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Error response should not include the session ID
      const body = await res.text()
      expect(body).not.toContain(fakeSessionId)
    })

    it('should not log full session IDs', async () => {
      const scenario = await createTestScenario({
        userName: 'Session Log Test',
        userEmail: 'session-log@example.com',
        role: 'VIEWER',
      })

      await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Full session ID should not appear in logs
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(scenario.sessionId)
    })

    it('should not include session cookie in logged request details', async () => {
      const sessionId = crypto.randomUUID()

      await app.request('/api/accounts', {
        method: 'GET',
        headers: {
          'Cookie': `sid=${sessionId}; other=value`,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Check logs don't contain the session ID
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(sessionId)
    })
  })

  // ============================================================================
  // Audit Log Credential Masking Tests
  // ============================================================================

  describe('Audit Log Credential Masking', () => {
    it('should not store raw tokens in audit logs', async () => {
      const scenario = await createTestScenario({
        userName: 'Audit Token Test',
        userEmail: 'audit-token@example.com',
        role: 'ADMIN',
      })

      // Create an invitation (which generates a token)
      await app.request('/api/invitations', {
        method: 'POST',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invitee-audit@example.com',
          role: 'VIEWER',
        }),
      })

      // Check audit logs for token exposure
      const sqlite = getSqlite()
      const auditLogs = sqlite
        .prepare('SELECT changes FROM audit_logs WHERE entity = ?')
        .all('Invitation') as { changes: string }[]

      for (const log of auditLogs) {
        if (log.changes) {
          const changes = JSON.parse(log.changes)
          // If token is logged, it should be hashed or masked
          if (changes.token) {
            // Token should not be a raw UUID format
            expect(changes.token).not.toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
          }
        }
      }
    })

    it('should not expose sensitive data in audit log changes field', async () => {
      const scenario = await createTestScenario({
        userName: 'Audit Email Test',
        userEmail: 'audit-email-test@example.com',
        role: 'MANAGER',
      })

      // Update user (triggers audit)
      const updateRes = await app.request(`/api/users/${scenario.user.id}`, {
        method: 'PATCH',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      })

      expect(updateRes.status).toBe(200)

      // Check that any audit logs that exist don't contain sensitive patterns
      const sqlite = getSqlite()
      const allAuditLogs = sqlite
        .prepare('SELECT changes FROM audit_logs')
        .all() as { changes: string | null }[]

      for (const log of allAuditLogs) {
        if (log.changes) {
          const changesStr = log.changes.toLowerCase()
          // Audit logs should not contain password-like fields
          expect(changesStr).not.toContain('"password"')
          expect(changesStr).not.toContain('"secret"')
          expect(changesStr).not.toContain('"apikey"')
          expect(changesStr).not.toContain('"api_key"')
        }
      }
    })

    it('should not store OAuth tokens in audit logs', async () => {
      // After login, check audit logs don't contain OAuth tokens
      const res = await app.request('/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntegrationTest/1.0',
        },
        body: JSON.stringify({
          email: 'oauth-audit@example.com',
          name: 'OAuth Audit Test',
        }),
      })

      expect(res.status).toBe(200)

      // Check audit logs don't contain OAuth tokens
      const sqlite = getSqlite()
      const auditLogs = sqlite
        .prepare('SELECT changes FROM audit_logs WHERE action IN (?, ?, ?)')
        .all('LOGIN', 'SIGNUP', 'TOKEN_REFRESH') as { changes: string }[]

      for (const log of auditLogs) {
        if (log.changes) {
          const changesStr = log.changes.toLowerCase()
          expect(changesStr).not.toContain('access_token')
          expect(changesStr).not.toContain('refresh_token')
          expect(changesStr).not.toContain('id_token')
        }
      }
    })
  })

  // ============================================================================
  // Error Stack Trace Sanitization Tests
  // ============================================================================

  describe('Error Stack Trace Sanitization', () => {
    it('should not expose environment variables in stack traces', async () => {
      // Make a request that might cause an error
      await app.request('/api/nonexistent/path', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      // Check logs don't contain environment variable values
      const allLogs = capturedLogs.join(' ')
      expect(allLogs).not.toContain(env.JWT_SECRET)
      expect(allLogs).not.toContain(env.GOOGLE_CLIENT_SECRET)
      expect(allLogs).not.toContain(env.SENDGRID_API_KEY)
    })

    it('should truncate stack traces to prevent information disclosure', async () => {
      // Force an error that generates a stack trace
      const scenario = await createTestScenario({
        userName: 'Stack Trace Test',
        userEmail: 'stack-trace@example.com',
        role: 'VIEWER',
      })

      // Access non-existent resource
      await app.request(`/api/users/${crypto.randomUUID()}`, {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Error handler logs stack traces truncated to 500 chars
      const errorLogs = capturedLogs.filter((log) => log.includes('ERROR_HANDLER'))
      for (const log of errorLogs) {
        try {
          const parsed = JSON.parse(log)
          if (parsed.stack) {
            expect(parsed.stack.length).toBeLessThanOrEqual(500)
          }
        } catch {
          // Not JSON, skip
        }
      }
    })

    it('should not include internal file paths that reveal server structure', async () => {
      const res = await app.request('/api/users/invalid-id-format', {
        method: 'GET',
        headers: {
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      const body = await res.text()

      // Error response should not include internal paths
      expect(body).not.toContain('/src/')
      expect(body).not.toContain('/node_modules/')
      expect(body).not.toContain('at Object.')
      expect(body).not.toContain('.ts:')
    })
  })

  // ============================================================================
  // Request Logger Field Validation Tests
  // ============================================================================

  describe('Request Logger Field Validation', () => {
    it('should only log safe, non-sensitive request fields', async () => {
      const scenario = await createTestScenario({
        userName: 'Safe Fields Test',
        userEmail: 'safe-fields@example.com',
        role: 'VIEWER',
      })

      await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
          'X-Custom-Secret': 'custom-secret-value',
          'Authorization': 'Bearer secret-token',
        },
      })

      // Find the request log entry
      const requestLogs = capturedLogs.filter((log) => {
        try {
          const parsed = JSON.parse(log)
          return parsed.method && parsed.path && parsed.status
        } catch {
          return false
        }
      })

      expect(requestLogs.length).toBeGreaterThan(0)

      for (const logStr of requestLogs) {
        const log = JSON.parse(logStr)

        // Should have safe fields
        expect(log).toHaveProperty('method')
        expect(log).toHaveProperty('path')
        expect(log).toHaveProperty('status')
        expect(log).toHaveProperty('duration')
        expect(log).toHaveProperty('transactionId')

        // Should not have sensitive fields
        expect(log).not.toHaveProperty('authorization')
        expect(log).not.toHaveProperty('cookie')
        expect(log).not.toHaveProperty('body')
        expect(log).not.toHaveProperty('headers')

        // Should not contain secret values
        expect(JSON.stringify(log)).not.toContain('custom-secret-value')
        expect(JSON.stringify(log)).not.toContain('secret-token')
      }
    })

    it('should include userId but not full session data', async () => {
      const scenario = await createTestScenario({
        userName: 'User ID Log Test',
        userEmail: 'userid-log@example.com',
        role: 'VIEWER',
      })

      await app.request('/api/users', {
        method: 'GET',
        headers: {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        },
      })

      // Find request logs with userId
      const requestLogs = capturedLogs.filter((log) => {
        try {
          const parsed = JSON.parse(log)
          return parsed.userId !== undefined
        } catch {
          return false
        }
      })

      for (const logStr of requestLogs) {
        const log = JSON.parse(logStr)

        // Should have userId
        if (log.userId) {
          expect(log.userId).toBe(scenario.user.id)
        }

        // Should not have full session data
        expect(log).not.toHaveProperty('sessionData')
        expect(log).not.toHaveProperty('session')
        expect(log).not.toHaveProperty('email')
        expect(log).not.toHaveProperty('name')
      }
    })
  })
})
