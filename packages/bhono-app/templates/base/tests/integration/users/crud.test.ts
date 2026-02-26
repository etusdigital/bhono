/**
 * Users CRUD Integration Tests
 *
 * Tests the user CRUD operations:
 * - GET /api/users/:id - Get user by ID
 * - PATCH /api/users/:id - Update user
 * - DELETE /api/users/:id - Soft delete user
 * - POST /api/users/:id/restore - Restore soft-deleted user
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createDeletedUser,
  createUserSession,
  createTestScenario,
  createMultiUserScenario,
  createAccount,
  addUserToAccount,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'

/**
 * Creates a D1-compatible database instance for tests
 */
function createTestDb() {
  return getDb()
}

describe('Users CRUD Integration', () => {
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
  // GET /api/users/:id
  // ============================================================================

  describe('GET /api/users/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const userId = crypto.randomUUID()
        const res = await app.request(`/api/users/${userId}`, {
          method: 'GET',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const userId = crypto.randomUUID()
        const res = await app.request(`/api/users/${userId}`, {
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

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent user', async () => {
        const scenario = await createTestScenario({
          userName: 'Get Test User',
          userEmail: 'gettest@example.com',
          role: 'admin',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/users/${nonExistentId}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(404)

        const body = await res.json()
        expect(body.error.message).toContain('User')
      })

      it('should return 404 if user not in same account', async () => {
        // Create a user in one account
        const scenario = await createTestScenario({
          userName: 'First Account User',
          userEmail: 'firstaccount@example.com',
          role: 'admin',
        })

        // Create another user in a different account
        const otherUser = await createUser({
          email: 'otheraccount@example.com',
          name: 'Other Account User',
        })
        const otherAccount = await createAccount({
          name: 'Other Account',
        })
        await addUserToAccount(otherUser.id, otherAccount.id, 'admin')

        // Try to get the other user from the first account
        const res = await app.request(`/api/users/${otherUser.id}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // Returns 404 (not 403) for security - don't reveal user exists
        expect(res.status).toBe(404)
      })
    })

    describe('Successful Get (200)', () => {
      it('should return 200 with user details for authorized request', async () => {
        const scenario = await createTestScenario({
          userName: 'Get User Test',
          userEmail: 'getusertest@example.com',
          role: 'viewer',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
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
        expect(body.data.id).toBe(scenario.user.id)
        expect(body.data.email).toBe(scenario.user.email)
        expect(body.data.name).toBe(scenario.user.name)
      })

      it('should include all user fields in response', async () => {
        const scenario = await createTestScenario({
          userName: 'Fields Test User',
          userEmail: 'fieldstest@example.com',
          role: 'admin',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data).toHaveProperty('id')
        expect(body.data).toHaveProperty('email')
        expect(body.data).toHaveProperty('name')
        expect(body.data).toHaveProperty('status')
        expect(body.data).toHaveProperty('isSuperAdmin')
        expect(body.data).toHaveProperty('createdAt')
        expect(body.data).toHaveProperty('updatedAt')
      })

      it('should allow user to get another user in same account', async () => {
        const scenario = await createMultiUserScenario()

        // Admin can get viewer's details
        const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
          method: 'GET',
          headers: {
            ...scenario.admin.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.id).toBe(scenario.viewer.user.id)
      })
    })
  })

  // ============================================================================
  // PATCH /api/users/:id
  // ============================================================================

  describe('PATCH /api/users/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const userId = crypto.randomUUID()
        const res = await app.request(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated Name' }),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent user', async () => {
        const scenario = await createTestScenario({
          userName: 'Update Test User',
          userEmail: 'updatetest@example.com',
          role: 'manager',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/users/${nonExistentId}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated Name' }),
        })

        expect(res.status).toBe(404)
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission to update (VIEWER role)', async () => {
        const scenario = await createMultiUserScenario()

        // VIEWER role cannot update users
        const res = await app.request(`/api/users/${scenario.admin.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.viewer.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Not Update' }),
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for empty name', async () => {
        const scenario = await createTestScenario({
          userName: 'Validation Test User',
          userEmail: 'validationtest@example.com',
          role: 'manager',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: '' }),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for invalid status value', async () => {
        const scenario = await createTestScenario({
          userName: 'Invalid Status User',
          userEmail: 'invalidstatus@example.com',
          role: 'manager',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'invalid_status' }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe('Successful Update (200)', () => {
      it('should return 200 on successful name update', async () => {
        const scenario = await createTestScenario({
          userName: 'Original Name',
          userEmail: 'nameupdate@example.com',
          role: 'manager',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated Name' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.name).toBe('Updated Name')
      })

      it('should return 200 on successful status update', async () => {
        const scenario = await createTestScenario({
          userName: 'Status Update User',
          userEmail: 'statusupdate@example.com',
          role: 'manager',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'inactive' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.status).toBe('inactive')
      })

      it('should update both name and status together', async () => {
        const scenario = await createTestScenario({
          userName: 'Both Fields User',
          userEmail: 'bothfields@example.com',
          role: 'admin',
        })

        const res = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'New Name',
            status: 'inactive',
          }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.name).toBe('New Name')
        expect(body.data.status).toBe('inactive')
      })

      it('should verify database is updated after PATCH', async () => {
        const scenario = await createTestScenario({
          userName: 'DB Verify User',
          userEmail: 'dbverify@example.com',
          role: 'manager',
        })

        // Update the user
        await app.request(`/api/users/${scenario.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Database Updated Name' }),
        })

        // Verify by fetching the user again
        const getRes = await app.request(`/api/users/${scenario.user.id}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(getRes.status).toBe(200)

        const body = await getRes.json()
        expect(body.data.name).toBe('Database Updated Name')
      })

      it('should allow MANAGER role to update users', async () => {
        const scenario = await createMultiUserScenario()

        // Manager updates viewer
        const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.manager.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Manager Updated Name' }),
        })

        expect(res.status).toBe(200)
      })
    })
  })

  // ============================================================================
  // DELETE /api/users/:id
  // ============================================================================

  describe('DELETE /api/users/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const userId = crypto.randomUUID()
        const res = await app.request(`/api/users/${userId}`, {
          method: 'DELETE',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent user', async () => {
        const scenario = await createTestScenario({
          userName: 'Delete Test User',
          userEmail: 'deletetest@example.com',
          role: 'admin',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/users/${nonExistentId}`, {
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
      it('should return 403 if user lacks permission to delete (MANAGER role)', async () => {
        const scenario = await createMultiUserScenario()

        // MANAGER role cannot delete users (requires ADMIN)
        const res = await app.request(`/api/users/${scenario.viewer.user.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.manager.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to delete (VIEWER role)', async () => {
        const scenario = await createMultiUserScenario()

        const res = await app.request(`/api/users/${scenario.admin.user.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.viewer.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Successful Delete (204)', () => {
      it('should return 204 on successful delete', async () => {
        const scenario = await createTestScenario({
          userName: 'Delete Success User',
          userEmail: 'deletesuccess@example.com',
          role: 'admin',
        })

        // Create a user to delete
        const userToDelete = await createUser({
          email: 'tobedeleted@example.com',
          name: 'To Be Deleted',
        })
        await addUserToAccount(userToDelete.id, scenario.account.id, 'viewer')

        const res = await app.request(`/api/users/${userToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(204)
      })

      it('should verify deleted_at is set (soft delete)', async () => {
        const scenario = await createTestScenario({
          userName: 'Soft Delete User',
          userEmail: 'softdelete@example.com',
          role: 'admin',
        })

        // Create a user to delete
        const userToDelete = await createUser({
          email: 'softdeleted@example.com',
          name: 'Soft Deleted',
        })
        await addUserToAccount(userToDelete.id, scenario.account.id, 'viewer')

        // Delete the user
        await app.request(`/api/users/${userToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // Verify in database that deleted_at is set
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT deleted_at FROM users WHERE id = ?').get(userToDelete.id) as { deleted_at: string | null }
        expect(row.deleted_at).not.toBeNull()
      })

      it('should not appear in user list after deletion', async () => {
        const scenario = await createTestScenario({
          userName: 'List After Delete User',
          userEmail: 'listafterdelete@example.com',
          role: 'admin',
        })

        // Create a user to delete
        const userToDelete = await createUser({
          email: 'willnotappear@example.com',
          name: 'Will Not Appear',
        })
        await addUserToAccount(userToDelete.id, scenario.account.id, 'viewer')

        // Delete the user
        await app.request(`/api/users/${userToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // List users and verify deleted user is not included
        const listRes = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(listRes.status).toBe(200)

        const body = await listRes.json()
        const userIds = body.data.map((u: any) => u.id)
        expect(userIds).not.toContain(userToDelete.id)
      })
    })
  })

  // ============================================================================
  // POST /api/users/accounts (Bulk Create User-Account Relationships)
  // ============================================================================

  describe('POST /api/users/accounts', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: crypto.randomUUID(), accountId: crypto.randomUUID(), role: 'viewer' },
          ]),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission (VIEWER role)', async () => {
        const scenario = await createMultiUserScenario()

        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            ...scenario.viewer.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: scenario.admin.user.id, accountId: scenario.account.id, role: 'viewer' },
          ]),
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for empty array', async () => {
        const scenario = await createTestScenario({
          userName: 'Bulk Create User',
          userEmail: 'bulkcreate@example.com',
          role: 'manager',
        })

        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([]),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for invalid role', async () => {
        const scenario = await createTestScenario({
          userName: 'Invalid Role User',
          userEmail: 'invalidrole@example.com',
          role: 'manager',
        })

        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: crypto.randomUUID(), accountId: crypto.randomUUID(), role: 'INVALID_ROLE' },
          ]),
        })

        expect(res.status).toBe(400)
      })
    })

    describe('Successful Create (201)', () => {
      it('should return 201 on successful bulk create', async () => {
        const scenario = await createTestScenario({
          userName: 'Bulk Admin',
          userEmail: 'bulkadmin@example.com',
          role: 'manager',
        })

        // Create a new user to add to account
        const newUser = await createUser({
          email: 'newuserforaccount@example.com',
          name: 'New User For Account',
        })

        // Create another account
        const anotherAccount = await createAccount({
          name: 'Another Account for Bulk',
        })

        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: newUser.id, accountId: anotherAccount.id, role: 'viewer' },
          ]),
        })

        expect(res.status).toBe(201)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.count).toBe(1)
      })

      it('should update existing role if user-account relationship exists', async () => {
        const scenario = await createTestScenario({
          userName: 'Role Update Admin',
          userEmail: 'roleupdate@example.com',
          role: 'manager',
        })

        // Create a user and add to the account with VIEWER role
        const existingUser = await createUser({
          email: 'existingforroleupdaet@example.com',
          name: 'Existing For Role Update',
        })
        await addUserToAccount(existingUser.id, scenario.account.id, 'viewer')

        // Now update the role to EDITOR via bulk operation
        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: existingUser.id, accountId: scenario.account.id, role: 'user' },
          ]),
        })

        expect(res.status).toBe(201)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.count).toBe(1)

        // Verify role was updated in database
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT role FROM user_accounts WHERE user_id = ? AND account_id = ?').get(existingUser.id, scenario.account.id) as { role: string }
        expect(row.role).toBe('user')
      })

      it('should create multiple user-account relationships', async () => {
        const scenario = await createTestScenario({
          userName: 'Multi Bulk Admin',
          userEmail: 'multibulk@example.com',
          role: 'manager',
        })

        // Create multiple users
        const user1 = await createUser({
          email: 'bulkuser1@example.com',
          name: 'Bulk User 1',
        })
        const user2 = await createUser({
          email: 'bulkuser2@example.com',
          name: 'Bulk User 2',
        })

        // Create another account
        const newAccount = await createAccount({
          name: 'Bulk Account',
        })

        const res = await app.request('/api/users/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: user1.id, accountId: newAccount.id, role: 'viewer' },
            { userId: user2.id, accountId: newAccount.id, role: 'user' },
          ]),
        })

        expect(res.status).toBe(201)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.count).toBe(2)
      })
    })
  })

  // ============================================================================
  // DELETE /api/users/accounts (Bulk Delete User-Account Relationships)
  // ============================================================================

  describe('DELETE /api/users/accounts', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/users/accounts', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: crypto.randomUUID(), accountId: crypto.randomUUID(), role: 'viewer' },
          ]),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission (VIEWER role)', async () => {
        const scenario = await createMultiUserScenario()

        const res = await app.request('/api/users/accounts', {
          method: 'DELETE',
          headers: {
            ...scenario.viewer.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: scenario.admin.user.id, accountId: scenario.account.id, role: 'admin' },
          ]),
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for empty array', async () => {
        const scenario = await createTestScenario({
          userName: 'Bulk Delete User',
          userEmail: 'bulkdelete@example.com',
          role: 'manager',
        })

        const res = await app.request('/api/users/accounts', {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([]),
        })

        expect(res.status).toBe(400)
      })
    })

    describe('Successful Delete (200)', () => {
      it('should return 200 on successful bulk delete', async () => {
        const scenario = await createTestScenario({
          userName: 'Delete Admin',
          userEmail: 'deleteadmin@example.com',
          role: 'manager',
        })

        // Create a user and add to another account
        const userToRemove = await createUser({
          email: 'usertoremove@example.com',
          name: 'User To Remove',
        })
        const accountToRemoveFrom = await createAccount({
          name: 'Account To Remove From',
        })
        await addUserToAccount(userToRemove.id, accountToRemoveFrom.id, 'viewer')

        const res = await app.request('/api/users/accounts', {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: userToRemove.id, accountId: accountToRemoveFrom.id, role: 'viewer' },
          ]),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.count).toBe(1)
      })

      it('should verify user-account relationship is deleted from database', async () => {
        const scenario = await createTestScenario({
          userName: 'Verify Delete Admin',
          userEmail: 'verifydelete@example.com',
          role: 'manager',
        })

        // Create a user and add to another account
        const userToCheck = await createUser({
          email: 'usertocheck@example.com',
          name: 'User To Check',
        })
        const accountToCheck = await createAccount({
          name: 'Account To Check',
        })
        await addUserToAccount(userToCheck.id, accountToCheck.id, 'user')

        // Verify relationship exists
        const sqlite = getSqlite()
        const beforeRow = sqlite.prepare('SELECT * FROM user_accounts WHERE user_id = ? AND account_id = ?').get(userToCheck.id, accountToCheck.id)
        expect(beforeRow).toBeDefined()

        // Delete the relationship
        await app.request('/api/users/accounts', {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: userToCheck.id, accountId: accountToCheck.id, role: 'user' },
          ]),
        })

        // Verify relationship is deleted
        const afterRow = sqlite.prepare('SELECT * FROM user_accounts WHERE user_id = ? AND account_id = ?').get(userToCheck.id, accountToCheck.id)
        expect(afterRow).toBeUndefined()
      })

      it('should delete multiple user-account relationships', async () => {
        const scenario = await createTestScenario({
          userName: 'Multi Delete Admin',
          userEmail: 'multidelete@example.com',
          role: 'manager',
        })

        // Create multiple users and add to an account
        const user1 = await createUser({
          email: 'deleteuser1@example.com',
          name: 'Delete User 1',
        })
        const user2 = await createUser({
          email: 'deleteuser2@example.com',
          name: 'Delete User 2',
        })
        const accountForDelete = await createAccount({
          name: 'Account For Delete',
        })
        await addUserToAccount(user1.id, accountForDelete.id, 'viewer')
        await addUserToAccount(user2.id, accountForDelete.id, 'user')

        const res = await app.request('/api/users/accounts', {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { userId: user1.id, accountId: accountForDelete.id, role: 'viewer' },
            { userId: user2.id, accountId: accountForDelete.id, role: 'user' },
          ]),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.count).toBe(2)
      })
    })
  })

  // ============================================================================
  // POST /api/users/:id/restore
  // ============================================================================

  describe('POST /api/users/:id/restore', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const userId = crypto.randomUUID()
        const res = await app.request(`/api/users/${userId}/restore`, {
          method: 'POST',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent user', async () => {
        const scenario = await createTestScenario({
          userName: 'Restore Test User',
          userEmail: 'restoretest@example.com',
          role: 'admin',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/users/${nonExistentId}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(404)
      })

      it('should return 404 for user that is not deleted', async () => {
        const scenario = await createTestScenario({
          userName: 'Not Deleted User',
          userEmail: 'notdeleted@example.com',
          role: 'admin',
        })

        // Try to restore a user that is not deleted
        const res = await app.request(`/api/users/${scenario.user.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(404)

        const body = await res.json()
        expect(body.error.message).toContain('not deleted')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks permission to restore (MANAGER role)', async () => {
        const scenario = await createMultiUserScenario()

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'deletedformanager@example.com',
          name: 'Deleted For Manager',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'viewer')

        // MANAGER role cannot restore users (requires ADMIN)
        const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.manager.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user lacks permission to restore (VIEWER role)', async () => {
        const scenario = await createMultiUserScenario()

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'deletedforviewer@example.com',
          name: 'Deleted For Viewer',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'viewer')

        const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.viewer.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })
    })

    describe('Successful Restore (200)', () => {
      it('should return 200 on successful restore', async () => {
        const scenario = await createTestScenario({
          userName: 'Restore Admin User',
          userEmail: 'restoreadmin@example.com',
          role: 'admin',
        })

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'toberestored@example.com',
          name: 'To Be Restored',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'viewer')

        const res = await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.id).toBe(deletedUser.id)
        expect(body.data.deletedAt).toBeNull()
      })

      it('should verify deleted_at is cleared after restore', async () => {
        const scenario = await createTestScenario({
          userName: 'Verify Restore User',
          userEmail: 'verifyrestore@example.com',
          role: 'admin',
        })

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'deletedatcleared@example.com',
          name: 'Deleted At Cleared',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'viewer')

        // Restore the user
        await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // Verify in database that deleted_at is cleared
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT deleted_at FROM users WHERE id = ?').get(deletedUser.id) as { deleted_at: string | null }
        expect(row.deleted_at).toBeNull()
      })

      it('should appear in user list after restoration', async () => {
        const scenario = await createTestScenario({
          userName: 'List After Restore User',
          userEmail: 'listafterrestore@example.com',
          role: 'admin',
        })

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'willappear@example.com',
          name: 'Will Appear',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'viewer')

        // Verify user is NOT in list before restore
        const listBefore = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        const bodyBefore = await listBefore.json()
        const userIdsBefore = bodyBefore.data.map((u: any) => u.id)
        expect(userIdsBefore).not.toContain(deletedUser.id)

        // Restore the user
        await app.request(`/api/users/${deletedUser.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        // Verify user IS in list after restore
        const listAfter = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        const bodyAfter = await listAfter.json()
        const userIdsAfter = bodyAfter.data.map((u: any) => u.id)
        expect(userIdsAfter).toContain(deletedUser.id)
      })
    })
  })
})
