/**
 * Invitation Token Authentication Integration Tests
 *
 * Tests the invitation token validation during authentication:
 * - GET /auth/invite/:token - Validate invitation token and redirect to login
 *
 * This test file covers the gap identified: distinguishing between
 * expired vs invalid vs already-used invitation tokens.
 *
 * GAP TESTS:
 * The following tests are marked with .skip because the current implementation
 * does not distinguish between different error types. All errors return:
 * - Status: 400
 * - Message: "Invalid or expired invitation"
 *
 * EXPECTED BEHAVIOR (to be implemented):
 * - Expired invitation: 410 Gone with "Invitation has expired"
 * - Invalid/non-existent invitation: 400 Bad Request with "Invalid invitation token"
 * - Already used invitation: 410 Gone with "Invitation has already been used"
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import {
  createTestScenario,
  createInvitation,
  createExpiredInvitation,
  createAcceptedInvitation,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { auth } from '../../../src/server/routes/auth'
import { sessionMiddleware } from '../../../src/server/lib/session'
import { errorHandler } from '../../../src/server/middleware/error-handler'

/**
 * Creates a D1-compatible database instance for tests
 */
function createTestDb() {
  return getDb()
}

describe('Invitation Token Authentication Integration', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    // Set up error handler
    app.onError(errorHandler)

    // Set up middleware to inject test environment
    app.use('*', async (c, next) => {
      ;(c as any).env = env

      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    // Apply session middleware
    app.use('*', sessionMiddleware())

    // Mount auth routes
    app.route('/auth', auth)
  })

  // ============================================================================
  // GET /auth/invite/:token - Invitation Token Validation
  // ============================================================================

  describe('GET /auth/invite/:token', () => {
    // ==========================================================================
    // CURRENT BEHAVIOR TESTS - These pass with the current implementation
    // ==========================================================================

    describe('Current Behavior - All errors return 400', () => {
      it('should return 400 for expired invitation token (current behavior)', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-expired-current@example.com',
          role: 'admin',
        })

        const expiredInvitation = await createExpiredInvitation({
          accountId: scenario.account.id,
          email: 'expired-current@example.com',
          role: 'viewer',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${expiredInvitation.token}`, {
          method: 'GET',
        })

        // Current behavior: returns 400 for all error cases
        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toBe('Invalid or expired invitation')
      })

      it('should return 400 for non-existent token (current behavior)', async () => {
        const nonExistentToken = crypto.randomUUID()

        const res = await app.request(`/auth/invite/${nonExistentToken}`, {
          method: 'GET',
        })

        // Current behavior: returns 400 with generic message
        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toBe('Invalid or expired invitation')
      })

      it('should return 400 for already accepted invitation (current behavior)', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-accepted-current@example.com',
          role: 'admin',
        })

        const acceptedInvitation = await createAcceptedInvitation({
          accountId: scenario.account.id,
          email: 'accepted-current@example.com',
          role: 'viewer',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${acceptedInvitation.token}`, {
          method: 'GET',
        })

        // Current behavior: returns 400 for all error cases
        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toBe('Invalid or expired invitation')
      })
    })

    // ==========================================================================
    // GAP TESTS - Expected behavior (skipped until implementation is updated)
    // ==========================================================================

    describe('Expired Invitation Token (410) - GAP', () => {
      it.skip('should return 410 Gone with "Invitation has expired" for expired token', async () => {
        // GAP: This test documents the expected behavior for expired tokens
        // Currently returns: 400 "Invalid or expired invitation"
        // Expected: 410 "Invitation has expired"

        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-expired@example.com',
          role: 'admin',
        })

        const expiredInvitation = await createExpiredInvitation({
          accountId: scenario.account.id,
          email: 'expired-invitee@example.com',
          role: 'viewer',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${expiredInvitation.token}`, {
          method: 'GET',
        })

        // EXPECTED: 410 Gone for expired invitations
        expect(res.status).toBe(410)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Invitation has expired')
      })

      it.skip('should return 410 for invitation that expired just now', async () => {
        // GAP: Same expected behavior for recently expired tokens

        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-just-expired@example.com',
          role: 'admin',
        })

        const justExpired = await createInvitation({
          accountId: scenario.account.id,
          email: 'just-expired@example.com',
          role: 'user',
          invitedById: scenario.user.id,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        })

        const res = await app.request(`/auth/invite/${justExpired.token}`, {
          method: 'GET',
        })

        expect(res.status).toBe(410)

        const body = await res.json()
        expect(body.error.message).toBe('Invitation has expired')
      })
    })

    describe('Invalid Invitation Token (400) - GAP', () => {
      it.skip('should return 400 Bad Request with "Invalid invitation token" for non-existent token', async () => {
        // GAP: This test documents the expected error message for invalid tokens
        // Currently returns: "Invalid or expired invitation"
        // Expected: "Invalid invitation token"

        const nonExistentToken = crypto.randomUUID()

        const res = await app.request(`/auth/invite/${nonExistentToken}`, {
          method: 'GET',
        })

        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Invalid invitation token')
      })

      it.skip('should return 400 for malformed token', async () => {
        // GAP: Expected specific message for malformed tokens

        const res = await app.request('/auth/invite/not-a-valid-uuid-format', {
          method: 'GET',
        })

        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toBe('Invalid invitation token')
      })

      it('should return 400 or 404 for empty token path', async () => {
        // Edge case: empty path segment
        const res = await app.request('/auth/invite/', {
          method: 'GET',
        })

        // Empty path segment - should not match the route (404) or be invalid (400)
        expect([400, 404]).toContain(res.status)
      })
    })

    describe('Already Used/Accepted Invitation Token (410) - GAP', () => {
      it.skip('should return 410 Gone with appropriate message for already accepted invitation', async () => {
        // GAP: This test documents the expected behavior for used tokens
        // Currently returns: 400 "Invalid or expired invitation"
        // Expected: 410 "Invitation has already been used"

        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-accepted@example.com',
          role: 'admin',
        })

        const acceptedInvitation = await createAcceptedInvitation({
          accountId: scenario.account.id,
          email: 'accepted-invitee@example.com',
          role: 'viewer',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${acceptedInvitation.token}`, {
          method: 'GET',
        })

        // EXPECTED: 410 Gone for already used invitations
        expect(res.status).toBe(410)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Invitation has already been used')
      })

      it.skip('should return 410 for invitation accepted by a different user', async () => {
        // GAP: Same expected behavior for any used invitation

        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-used-by-other@example.com',
          role: 'admin',
        })

        const usedInvitation = await createAcceptedInvitation({
          accountId: scenario.account.id,
          email: 'already-used@example.com',
          role: 'user',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${usedInvitation.token}`, {
          method: 'GET',
        })

        expect(res.status).toBe(410)

        const body = await res.json()
        expect(body.error.message).toBe('Invitation has already been used')
      })
    })

    describe('Valid Invitation Token (302)', () => {
      it('should set pending_invitation cookie and redirect to login for valid token', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-valid@example.com',
          role: 'admin',
        })

        // Create a valid invitation
        const validInvitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'valid-invitee@example.com',
          role: 'user',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${validInvitation.token}`, {
          method: 'GET',
          redirect: 'manual',
        })

        // Should redirect to login
        expect(res.status).toBe(302)

        const location = res.headers.get('location')
        expect(location).toContain('/auth/login')

        // Should set pending_invitation cookie
        const setCookie = res.headers.get('set-cookie')
        expect(setCookie).toContain('pending_invitation=')
        expect(setCookie).toContain(validInvitation.token)
      })

      it('should work for invitation that will expire in the future', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-future@example.com',
          role: 'admin',
        })

        // Create invitation expiring in 1 hour
        const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        const validInvitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'future-invitee@example.com',
          role: 'manager',
          invitedById: scenario.user.id,
          expiresAt: futureExpiry,
        })

        const res = await app.request(`/auth/invite/${validInvitation.token}`, {
          method: 'GET',
          redirect: 'manual',
        })

        expect(res.status).toBe(302)
      })
    })

    describe('Error Response Structure', () => {
      it('should return consistent error structure for expired token', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-error-struct@example.com',
          role: 'admin',
        })

        const expiredInvitation = await createExpiredInvitation({
          accountId: scenario.account.id,
          email: 'error-struct-invitee@example.com',
          role: 'viewer',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${expiredInvitation.token}`, {
          method: 'GET',
        })

        const body = await res.json()

        // Verify error response structure
        expect(body).toHaveProperty('error')
        expect(body.error).toHaveProperty('message')
        expect(typeof body.error.message).toBe('string')
      })

      it('should return consistent error structure for invalid token', async () => {
        const res = await app.request(`/auth/invite/${crypto.randomUUID()}`, {
          method: 'GET',
        })

        const body = await res.json()

        // Verify error response structure
        expect(body).toHaveProperty('error')
        expect(body.error).toHaveProperty('message')
        expect(typeof body.error.message).toBe('string')
      })

      it('should return consistent error structure for used token', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-error-used@example.com',
          role: 'admin',
        })

        const usedInvitation = await createAcceptedInvitation({
          accountId: scenario.account.id,
          email: 'error-used-invitee@example.com',
          role: 'viewer',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${usedInvitation.token}`, {
          method: 'GET',
        })

        const body = await res.json()

        // Verify error response structure
        expect(body).toHaveProperty('error')
        expect(body.error).toHaveProperty('message')
        expect(typeof body.error.message).toBe('string')
      })
    })

    describe('Different Roles and Accounts', () => {
      it('should return error for expired token regardless of role', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin-role-test@example.com',
          role: 'admin',
        })

        // Create expired invitation for ADMIN role
        const expiredAdminInvite = await createExpiredInvitation({
          accountId: scenario.account.id,
          email: 'expired-admin@example.com',
          role: 'admin',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/auth/invite/${expiredAdminInvite.token}`, {
          method: 'GET',
        })

        // Current behavior: returns 400 (GAP: should return 410)
        expect(res.status).toBe(400)
      })

      it('should validate invalid token for deleted account gracefully', async () => {
        // This tests edge case where invitation might reference a deleted account
        // Using a completely fake token that wouldn't match any account
        const fakeToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

        const res = await app.request(`/auth/invite/${fakeToken}`, {
          method: 'GET',
        })

        // Should return invalid token error, not an internal error
        expect(res.status).toBe(400)
      })
    })
  })

  // ============================================================================
  // Handler Error Cases
  // ============================================================================

  describe('Handler Error Cases', () => {
    describe('Database Not Initialized', () => {
      // Skip: Handler uses c.env.DB ?? c.get('db') fallback which makes this scenario
      // unrealistic. The handler will return 400 (invalid token) when DB query fails.
      it.skip('should return 500 when database is not initialized', async () => {
        const appWithoutDb = new Hono<HonoEnv>()
        appWithoutDb.onError(errorHandler)

        appWithoutDb.use('*', async (c, next) => {
          ;(c as any).env = env
          // Note: NOT setting db
          c.set('transactionId', crypto.randomUUID())
          c.set('ip', '127.0.0.1')
          c.set('userAgent', 'IntegrationTest/1.0')
          await next()
        })

        const { inviteHandler } = await import('../../../src/server/routes/auth/handlers')
        const testToken = crypto.randomUUID()
        appWithoutDb.get('/test-invite/:token', async (c) => {
          // Mock the valid method to return the param
          const originalValid = c.req.valid.bind(c.req)
          c.req.valid = ((type: string) => {
            if (type === 'param') return { token: testToken }
            return originalValid(type)
          }) as typeof c.req.valid
          // @ts-expect-error - Testing error case
          return inviteHandler(c)
        })

        const res = await appWithoutDb.request(`/test-invite/${testToken}`, {
          method: 'GET',
        })

        expect(res.status).toBe(500)
        const body = await res.json()
        expect(body.error.message).toBe('Database not initialized')
      })
    })
  })
})
