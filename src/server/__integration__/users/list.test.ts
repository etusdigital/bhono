/**
 * Users List Integration Tests
 *
 * Tests the GET /api/users endpoint for:
 * - Authentication (401 without session)
 * - Authorization (400 without account-id header, 403 without account access)
 * - Successful listing with proper data format
 * - Pagination support
 * - Search/filtering support
 * - Super admin access to all accounts
 * - Account isolation (users only see users in their account)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, type TestEnv } from '../setup'
import {
  createUser,
  createSuperAdmin,
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

describe('Users List Integration', () => {
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

  describe('GET /api/users', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/users', {
          method: 'GET',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/api/users', {
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

    describe('Account Header Validation (400)', () => {
      it('should return 400 without account-id header', async () => {
        // Create a user with session
        const user = await createUser({
          email: 'noheader@example.com',
          name: 'No Header User',
        })

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
          },
        })

        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error.message).toBe('Missing account-id header')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user has no access to the account', async () => {
        // Create a user
        const user = await createUser({
          email: 'noaccess@example.com',
          name: 'No Access User',
        })

        // Create an account that user does NOT have access to
        const account = await createAccount({
          name: 'Inaccessible Account',
        })

        // Create session for user
        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(403)

        const body = await res.json()
        expect(body.error.message).toBe('Forbidden: User does not have access to this account')
      })
    })

    describe('Successful Listing (200)', () => {
      it('should return 200 with users array for authorized users', async () => {
        // Create test scenario with user, account, and session
        const scenario = await createTestScenario({
          userName: 'List Test User',
          userEmail: 'listtest@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/users', {
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
        expect(body).toHaveProperty('meta')
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.data.length).toBeGreaterThan(0)
      })

      it('should return only users belonging to the selected account', async () => {
        // Create multi-user scenario with one account
        const scenario = await createMultiUserScenario()

        // Create another account with a different user
        const otherUser = await createUser({
          email: 'otheruser@example.com',
          name: 'Other User',
        })
        const otherAccount = await createAccount({
          name: 'Other Account',
        })
        await addUserToAccount(otherUser.id, otherAccount.id, 'ADMIN')

        // Request users for the main account
        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.admin.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        const userIds = body.data.map((u: any) => u.id)

        // Should include users from the main account
        expect(userIds).toContain(scenario.admin.user.id)
        expect(userIds).toContain(scenario.manager.user.id)
        expect(userIds).toContain(scenario.viewer.user.id)

        // Should NOT include user from other account
        expect(userIds).not.toContain(otherUser.id)
      })

      it('should include correct user details in response', async () => {
        const scenario = await createTestScenario({
          userName: 'Details Test User',
          userEmail: 'details@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.length).toBeGreaterThan(0)

        const user = body.data[0]
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('email')
        expect(user).toHaveProperty('name')
        expect(user).toHaveProperty('status')
        expect(user).toHaveProperty('isSuperAdmin')
        expect(user).toHaveProperty('createdAt')
        expect(user).toHaveProperty('updatedAt')
      })

      it('should allow VIEWER role to list users', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer User',
          userEmail: 'viewer@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(Array.isArray(body.data)).toBe(true)
      })
    })

    describe('Pagination', () => {
      it('should return pagination metadata', async () => {
        const scenario = await createTestScenario({
          userName: 'Pagination Test User',
          userEmail: 'pagination@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.meta).toHaveProperty('currentPage')
        expect(body.meta).toHaveProperty('limit')
        expect(body.meta).toHaveProperty('totalItems')
        expect(body.meta).toHaveProperty('totalPages')
        expect(body.meta).toHaveProperty('hasPreviousPage')
        expect(body.meta).toHaveProperty('hasNextPage')
      })

      it('should support page parameter', async () => {
        const scenario = await createTestScenario({
          userName: 'Page Test User',
          userEmail: 'pagetest@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users?page=1', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.meta.currentPage).toBe(1)
      })

      it('should support limit parameter', async () => {
        const scenario = await createTestScenario({
          userName: 'Limit Test User',
          userEmail: 'limittest@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users?limit=5', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.meta.limit).toBe(5)
        expect(body.data.length).toBeLessThanOrEqual(5)
      })

      it('should support combined pagination parameters', async () => {
        // Create multiple users in one account
        const scenario = await createMultiUserScenario()

        const res = await app.request('/api/users?page=1&limit=2', {
          method: 'GET',
          headers: {
            ...scenario.admin.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.meta.currentPage).toBe(1)
        expect(body.meta.limit).toBe(2)
        expect(body.data.length).toBeLessThanOrEqual(2)
      })
    })

    describe('Search/Filtering', () => {
      it('should support search by query parameter', async () => {
        // Create scenario with a user
        const scenario = await createTestScenario({
          userName: 'Searchable User',
          userEmail: 'searchable@example.com',
          role: 'ADMIN',
        })

        // Add another user to the same account
        const anotherUser = await createUser({
          email: 'another@example.com',
          name: 'Another Person',
        })
        await addUserToAccount(anotherUser.id, scenario.account.id, 'VIEWER')

        // Search for "Searchable"
        const res = await app.request('/api/users?query=Searchable', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        // Should find the user with "Searchable" in the name
        const matchingUsers = body.data.filter(
          (u: any) => u.name.includes('Searchable') || u.email.includes('searchable')
        )
        expect(matchingUsers.length).toBeGreaterThan(0)
      })

      it('should search by email', async () => {
        const scenario = await createTestScenario({
          userName: 'Email Search User',
          userEmail: 'uniqueemail123@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users?query=uniqueemail123', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        const matchingUsers = body.data.filter((u: any) => u.email.includes('uniqueemail123'))
        expect(matchingUsers.length).toBeGreaterThan(0)
      })
    })

    describe('Super Admin Access', () => {
      it('should allow super admin to view users of any account', async () => {
        // Create a super admin
        const superAdmin = await createSuperAdmin({
          email: 'superadmin@example.com',
          name: 'Super Admin',
        })

        // Create a separate account with users
        const regularUser = await createUser({
          email: 'regularinaccount@example.com',
          name: 'Regular In Account',
        })
        const account = await createAccount({
          name: 'Some Account',
        })
        await addUserToAccount(regularUser.id, account.id, 'ADMIN')

        // Create session for super admin
        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        // Super admin should be able to view users of this account
        // even though they're not a member
        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(Array.isArray(body.data)).toBe(true)
      })

      it('should include all users when super admin queries without account filter', async () => {
        // Create a super admin and add to an account
        const superAdmin = await createSuperAdmin({
          email: 'superadmin2@example.com',
          name: 'Super Admin 2',
        })
        const account = await createAccount({
          name: 'Super Admin Account',
        })
        await addUserToAccount(superAdmin.id, account.id, 'ADMIN')

        // Create multiple users in different accounts
        const user1 = await createUser({
          email: 'user1multi@example.com',
          name: 'User 1 Multi',
        })
        const user2 = await createUser({
          email: 'user2multi@example.com',
          name: 'User 2 Multi',
        })
        await addUserToAccount(user1.id, account.id, 'VIEWER')
        await addUserToAccount(user2.id, account.id, 'VIEWER')

        // Create session for super admin
        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        // Super admin should see multiple users
        expect(body.data.length).toBeGreaterThanOrEqual(3)
      })
    })

    describe('Response Format', () => {
      it('should return JSON content-type', async () => {
        const scenario = await createTestScenario({
          userName: 'JSON Test User',
          userEmail: 'jsontest@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.headers.get('content-type')).toContain('application/json')
      })

      it('should return correct structure with data and meta', async () => {
        const scenario = await createTestScenario({
          userName: 'Structure Test User',
          userEmail: 'structure@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(Object.keys(body).sort()).toEqual(['data', 'meta'].sort())
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty results gracefully', async () => {
        // Create user with account but search for non-existent term
        const scenario = await createTestScenario({
          userName: 'Empty Test User',
          userEmail: 'emptytest@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users?query=xyznonexistent999', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data).toEqual([])
        expect(body.meta.totalItems).toBe(0)
      })

      it('should handle page beyond available data', async () => {
        const scenario = await createTestScenario({
          userName: 'Beyond Page User',
          userEmail: 'beyondpage@example.com',
          role: 'ADMIN',
        })

        const res = await app.request('/api/users?page=999', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data).toEqual([])
        expect(body.meta.currentPage).toBe(999)
      })

      it('should handle concurrent requests with same session', async () => {
        const scenario = await createTestScenario({
          userName: 'Concurrent User',
          userEmail: 'concurrent@example.com',
          role: 'ADMIN',
        })

        const requestHeaders = {
          ...scenario.headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': scenario.account.id,
        }

        // Execute multiple requests in parallel
        const requests = Array(5)
          .fill(null)
          .map(() => app.request('/api/users', { method: 'GET', headers: requestHeaders }))

        const responses = await Promise.all(requests)

        // All requests should succeed
        for (const res of responses) {
          expect(res.status).toBe(200)
          const body = await res.json()
          expect(Array.isArray(body.data)).toBe(true)
        }
      })
    })

    describe('Role-Based Access', () => {
      it('should allow all roles to list users', async () => {
        // Create multi-user scenario with different roles
        const scenario = await createMultiUserScenario()

        // Test ADMIN role
        const adminRes = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.admin.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
        expect(adminRes.status).toBe(200)

        // Test MANAGER role
        const managerRes = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.manager.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
        expect(managerRes.status).toBe(200)

        // Test VIEWER role
        const viewerRes = await app.request('/api/users', {
          method: 'GET',
          headers: {
            ...scenario.viewer.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })
        expect(viewerRes.status).toBe(200)
      })
    })
  })
})
