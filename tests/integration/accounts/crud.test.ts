/**
 * Accounts CRUD Integration Tests
 *
 * Tests the account CRUD operations:
 * - GET /api/accounts - List accounts
 * - GET /api/accounts/:id - Get account by ID
 * - POST /api/accounts - Create account (super-admin only)
 * - PATCH /api/accounts/:id - Update account
 * - DELETE /api/accounts/:id - Soft delete account (super-admin only)
 * - POST /api/accounts/:id/restore - Restore soft-deleted account (super-admin only)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createSuperAdmin,
  createUserSession,
  createTestScenario,
  createMultiUserScenario,
  createMultiTenantScenario,
  createAccount,
  createDeletedAccount,
  addUserToAccount,
} from '../fixtures'
import type { HonoEnv } from '../../../src/server/types'
import { api } from '../../../src/server/routes'
import { errorHandler } from '../../../src/server/middleware/error-handler'
import { sessionMiddleware } from '../../../src/server/lib/session'

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

describe('Accounts CRUD Integration', () => {
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
  // GET /api/accounts
  // ============================================================================

  describe('GET /api/accounts', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/accounts', {
          method: 'GET',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })

      it('should return 401 with invalid session ID', async () => {
        const res = await app.request('/api/accounts', {
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

    describe('Successful List (200)', () => {
      it('should return 200 with accounts array', async () => {
        const scenario = await createTestScenario({
          userName: 'List Accounts User',
          userEmail: 'listaccounts@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/accounts', {
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
        expect(body).toHaveProperty('meta')
      })

      it('should return only accounts the user has access to', async () => {
        const scenario = await createMultiTenantScenario()

        const res = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.accounts.withAccess[0].account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        const accountIds = body.data.map((a: any) => a.id)

        // User should see all accounts they have access to
        for (const { account } of scenario.accounts.withAccess) {
          expect(accountIds).toContain(account.id)
        }

        // User should NOT see accounts without access
        for (const account of scenario.accounts.withoutAccess) {
          expect(accountIds).not.toContain(account.id)
        }
      })

      it('should allow super admin to see all accounts', async () => {
        // Create some accounts
        const account1 = await createAccount({ name: 'Super Admin Test 1' })
        const account2 = await createAccount({ name: 'Super Admin Test 2' })
        const account3 = await createAccount({ name: 'Super Admin Test 3' })

        // Create a super admin (not member of any of these accounts)
        const superAdmin = await createSuperAdmin({
          email: 'superadminlist@example.com',
          name: 'Super Admin Lister',
        })

        // Super admin still needs an account context for the middleware
        // Create a separate account for the super admin
        const adminAccount = await createAccount({ name: 'Admin Context Account' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        const accountIds = body.data.map((a: any) => a.id)

        // Super admin should see all accounts
        expect(accountIds).toContain(account1.id)
        expect(accountIds).toContain(account2.id)
        expect(accountIds).toContain(account3.id)
      })

      it('should include pagination meta', async () => {
        const scenario = await createTestScenario({
          userName: 'Pagination Test User',
          userEmail: 'paginationtest@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.meta).toHaveProperty('totalItems')
        expect(body.meta).toHaveProperty('currentPage')
        expect(body.meta).toHaveProperty('limit')
        expect(body.meta).toHaveProperty('totalPages')
      })
    })
  })

  // ============================================================================
  // GET /api/accounts/:id
  // ============================================================================

  describe('GET /api/accounts/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const accountId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${accountId}`, {
          method: 'GET',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body).toHaveProperty('error')
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent account', async () => {
        const scenario = await createTestScenario({
          userName: 'Get Account User',
          userEmail: 'getaccount@example.com',
          role: 'VIEWER',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${nonExistentId}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(404)

        const body = await res.json()
        expect(body.error.message).toContain('Account')
      })

      it('should return 404 if user has no access to account (security - no reveal)', async () => {
        const scenario = await createMultiTenantScenario()

        // Try to access an account the user doesn't have access to
        const accountWithoutAccess = scenario.accounts.withoutAccess[0]

        const res = await app.request(`/api/accounts/${accountWithoutAccess.id}`, {
          method: 'GET',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.accounts.withAccess[0].account.id,
          },
        })

        // Returns 404 (not 403) for security - don't reveal account exists
        expect(res.status).toBe(404)
      })
    })

    describe('Successful Get (200)', () => {
      it('should return 200 with account details', async () => {
        const scenario = await createTestScenario({
          userName: 'Get Account Detail User',
          userEmail: 'getaccountdetail@example.com',
          accountName: 'Test Account Details',
          role: 'VIEWER',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
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
        expect(body.data.id).toBe(scenario.account.id)
        expect(body.data.name).toBe(scenario.account.name)
      })

      it('should include all account fields in response', async () => {
        const account = await createAccount({
          name: 'Full Fields Account',
          description: 'Test description',
          domain: 'fullfields.example.com',
        })

        const user = await createUser({
          email: 'fullfields@example.com',
          name: 'Full Fields User',
        })
        await addUserToAccount(user.id, account.id, 'VIEWER')

        const { headers } = await createUserSession(user.id, {
          email: user.email,
          name: user.name,
        })

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data).toHaveProperty('id')
        expect(body.data).toHaveProperty('name')
        expect(body.data).toHaveProperty('description')
        expect(body.data).toHaveProperty('domain')
        expect(body.data).toHaveProperty('createdAt')
        expect(body.data).toHaveProperty('updatedAt')
      })

      it('should allow super admin to get any account', async () => {
        // Create an account without super admin membership
        const account = await createAccount({ name: 'Super Admin Get Test' })

        // Create a super admin with their own account context
        const superAdmin = await createSuperAdmin({
          email: 'superadminget@example.com',
          name: 'Super Admin Getter',
        })
        const adminAccount = await createAccount({ name: 'Admin Get Context' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request(`/api/accounts/${account.id}`, {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.id).toBe(account.id)
      })
    })
  })

  // ============================================================================
  // POST /api/accounts
  // ============================================================================

  describe('POST /api/accounts', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Account' }),
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks ADMIN role', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer Create Account',
          userEmail: 'viewercreate@example.com',
          role: 'VIEWER',
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Account' }),
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user has ADMIN role but is not super-admin', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin Not Super',
          userEmail: 'adminnotsuper@example.com',
          role: 'ADMIN',
          isSuperAdmin: false,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Account' }),
        })

        expect(res.status).toBe(403)

        const body = await res.json()
        expect(body.error.message).toContain('super-admin')
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for missing name', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'supervalidation@example.com',
          name: 'Super Validation',
        })
        const account = await createAccount({ name: 'Super Context' })
        await addUserToAccount(superAdmin.id, account.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })

        expect(res.status).toBe(400)
      })

      it('should return 400 for empty name', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superemptyname@example.com',
          name: 'Super Empty Name',
        })
        const account = await createAccount({ name: 'Super Context Empty' })
        await addUserToAccount(superAdmin.id, account.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: '' }),
        })

        expect(res.status).toBe(400)
      })
    })

    describe('Conflict (409)', () => {
      it('should return 409 if domain already exists', async () => {
        // Create account with a specific domain
        await createAccount({
          name: 'Existing Domain Account',
          domain: 'existing-domain.example.com',
        })

        const superAdmin = await createSuperAdmin({
          email: 'superdomain@example.com',
          name: 'Super Domain',
        })
        const adminAccount = await createAccount({ name: 'Super Context Domain' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'New Account With Duplicate Domain',
            domain: 'existing-domain.example.com',
          }),
        })

        expect(res.status).toBe(409)

        const body = await res.json()
        expect(body.error.message).toContain('domain')
      })
    })

    describe('Successful Create (201)', () => {
      it('should return 201 on successful creation', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'supercreate@example.com',
          name: 'Super Creator',
        })
        const adminAccount = await createAccount({ name: 'Super Context Create' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Newly Created Account',
            description: 'A test account',
            domain: 'newaccount.example.com',
          }),
        })

        expect(res.status).toBe(201)

        const body = await res.json()
        expect(body).toHaveProperty('data')
        expect(body.data.name).toBe('Newly Created Account')
        expect(body.data.description).toBe('A test account')
        expect(body.data.domain).toBe('newaccount.example.com')
      })

      it('should verify account is created in database', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superverify@example.com',
          name: 'Super Verifier',
        })
        const adminAccount = await createAccount({ name: 'Super Context Verify' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Database Verify Account',
          }),
        })

        expect(res.status).toBe(201)

        const body = await res.json()
        const createdId = body.data.id

        // Verify in database
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT name FROM accounts WHERE id = ?').get(createdId) as { name: string }
        expect(row.name).toBe('Database Verify Account')
      })

      it('should allow creation with only required fields', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superminimal@example.com',
          name: 'Super Minimal',
        })
        const adminAccount = await createAccount({ name: 'Super Context Minimal' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request('/api/accounts', {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Minimal Account',
          }),
        })

        expect(res.status).toBe(201)

        const body = await res.json()
        expect(body.data.name).toBe('Minimal Account')
        expect(body.data.description).toBeNull()
        expect(body.data.domain).toBeNull()
      })
    })
  })

  // ============================================================================
  // PATCH /api/accounts/:id
  // ============================================================================

  describe('PATCH /api/accounts/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const accountId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${accountId}`, {
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
      it('should return 404 for non-existent account', async () => {
        const scenario = await createTestScenario({
          userName: 'Update Not Found User',
          userEmail: 'updatenotfound@example.com',
          role: 'MANAGER',
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${nonExistentId}`, {
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

    describe('Authorization (403/404)', () => {
      it('should return 404 if user has no access to account', async () => {
        const scenario = await createMultiTenantScenario()
        const accountWithoutAccess = scenario.accounts.withoutAccess[0]

        // Need to use an account with MANAGER role for the account-id header
        const accountWithManagerAccess = scenario.accounts.withAccess.find(a => a.role === 'MANAGER')!

        const res = await app.request(`/api/accounts/${accountWithoutAccess.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': accountWithManagerAccess.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Not Update' }),
        })

        // Returns 404 for security - don't reveal account exists
        expect(res.status).toBe(404)
      })
    })

    describe('Validation (400)', () => {
      it('should return 400 for empty name', async () => {
        const scenario = await createTestScenario({
          userName: 'Update Validation User',
          userEmail: 'updatevalidation@example.com',
          role: 'MANAGER',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
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
    })

    describe('Conflict (409)', () => {
      it('should return 409 if updating to existing domain', async () => {
        // Create account with a domain
        await createAccount({
          name: 'Domain Conflict Target',
          domain: 'conflict-target.example.com',
        })

        const scenario = await createTestScenario({
          userName: 'Update Domain Conflict',
          userEmail: 'updatedomainconflict@example.com',
          role: 'MANAGER',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain: 'conflict-target.example.com' }),
        })

        expect(res.status).toBe(409)

        const body = await res.json()
        expect(body.error.message).toContain('domain')
      })
    })

    describe('Successful Update (200)', () => {
      it('should return 200 on successful name update', async () => {
        const scenario = await createTestScenario({
          userName: 'Update Name User',
          userEmail: 'updatename@example.com',
          accountName: 'Original Account Name',
          role: 'MANAGER',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated Account Name' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.name).toBe('Updated Account Name')
      })

      it('should return 200 on successful description update', async () => {
        const scenario = await createTestScenario({
          userName: 'Update Description User',
          userEmail: 'updatedesc@example.com',
          role: 'MANAGER',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: 'New description' }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.description).toBe('New description')
      })

      it('should update multiple fields at once', async () => {
        const scenario = await createTestScenario({
          userName: 'Update Multiple User',
          userEmail: 'updatemultiple@example.com',
          role: 'ADMIN',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Multi Update Name',
            description: 'Multi Update Description',
            domain: 'multiupdate.example.com',
          }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.name).toBe('Multi Update Name')
        expect(body.data.description).toBe('Multi Update Description')
        expect(body.data.domain).toBe('multiupdate.example.com')
      })

      it('should verify database is updated after PATCH', async () => {
        const scenario = await createTestScenario({
          userName: 'Verify Update User',
          userEmail: 'verifyupdate@example.com',
          role: 'MANAGER',
        })

        await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Database Updated Name' }),
        })

        // Verify by fetching the account again
        const getRes = await app.request(`/api/accounts/${scenario.account.id}`, {
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

      it('should allow ADMIN role to update account', async () => {
        const scenario = await createMultiUserScenario()

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'PATCH',
          headers: {
            ...scenario.admin.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Admin Updated Name' }),
        })

        expect(res.status).toBe(200)
      })
    })
  })

  // ============================================================================
  // DELETE /api/accounts/:id
  // ============================================================================

  describe('DELETE /api/accounts/:id', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const accountId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${accountId}`, {
          method: 'DELETE',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent account', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superdeletenotfound@example.com',
          name: 'Super Delete Not Found',
        })
        const adminAccount = await createAccount({ name: 'Super Delete Context' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${nonExistentId}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(404)
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks ADMIN role', async () => {
        const scenario = await createTestScenario({
          userName: 'Viewer Delete Account',
          userEmail: 'viewerdelete@example.com',
          role: 'VIEWER',
        })

        const res = await app.request(`/api/accounts/${scenario.account.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user has ADMIN role but is not super-admin', async () => {
        const scenario = await createTestScenario({
          userName: 'Admin Not Super Delete',
          userEmail: 'adminnotsuperdelete@example.com',
          role: 'ADMIN',
          isSuperAdmin: false,
        })

        // Create another account to delete
        const accountToDelete = await createAccount({ name: 'To Be Deleted' })
        await addUserToAccount(scenario.user.id, accountToDelete.id, 'ADMIN')

        const res = await app.request(`/api/accounts/${accountToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)

        const body = await res.json()
        expect(body.error.message).toContain('super-admin')
      })
    })

    describe('Successful Delete (204)', () => {
      it('should return 204 on successful delete', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superdelete@example.com',
          name: 'Super Deleter',
        })
        const adminAccount = await createAccount({ name: 'Super Context Delete' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create account to delete
        const accountToDelete = await createAccount({ name: 'Account To Delete' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request(`/api/accounts/${accountToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(204)
      })

      it('should verify deleted_at is set (soft delete)', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superverifydelete@example.com',
          name: 'Super Verify Deleter',
        })
        const adminAccount = await createAccount({ name: 'Super Context Verify Delete' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create account to delete
        const accountToDelete = await createAccount({ name: 'Soft Delete Verify' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        await app.request(`/api/accounts/${accountToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        // Verify in database that deleted_at is set
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT deleted_at FROM accounts WHERE id = ?').get(accountToDelete.id) as { deleted_at: string | null }
        expect(row.deleted_at).not.toBeNull()
      })

      it('should not appear in accounts list after deletion', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superlistdelete@example.com',
          name: 'Super List Deleter',
        })
        const adminAccount = await createAccount({ name: 'Super Context List Delete' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create account to delete
        const accountToDelete = await createAccount({ name: 'Will Not Appear In List' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        // Delete the account
        await app.request(`/api/accounts/${accountToDelete.id}`, {
          method: 'DELETE',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        // List accounts and verify deleted account is not included
        const listRes = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(listRes.status).toBe(200)

        const body = await listRes.json()
        const accountIds = body.data.map((a: any) => a.id)
        expect(accountIds).not.toContain(accountToDelete.id)
      })
    })
  })

  // ============================================================================
  // POST /api/accounts/:id/restore
  // ============================================================================

  describe('POST /api/accounts/:id/restore', () => {
    describe('Authentication (401)', () => {
      it('should return 401 without session cookie', async () => {
        const accountId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${accountId}/restore`, {
          method: 'POST',
        })

        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error.message).toBe('Not authenticated')
      })
    })

    describe('Not Found (404)', () => {
      it('should return 404 for non-existent account', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superrestorenotfound@example.com',
          name: 'Super Restore Not Found',
        })
        const adminAccount = await createAccount({ name: 'Super Restore Context' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const nonExistentId = crypto.randomUUID()
        const res = await app.request(`/api/accounts/${nonExistentId}/restore`, {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(404)
      })

      it('should return 404 for account that is not deleted', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superrestorenotdeleted@example.com',
          name: 'Super Restore Not Deleted',
        })
        const adminAccount = await createAccount({ name: 'Super Restore Not Deleted Context' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create account that is NOT deleted
        const activeAccount = await createAccount({ name: 'Active Account' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request(`/api/accounts/${activeAccount.id}/restore`, {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(404)

        const body = await res.json()
        expect(body.error.message).toContain('not deleted')
      })
    })

    describe('Authorization (403)', () => {
      it('should return 403 if user lacks ADMIN role', async () => {
        const deletedAccount = await createDeletedAccount({ name: 'Deleted For Viewer' })

        const scenario = await createTestScenario({
          userName: 'Viewer Restore Account',
          userEmail: 'viewerrestore@example.com',
          role: 'VIEWER',
        })

        const res = await app.request(`/api/accounts/${deletedAccount.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)
      })

      it('should return 403 if user has ADMIN role but is not super-admin', async () => {
        const deletedAccount = await createDeletedAccount({ name: 'Deleted For Admin' })

        const scenario = await createTestScenario({
          userName: 'Admin Not Super Restore',
          userEmail: 'adminnotsuperrestore@example.com',
          role: 'ADMIN',
          isSuperAdmin: false,
        })

        const res = await app.request(`/api/accounts/${deletedAccount.id}/restore`, {
          method: 'POST',
          headers: {
            ...scenario.headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': scenario.account.id,
          },
        })

        expect(res.status).toBe(403)

        const body = await res.json()
        expect(body.error.message).toContain('super-admin')
      })
    })

    describe('Successful Restore (200)', () => {
      it('should return 200 on successful restore', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superrestore@example.com',
          name: 'Super Restorer',
        })
        const adminAccount = await createAccount({ name: 'Super Context Restore' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create deleted account
        const deletedAccount = await createDeletedAccount({ name: 'Account To Restore' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        const res = await app.request(`/api/accounts/${deletedAccount.id}/restore`, {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.id).toBe(deletedAccount.id)
        expect(body.data.deletedAt).toBeNull()
      })

      it('should verify deleted_at is cleared after restore', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superverifyrestore@example.com',
          name: 'Super Verify Restorer',
        })
        const adminAccount = await createAccount({ name: 'Super Context Verify Restore' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create deleted account
        const deletedAccount = await createDeletedAccount({ name: 'Verify Deleted At Cleared' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        // Restore the account
        await app.request(`/api/accounts/${deletedAccount.id}/restore`, {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        // Verify in database that deleted_at is cleared
        const sqlite = getSqlite()
        const row = sqlite.prepare('SELECT deleted_at FROM accounts WHERE id = ?').get(deletedAccount.id) as { deleted_at: string | null }
        expect(row.deleted_at).toBeNull()
      })

      it('should appear in accounts list after restoration', async () => {
        const superAdmin = await createSuperAdmin({
          email: 'superlistrestore@example.com',
          name: 'Super List Restorer',
        })
        const adminAccount = await createAccount({ name: 'Super Context List Restore' })
        await addUserToAccount(superAdmin.id, adminAccount.id, 'ADMIN')

        // Create deleted account
        const deletedAccount = await createDeletedAccount({ name: 'Will Appear After Restore' })

        const { headers } = await createUserSession(superAdmin.id, {
          email: superAdmin.email,
          name: superAdmin.name,
          isSuperAdmin: true,
        })

        // Verify account is NOT in list before restore
        const listBefore = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        const bodyBefore = await listBefore.json()
        const accountIdsBefore = bodyBefore.data.map((a: any) => a.id)
        expect(accountIdsBefore).not.toContain(deletedAccount.id)

        // Restore the account
        await app.request(`/api/accounts/${deletedAccount.id}/restore`, {
          method: 'POST',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        // Verify account IS in list after restore
        const listAfter = await app.request('/api/accounts', {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IntegrationTest/1.0',
            'account-id': adminAccount.id,
          },
        })

        const bodyAfter = await listAfter.json()
        const accountIdsAfter = bodyAfter.data.map((a: any) => a.id)
        expect(accountIdsAfter).toContain(deletedAccount.id)
      })
    })
  })
})
