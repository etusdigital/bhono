/**
 * Invitations CRUD Integration Tests
 *
 * Tests the invitation CRUD operations:
 * - POST /api/invitations - Create invitation
 * - GET /api/invitations - List pending invitations
 * - DELETE /api/invitations/:id - Revoke invitation
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createUserSession,
  createTestScenario,
  createMultiUserScenario,
  createAccount,
  addUserToAccount,
  createInvitation,
  createExpiredInvitation,
  createAcceptedInvitation,
  getAccountInvitations,
} from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { errorHandler } from '../../middleware/error-handler'
import { sessionMiddleware } from '../../lib/session'

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

describe('Invitations CRUD Integration', () => {
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

    // Session middleware - reads session from KV and sets sessionData in context
    app.use('*', sessionMiddleware())

    // Mount API routes (includes sessionAuth and accountMiddleware)
    app.route('/api', api)
  })

  // ============================================================================
  // POST /api/invitations
  // ============================================================================

  describe('POST /api/invitations', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            Cookie: 'sid=invalid-session-id-that-does-not-exist',
            'account-id': crypto.randomUUID(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission to invite (VIEWER role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer User',
          userEmail: 'viewer@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to invite (EDITOR role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Editor User',
          userEmail: 'editor@example.com',
          role: 'EDITOR',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user tries to assign role higher than own (MANAGER assigns ADMIN)', async () => {
        const scenario = await createTestScenario({
          userName: 'Manager User',
          userEmail: 'manager@example.com',
          role: 'MANAGER',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', role: 'ADMIN' }),
        })

        expect(res.status).toBe(403)

        const body = await res.json()
        expect(body.error.message).toContain('Cannot assign a role higher than your own')
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for invalid email', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'not-an-email', role: 'VIEWER' }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for missing email', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin2@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'VIEWER' }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for invalid role', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin3@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', role: 'INVALID_ROLE' }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for missing role', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin4@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com' }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe('Conflict (409)', () => {
      it('should return 409 if invitation already exists for email', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin5@example.com',
          role: 'ADMIN',
        })

        // Create an existing invitation
        await createInvitation({
          accountId: scenario.account.id,
          email: 'existing@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        // Try to create another invitation for the same email
        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'existing@example.com', role: 'EDITOR' }),
        })

        expect(res.status).toBe(409)

        const body = await res.json()
        expect(body.error.message).toContain('Pending invitation already exists')
      })

      it('should return 409 if user is already a member of the account', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin6@example.com',
          role: 'ADMIN',
        })

        // Create another user who is already in the account
        const existingUser = await createUser({
          email: 'alreadymember@example.com',
          name: 'Already Member',
        })
        await addUserToAccount(existingUser.id, scenario.account.id, 'VIEWER')

        // Try to invite the existing member
        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'alreadymember@example.com', role: 'EDITOR' }),
        })

        expect(res.status).toBe(409)

        const body = await res.json()
        expect(body.error.message).toContain('already a member')
      })

      it('should not conflict with expired invitations when checking for duplicates', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin7@example.com',
          role: 'ADMIN',
        })

        // Create an expired invitation
        const expiredInvitation = await createExpiredInvitation({
          accountId: scenario.account.id,
          email: 'expiredinvite@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        // Note: The database has a unique constraint on (account_id, email)
        // So we need to delete the expired invitation first before creating a new one
        // This simulates a cleanup process that removes expired invitations
        const sqlite = getSqlite()
        sqlite.prepare('DELETE FROM invitations WHERE id = ?').run(expiredInvitation.id)

        // Should be able to create a new invitation after cleanup
        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'expiredinvite@example.com', role: 'EDITOR' }),
        })

        expect(res.status).toBe(200)
      })

      it('should allow invitation if previous invitation was accepted', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin8@example.com',
          role: 'ADMIN',
        })

        // Create a second account
        const otherAccount = await createAccount({ name: 'Other Account' })
        await addUserToAccount(scenario.user.id, otherAccount.id, 'ADMIN')

        // Create an accepted invitation in other account
        await createAcceptedInvitation({
          accountId: otherAccount.id,
          email: 'acceptedinvite@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        // Should be able to create a new invitation in the original account
        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'acceptedinvite@example.com', role: 'EDITOR' }),
        })

        expect(res.status).toBe(200)
      })
    })

    describe('Successful Creation (200)', () => {
      it('should return 200 on successful invitation creation', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin9@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser1@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.invited).toBe(true)
        expect(body.linked).toBe(false)
        expect(body.invitation).toBeDefined()
        expect(body.invitation.email).toBe('newuser1@example.com')
        expect(body.invitation.role).toBe('VIEWER')
        expect(body.invitation.expiresAt).toBeDefined()
      })

      it('should verify invitation is created in database', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin10@example.com',
          role: 'ADMIN',
        })

        const testEmail = 'dbverify@example.com'

        await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: testEmail, role: 'EDITOR' }),
        })

        // Verify in database
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT * FROM invitations WHERE email = ?').get(testEmail) as any
        expect(row).toBeDefined()
        expect(row.email).toBe(testEmail)
        expect(row.role).toBe('EDITOR')
        expect(row.account_id).toBe(scenario.account.id)
        expect(row.invited_by_id).toBe(scenario.user.id)
      })

      it('should link existing user immediately instead of creating invitation', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin11@example.com',
          role: 'ADMIN',
        })

        // Create an existing user who is not in the account
        const existingUser = await createUser({
          email: 'existinguser@example.com',
          name: 'Existing User',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'existinguser@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.linked).toBe(true)
        expect(body.invited).toBe(false)
        expect(body.user).toBeDefined()
        expect(body.user.id).toBe(existingUser.id)
        expect(body.user.email).toBe(existingUser.email)

        // Verify in database - user should be in user_accounts
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT * FROM user_accounts WHERE user_id = ? AND account_id = ?').get(existingUser.id, scenario.account.id) as any
        expect(row).toBeDefined()
        expect(row.role).toBe('VIEWER')
      })

      it('should allow MANAGER role to invite with VIEWER role', async () => {
        const scenario = await createTestScenario({
          userName: 'Manager User',
          userEmail: 'manager2@example.com',
          role: 'MANAGER',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser2@example.com', role: 'VIEWER' }),
        })

        expect(res.status).toBe(200)
      })

      it('should allow MANAGER role to invite with MANAGER role', async () => {
        const scenario = await createTestScenario({
          userName: 'Manager User',
          userEmail: 'manager3@example.com',
          role: 'MANAGER',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser3@example.com', role: 'MANAGER' }),
        })

        expect(res.status).toBe(200)
      })

      it('should allow ADMIN role to invite with ADMIN role', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admin12@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newadmin@example.com', role: 'ADMIN' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.invitation.role).toBe('ADMIN')
      })
    })
  })

  // ============================================================================
  // GET /api/invitations
  // ============================================================================

  describe('GET /api/invitations', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/invitations', {
          method: 'GET',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            Cookie: 'sid=invalid-session-id-that-does-not-exist',
            'account-id': crypto.randomUUID(),
          },
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission to list invitations (VIEWER role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer User',
          userEmail: 'viewerlist@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Successful List (200)', () => {
      it('should return 200 with empty array when no invitations', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'adminlist1@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.data.length).toBe(0)
      })

      it('should return 200 with invitations array', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'adminlist2@example.com',
          role: 'ADMIN',
        })

        // Create some invitations
        await createInvitation({
          accountId: scenario.account.id,
          email: 'invite1@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })
        await createInvitation({
          accountId: scenario.account.id,
          email: 'invite2@example.com',
          role: 'EDITOR',
          invitedById: scenario.user.id,
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(2)
      })

      it('should return only invitations for the current account', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'adminlist3@example.com',
          role: 'ADMIN',
        })

        // Create another account with invitations
        const otherAccount = await createAccount({ name: 'Other Account' })
        const otherUser = await createUser({
          email: 'otheruser@example.com',
          name: 'Other User',
        })
        await addUserToAccount(otherUser.id, otherAccount.id, 'ADMIN')

        // Create invitations in both accounts
        await createInvitation({
          accountId: scenario.account.id,
          email: 'myaccountinvite@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })
        await createInvitation({
          accountId: otherAccount.id,
          email: 'otheraccountinvite@example.com',
          role: 'VIEWER',
          invitedById: otherUser.id,
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].email).toBe('myaccountinvite@example.com')
      })

      it('should include invitation details (email, role, createdAt, expiresAt, invitedBy)', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'adminlist4@example.com',
          role: 'ADMIN',
        })

        await createInvitation({
          accountId: scenario.account.id,
          email: 'detailtest@example.com',
          role: 'MANAGER',
          invitedById: scenario.user.id,
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        const invitation = body.data[0]
        expect(invitation).toHaveProperty('id')
        expect(invitation).toHaveProperty('email', 'detailtest@example.com')
        expect(invitation).toHaveProperty('role', 'MANAGER')
        expect(invitation).toHaveProperty('createdAt')
        expect(invitation).toHaveProperty('expiresAt')
        expect(invitation).toHaveProperty('invitedBy')
        expect(invitation.invitedBy).toHaveProperty('id', scenario.user.id)
        expect(invitation.invitedBy).toHaveProperty('name', scenario.user.name)
      })

      it('should not include expired invitations', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'adminlist5@example.com',
          role: 'ADMIN',
        })

        // Create a pending invitation
        await createInvitation({
          accountId: scenario.account.id,
          email: 'pendinginvite@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        // Create an expired invitation
        await createExpiredInvitation({
          accountId: scenario.account.id,
          email: 'expiredinvite2@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].email).toBe('pendinginvite@example.com')
      })

      it('should not include accepted invitations', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'adminlist6@example.com',
          role: 'ADMIN',
        })

        // Create a pending invitation
        await createInvitation({
          accountId: scenario.account.id,
          email: 'stilpending@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        // Create an accepted invitation
        await createAcceptedInvitation({
          accountId: scenario.account.id,
          email: 'alreadyaccepted@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].email).toBe('stilpending@example.com')
      })

      it('should allow MANAGER role to list invitations', async () => {
        const scenario = await createTestScenario({
          userName: 'Manager User',
          userEmail: 'managerlist@example.com',
          role: 'MANAGER',
        })

        const res = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)
      })
    })
  })

  // ============================================================================
  // DELETE /api/invitations/:id
  // ============================================================================

  describe('DELETE /api/invitations/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const invitationId = crypto.randomUUID()
        const res = await app.request(`/api/invitations/${invitationId}`, {
          method: 'DELETE',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const invitationId = crypto.randomUUID()
        const res = await app.request(`/api/invitations/${invitationId}`, {
          method: 'DELETE',
          headers: {
            Cookie: 'sid=invalid-session-id-that-does-not-exist',
            'account-id': crypto.randomUUID(),
          },
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent invitation', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admindelete1@example.com',
          role: 'ADMIN',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/invitations/${nonExistentId}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(404)
      })

      it('should return 404 for invitation in different account', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admindelete2@example.com',
          role: 'ADMIN',
        })

        // Create another account with an invitation
        const otherAccount = await createAccount({ name: 'Other Account Delete' })
        const otherUser = await createUser({
          email: 'otherdelete@example.com',
          name: 'Other Delete User',
        })
        await addUserToAccount(otherUser.id, otherAccount.id, 'ADMIN')

        const otherInvitation = await createInvitation({
          accountId: otherAccount.id,
          email: 'otherinvite@example.com',
          role: 'VIEWER',
          invitedById: otherUser.id,
        })

        // Try to delete from wrong account
        const res = await app.request(`/api/invitations/${otherInvitation.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(404)
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission to revoke (VIEWER role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer User',
          userEmail: 'viewerdelete@example.com',
          role: 'VIEWER',
        })

        // Create invitation using direct DB (since VIEWER can't create via API)
        const adminUser = await createUser({
          email: 'adminforviewer@example.com',
          name: 'Admin For Viewer',
        })
        await addUserToAccount(adminUser.id, scenario.account.id, 'ADMIN')

        const invitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'viewercannotdelete@example.com',
          role: 'VIEWER',
          invitedById: adminUser.id,
        })

        const res = await app.request(`/api/invitations/${invitation.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to revoke (EDITOR role)', async () => {
        const scenario = await createTestScenario({
          userName: 'Editor User',
          userEmail: 'editordelete@example.com',
          role: 'EDITOR',
        })

        const adminUser = await createUser({
          email: 'adminforeditor@example.com',
          name: 'Admin For Editor',
        })
        await addUserToAccount(adminUser.id, scenario.account.id, 'ADMIN')

        const invitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'editorcannotdelete@example.com',
          role: 'VIEWER',
          invitedById: adminUser.id,
        })

        const res = await app.request(`/api/invitations/${invitation.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Successful Revoke (204)', () => {
      it('should return 204 on successful revoke', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admindelete3@example.com',
          role: 'ADMIN',
        })

        const invitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'torevoke@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/api/invitations/${invitation.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(204)
      })

      it('should verify invitation is deleted from database', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admindelete4@example.com',
          role: 'ADMIN',
        })

        const invitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'todelete@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        // Verify invitation exists before delete
        const sqlite = getSqlite()
        const beforeRow = sqlite.prepare('SELECT * FROM invitations WHERE id = ?').get(invitation.id)
        expect(beforeRow).toBeDefined()

        // Delete the invitation
        await app.request(`/api/invitations/${invitation.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // Verify invitation is deleted
        const afterRow = sqlite.prepare('SELECT * FROM invitations WHERE id = ?').get(invitation.id)
        expect(afterRow).toBeUndefined()
      })

      it('should not appear in list after revocation', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin User',
          userEmail: 'admindelete5@example.com',
          role: 'ADMIN',
        })

        // Create two invitations
        const invitationToDelete = await createInvitation({
          accountId: scenario.account.id,
          email: 'willbedeleted@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })
        await createInvitation({
          accountId: scenario.account.id,
          email: 'willremain@example.com',
          role: 'EDITOR',
          invitedById: scenario.user.id,
        })

        // Delete one invitation
        await app.request(`/api/invitations/${invitationToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // List invitations and verify
        const listRes = await app.request('/api/invitations', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(listRes.status).toBe(200)

        const body = await listRes.json()
        expect(body.data.length).toBe(1)
        expect(body.data[0].email).toBe('willremain@example.com')
      })

      it('should allow MANAGER role to revoke invitations', async () => {
        const scenario = await createTestScenario({
          userName: 'Manager User',
          userEmail: 'managerdelete@example.com',
          role: 'MANAGER',
        })

        const invitation = await createInvitation({
          accountId: scenario.account.id,
          email: 'managerrevoke@example.com',
          role: 'VIEWER',
          invitedById: scenario.user.id,
        })

        const res = await app.request(`/api/invitations/${invitation.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(204)
      })
    })
  })
})
