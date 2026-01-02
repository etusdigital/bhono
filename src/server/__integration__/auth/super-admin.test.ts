/**
 * Super Admin Integration Tests
 *
 * Tests the super admin functionality:
 * - Pre-registration via SUPER_ADMIN_EMAILS environment variable
 * - Super admin bypass for account access restrictions
 * - Super admin status on user creation via OAuth
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { Hono } from 'hono'
import { getEnv, getDb, getSqlite, type TestEnv } from '../setup'
import {
  createUser,
  createSuperAdmin,
  createUserSession,
  createAccount,
  addUserToAccount,
} from '../fixtures'
import type { HonoEnv } from '../../types'
import { api } from '../../routes'
import { auth } from '../../routes/auth'
import { errorHandler } from '../../middleware/error-handler'
import { sessionMiddleware } from '../../lib/session'
import { authService } from '../../services/auth'
import { isSuperAdminEmail } from '../../env'

// ============================================================================
// TEST SETUP
// ============================================================================

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

describe('Super Admin Integration Tests', () => {
  let app: Hono<HonoEnv>
  let env: TestEnv

  beforeAll(() => {
    env = getEnv()
    app = new Hono<HonoEnv>()

    app.onError(errorHandler)

    app.use('*', async (c, next) => {
      ;(c as any).env = env

      const db = createTestDb()
      c.set('db', db)
      c.set('transactionId', crypto.randomUUID())
      c.set('ip', '127.0.0.1')
      c.set('userAgent', 'IntegrationTest/1.0')

      await next()
    })

    app.use('*', sessionMiddleware())
    app.route('/auth', auth)
    app.route('/api', api)
  })

  // ============================================================================
  // PRE-REGISTRATION VIA ENVIRONMENT VARIABLE
  // ============================================================================

  describe('Pre-registration via SUPER_ADMIN_EMAILS', () => {
    it('should identify super admin emails from environment variable', () => {
      // Create env with super admin emails
      const envWithSuperAdmins = {
        ...env,
        SUPER_ADMIN_EMAILS: 'admin@example.com, super@company.org, root@test.io',
      }

      // Test that configured emails are recognized as super admin
      expect(isSuperAdminEmail(envWithSuperAdmins, 'admin@example.com')).toBe(true)
      expect(isSuperAdminEmail(envWithSuperAdmins, 'super@company.org')).toBe(true)
      expect(isSuperAdminEmail(envWithSuperAdmins, 'root@test.io')).toBe(true)

      // Test case-insensitivity
      expect(isSuperAdminEmail(envWithSuperAdmins, 'ADMIN@EXAMPLE.COM')).toBe(true)
      expect(isSuperAdminEmail(envWithSuperAdmins, 'Admin@Example.Com')).toBe(true)

      // Test that non-configured emails are NOT super admin
      expect(isSuperAdminEmail(envWithSuperAdmins, 'regular@example.com')).toBe(false)
      expect(isSuperAdminEmail(envWithSuperAdmins, 'admin@different.com')).toBe(false)
    })

    it('should return false when SUPER_ADMIN_EMAILS is not configured', () => {
      const envWithoutSuperAdmins = {
        ...env,
        SUPER_ADMIN_EMAILS: undefined,
      }

      expect(isSuperAdminEmail(envWithoutSuperAdmins, 'any@example.com')).toBe(false)
      expect(isSuperAdminEmail(envWithoutSuperAdmins, 'admin@example.com')).toBe(false)
    })

    it('should handle empty SUPER_ADMIN_EMAILS', () => {
      const envWithEmptySuperAdmins = {
        ...env,
        SUPER_ADMIN_EMAILS: '',
      }

      expect(isSuperAdminEmail(envWithEmptySuperAdmins, 'admin@example.com')).toBe(false)
    })

    it('should mark new user as super admin when email is pre-registered', async () => {
      const db = createTestDb()

      // Set up env with super admin email
      const envWithSuperAdmin = {
        ...env,
        SUPER_ADMIN_EMAILS: 'newadmin@example.com',
      }

      const googleUser = {
        sub: `google_new_super_${crypto.randomUUID()}`,
        email: 'newadmin@example.com',
        name: 'New Super Admin',
        picture: 'https://example.com/avatar.jpg',
      }

      const ctx = {
        transactionId: crypto.randomUUID(),
        ip: '127.0.0.1',
        userAgent: 'IntegrationTest/1.0',
      }

      const result = await authService.findOrCreateUser(db, envWithSuperAdmin, googleUser, ctx)

      expect(result.isNewUser).toBe(true)
      expect(result.user.isSuperAdmin).toBe(true)
      expect(result.user.email).toBe('newadmin@example.com')

      // Verify in database
      const sqlite = getSqlite()
      const userRow = sqlite
        .prepare('SELECT is_super_admin FROM users WHERE id = ?')
        .get(result.user.id) as { is_super_admin: number }
      expect(userRow.is_super_admin).toBe(1)
    })

    it('should NOT mark new user as super admin when email is not pre-registered', async () => {
      const db = createTestDb()

      // Set up env with different super admin emails
      const envWithSuperAdmin = {
        ...env,
        SUPER_ADMIN_EMAILS: 'otheradmin@example.com',
      }

      const googleUser = {
        sub: `google_regular_${crypto.randomUUID()}`,
        email: 'regular@example.com',
        name: 'Regular User',
        picture: null,
      }

      const ctx = {
        transactionId: crypto.randomUUID(),
        ip: '127.0.0.1',
        userAgent: 'IntegrationTest/1.0',
      }

      const result = await authService.findOrCreateUser(db, envWithSuperAdmin, googleUser, ctx)

      expect(result.isNewUser).toBe(true)
      expect(result.user.isSuperAdmin).toBe(false)
    })
  })

  // ============================================================================
  // SUPER ADMIN ACCOUNT ACCESS BYPASS
  // ============================================================================

  describe('Super admin bypass for account access', () => {
    it('should allow super admin to view accounts they do not belong to', async () => {
      // Create a super admin
      const superAdmin = await createSuperAdmin({
        email: 'super-bypass@example.com',
        name: 'Super Admin Bypass Test',
      })

      // Create an account for super admin context
      const superAdminAccount = await createAccount({ name: 'Super Admin Context Account' })
      await addUserToAccount(superAdmin.id, superAdminAccount.id, 'ADMIN')

      // Create a separate account without super admin access
      const targetAccount = await createAccount({
        name: 'Target Account For Bypass',
        description: 'This account should be accessible by super admin',
      })

      // Create super admin session
      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should be able to access the account they don't belong to
      const res = await app.request(`/api/accounts/${targetAccount.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': superAdminAccount.id,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(targetAccount.id)
      expect(body.data.name).toBe('Target Account For Bypass')
    })

    it('should allow super admin to modify accounts they do not belong to', async () => {
      const superAdmin = await createSuperAdmin({
        email: 'super-modify@example.com',
        name: 'Super Admin Modify Test',
      })

      const superAdminAccount = await createAccount({ name: 'Super Admin Modify Context' })
      await addUserToAccount(superAdmin.id, superAdminAccount.id, 'ADMIN')

      const targetAccount = await createAccount({
        name: 'Target For Modification',
        description: 'Original description',
      })

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should be able to update the target account
      const res = await app.request(`/api/accounts/${targetAccount.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': superAdminAccount.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Modified by Super Admin',
          description: 'Description updated by super admin',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Modified by Super Admin')
      expect(body.data.description).toBe('Description updated by super admin')
    })

    it('should NOT allow regular admin to access accounts they do not belong to', async () => {
      // Create a regular user (not super admin)
      const regularUser = await createUser({
        email: 'regular-admin@example.com',
        name: 'Regular Admin User',
      })

      // Create account for regular user
      const regularUserAccount = await createAccount({ name: 'Regular User Account' })
      await addUserToAccount(regularUser.id, regularUserAccount.id, 'ADMIN')

      // Create a separate account without regular user access
      const targetAccount = await createAccount({
        name: 'Target Account Without Access',
      })

      const { headers } = await createUserSession(regularUser.id, {
        email: regularUser.email,
        name: regularUser.name,
        isSuperAdmin: false,
      })

      // Regular admin should NOT be able to access the account they don't belong to
      const res = await app.request(`/api/accounts/${targetAccount.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': regularUserAccount.id,
        },
      })

      // Should return 404 for security (not 403)
      expect(res.status).toBe(404)
    })

    it('should allow super admin to delete any account', async () => {
      const superAdmin = await createSuperAdmin({
        email: 'super-delete@example.com',
        name: 'Super Admin Delete Test',
      })

      const superAdminAccount = await createAccount({ name: 'Super Admin Delete Context' })
      await addUserToAccount(superAdmin.id, superAdminAccount.id, 'ADMIN')

      // Create account to be deleted
      const accountToDelete = await createAccount({
        name: 'Account To Be Deleted',
      })

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
          'account-id': superAdminAccount.id,
        },
      })

      expect(res.status).toBe(204)

      // Verify soft deletion
      const sqlite = getSqlite()
      const row = sqlite
        .prepare('SELECT deleted_at FROM accounts WHERE id = ?')
        .get(accountToDelete.id) as { deleted_at: string | null }
      expect(row.deleted_at).not.toBeNull()
    })

    it('should allow super admin to view users across all accounts', async () => {
      const superAdmin = await createSuperAdmin({
        email: 'super-view-users@example.com',
        name: 'Super Admin View Users Test',
      })

      const superAdminAccount = await createAccount({ name: 'Super Admin Users Context' })
      await addUserToAccount(superAdmin.id, superAdminAccount.id, 'ADMIN')

      // Create users in different accounts
      const account1 = await createAccount({ name: 'Account 1' })
      const user1 = await createUser({
        email: 'user1-multi@example.com',
        name: 'User In Account 1',
      })
      await addUserToAccount(user1.id, account1.id, 'VIEWER')

      const account2 = await createAccount({ name: 'Account 2' })
      const user2 = await createUser({
        email: 'user2-multi@example.com',
        name: 'User In Account 2',
      })
      await addUserToAccount(user2.id, account2.id, 'VIEWER')

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      // Super admin should see user from account1
      const res1 = await app.request(`/api/users/${user1.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': superAdminAccount.id,
        },
      })
      expect(res1.status).toBe(200)

      // Super admin should see user from account2
      const res2 = await app.request(`/api/users/${user2.id}`, {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
          'account-id': superAdminAccount.id,
        },
      })
      expect(res2.status).toBe(200)
    })
  })

  // ============================================================================
  // SUPER ADMIN SESSION HANDLING
  // ============================================================================

  describe('Super admin session handling', () => {
    it('should return isSuperAdmin=true in /auth/me for super admin users', async () => {
      const superAdmin = await createSuperAdmin({
        email: 'super-me@example.com',
        name: 'Super Admin Me Test',
      })

      const { headers } = await createUserSession(superAdmin.id, {
        email: superAdmin.email,
        name: superAdmin.name,
        isSuperAdmin: true,
      })

      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.isSuperAdmin).toBe(true)
    })

    it('should return isSuperAdmin=false in /auth/me for regular users', async () => {
      const regularUser = await createUser({
        email: 'regular-me@example.com',
        name: 'Regular User Me Test',
      })

      const { headers } = await createUserSession(regularUser.id, {
        email: regularUser.email,
        name: regularUser.name,
        isSuperAdmin: false,
      })

      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          ...headers,
          'User-Agent': 'IntegrationTest/1.0',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.isSuperAdmin).toBe(false)
    })
  })
})
