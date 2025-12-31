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
          role: 'ADMIN',
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
          role: 'ADMIN',
        })

        // Create another user in a different account
        const otherUser = await createUser({
          email: 'otheraccount@example.com',
          name: 'Other Account User',
        })
        const otherAccount = await createAccount({
          name: 'Other Account',
        })
        await addUserToAccount(otherUser.id, otherAccount.id, 'ADMIN')

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
          role: 'VIEWER',
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
          role: 'ADMIN',
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
          role: 'MANAGER',
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
          role: 'MANAGER',
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
          role: 'MANAGER',
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
          role: 'MANAGER',
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
          role: 'MANAGER',
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
          role: 'ADMIN',
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
          role: 'MANAGER',
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
          role: 'ADMIN',
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
          role: 'ADMIN',
        })

        // Create a user to delete
        const userToDelete = await createUser({
          email: 'tobedeleted@example.com',
          name: 'To Be Deleted',
        })
        await addUserToAccount(userToDelete.id, scenario.account.id, 'VIEWER')

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
          role: 'ADMIN',
        })

        // Create a user to delete
        const userToDelete = await createUser({
          email: 'softdeleted@example.com',
          name: 'Soft Deleted',
        })
        await addUserToAccount(userToDelete.id, scenario.account.id, 'VIEWER')

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
          role: 'ADMIN',
        })

        // Create a user to delete
        const userToDelete = await createUser({
          email: 'willnotappear@example.com',
          name: 'Will Not Appear',
        })
        await addUserToAccount(userToDelete.id, scenario.account.id, 'VIEWER')

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
          role: 'ADMIN',
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
          role: 'ADMIN',
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
        await addUserToAccount(deletedUser.id, scenario.account.id, 'VIEWER')

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
        await addUserToAccount(deletedUser.id, scenario.account.id, 'VIEWER')

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
          role: 'ADMIN',
        })

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'toberestored@example.com',
          name: 'To Be Restored',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'VIEWER')

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
          role: 'ADMIN',
        })

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'deletedatcleared@example.com',
          name: 'Deleted At Cleared',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'VIEWER')

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
          role: 'ADMIN',
        })

        // Create a deleted user
        const deletedUser = await createDeletedUser({
          email: 'willappear@example.com',
          name: 'Will Appear',
        })
        await addUserToAccount(deletedUser.id, scenario.account.id, 'VIEWER')

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
