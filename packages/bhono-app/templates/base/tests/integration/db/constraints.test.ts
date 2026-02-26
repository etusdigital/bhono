/**
 * Database Constraints Integration Tests
 *
 * Tests database-level constraints:
 * - Unique constraints (google_id, account domain, invitation email per account)
 * - Foreign key constraints
 * - Check constraints (role values, status values, action values)
 * - Cascade delete behavior
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getSqlite } from '../setup'
import { createUser, createAccount, addUserToAccount, createInvitation } from '../fixtures'

describe('Database Constraints Integration Tests', () => {
  // ============================================================================
  // UNIQUE CONSTRAINTS
  // ============================================================================

  describe('Unique constraints', () => {
    describe('users.google_id unique constraint', () => {
      it('should reject duplicate google_id', async () => {
        const user = await createUser({
          email: 'first-user@example.com',
          name: 'First User',
        })

        const sqlite = getSqlite()

        // Try to insert another user with the same google_id
        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO users (id, google_id, email, name, status, is_super_admin)
            VALUES (?, ?, ?, ?, ?, ?)
          `
            )
            .run(crypto.randomUUID(), user.googleId, 'different-email@example.com', 'Different User', 'active', 0)
        }).toThrow(/UNIQUE constraint failed/)
      })

      it('should allow different google_ids for different users', async () => {
        await createUser({
          email: 'user-a@example.com',
          name: 'User A',
        })

        // Different google_id should work
        const userB = await createUser({
          email: 'user-b@example.com',
          name: 'User B',
        })

        expect(userB.id).toBeDefined()
      })
    })

    describe('accounts.domain unique constraint', () => {
      it('should reject duplicate domain', async () => {
        await createAccount({
          name: 'Account 1',
          domain: 'unique-domain.com',
        })

        const sqlite = getSqlite()

        // Try to create another account with same domain
        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO accounts (id, name, domain)
            VALUES (?, ?, ?)
          `
            )
            .run(crypto.randomUUID(), 'Account 2', 'unique-domain.com')
        }).toThrow(/UNIQUE constraint failed/)
      })

      it('should allow null domains (not subject to unique constraint)', async () => {
        await createAccount({
          name: 'Account Without Domain 1',
        })

        const account2 = await createAccount({
          name: 'Account Without Domain 2',
        })

        expect(account2.id).toBeDefined()
      })

      it('should allow different domains', async () => {
        await createAccount({
          name: 'Account Domain A',
          domain: 'domain-a.com',
        })

        const accountB = await createAccount({
          name: 'Account Domain B',
          domain: 'domain-b.com',
        })

        expect(accountB.id).toBeDefined()
      })
    })

    describe('invitations unique constraint (account_id, email)', () => {
      it('should reject duplicate invitation to same email in same account', async () => {
        const user = await createUser({ email: 'inviter@example.com', name: 'Inviter' })
        const account = await createAccount({ name: 'Invitation Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        await createInvitation({
          accountId: account.id,
          email: 'invitee@example.com',
          role: 'viewer',
          invitedById: user.id,
        })

        const sqlite = getSqlite()

        // Try to create another invitation with same email in same account
        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              crypto.randomUUID(),
              account.id,
              'invitee@example.com',
              'user',
              crypto.randomUUID(),
              user.id,
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            )
        }).toThrow(/UNIQUE constraint failed/)
      })

      it('should allow same email to be invited to different accounts', async () => {
        const user = await createUser({ email: 'multi-inviter@example.com', name: 'Multi Inviter' })

        const account1 = await createAccount({ name: 'Account for Invite 1' })
        await addUserToAccount(user.id, account1.id, 'admin')

        const account2 = await createAccount({ name: 'Account for Invite 2' })
        await addUserToAccount(user.id, account2.id, 'admin')

        // Invite same email to account 1
        await createInvitation({
          accountId: account1.id,
          email: 'multi-invitee@example.com',
          role: 'viewer',
          invitedById: user.id,
        })

        // Invite same email to account 2 - should succeed
        const invite2 = await createInvitation({
          accountId: account2.id,
          email: 'multi-invitee@example.com',
          role: 'viewer',
          invitedById: user.id,
        })

        expect(invite2.id).toBeDefined()
      })
    })

    describe('invitations.token unique constraint', () => {
      it('should reject duplicate invitation tokens', async () => {
        const user = await createUser({ email: 'token-inviter@example.com', name: 'Token Inviter' })
        const account = await createAccount({ name: 'Token Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        const sqlite = getSqlite()
        const duplicateToken = crypto.randomUUID()

        // Create first invitation with specific token
        sqlite
          .prepare(
            `
          INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            crypto.randomUUID(),
            account.id,
            'token-test-1@example.com',
            'viewer',
            duplicateToken,
            user.id,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          )

        // Try to create another invitation with same token
        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              crypto.randomUUID(),
              account.id,
              'token-test-2@example.com',
              'viewer',
              duplicateToken,
              user.id,
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            )
        }).toThrow(/UNIQUE constraint failed/)
      })
    })

    describe('user_accounts primary key constraint', () => {
      it('should reject duplicate user-account combination', async () => {
        const user = await createUser({ email: 'dup-role@example.com', name: 'Dup Role User' })
        const account = await createAccount({ name: 'Dup Role Account' })

        await addUserToAccount(user.id, account.id, 'admin')

        const sqlite = getSqlite()

        // Try to add same user to same account again
        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO user_accounts (user_id, account_id, role)
            VALUES (?, ?, ?)
          `
            )
            .run(user.id, account.id, 'viewer')
        }).toThrow(/UNIQUE constraint failed|PRIMARY KEY constraint/)
      })
    })
  })

  // ============================================================================
  // FOREIGN KEY CONSTRAINTS
  // ============================================================================

  describe('Foreign key constraints', () => {
    describe('user_accounts foreign keys', () => {
      it('should reject non-existent user_id', () => {
        const sqlite = getSqlite()
        const fakeUserId = crypto.randomUUID()

        // Create a real account first
        const accountId = crypto.randomUUID()
        sqlite
          .prepare(
            `
          INSERT INTO accounts (id, name)
          VALUES (?, ?)
        `
          )
          .run(accountId, 'FK Test Account')

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO user_accounts (user_id, account_id, role)
            VALUES (?, ?, ?)
          `
            )
            .run(fakeUserId, accountId, 'viewer')
        }).toThrow(/FOREIGN KEY constraint failed/)
      })

      it('should reject non-existent account_id', async () => {
        const user = await createUser({ email: 'fk-user@example.com', name: 'FK User' })
        const fakeAccountId = crypto.randomUUID()

        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO user_accounts (user_id, account_id, role)
            VALUES (?, ?, ?)
          `
            )
            .run(user.id, fakeAccountId, 'viewer')
        }).toThrow(/FOREIGN KEY constraint failed/)
      })
    })

    describe('invitations foreign keys', () => {
      it('should reject non-existent account_id', async () => {
        const user = await createUser({ email: 'fk-inviter@example.com', name: 'FK Inviter' })
        const fakeAccountId = crypto.randomUUID()

        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              crypto.randomUUID(),
              fakeAccountId,
              'test@example.com',
              'viewer',
              crypto.randomUUID(),
              user.id,
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            )
        }).toThrow(/FOREIGN KEY constraint failed/)
      })

      it('should reject non-existent invited_by_id', async () => {
        const account = await createAccount({ name: 'FK Invite Account' })
        const fakeUserId = crypto.randomUUID()

        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              crypto.randomUUID(),
              account.id,
              'test@example.com',
              'viewer',
              crypto.randomUUID(),
              fakeUserId,
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            )
        }).toThrow(/FOREIGN KEY constraint failed/)
      })
    })

    describe('refresh_tokens foreign keys', () => {
      it('should reject non-existent user_id', () => {
        const sqlite = getSqlite()
        const fakeUserId = crypto.randomUUID()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
          `
            )
            .run(
              crypto.randomUUID(),
              fakeUserId,
              'somehash',
              Math.floor(Date.now() / 1000) + 3600,
              Math.floor(Date.now() / 1000)
            )
        }).toThrow(/FOREIGN KEY constraint failed/)
      })
    })

    describe('audit_logs foreign keys', () => {
      it('should accept null account_id (for system-wide events)', () => {
        const sqlite = getSqlite()

        // Should not throw - null account_id is allowed
        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO audit_logs (id, transaction_id, account_id, user_id, entity, entity_id, action)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(crypto.randomUUID(), crypto.randomUUID(), null, null, 'System', 'system', 'INSERT')
        }).not.toThrow()
      })
    })
  })

  // ============================================================================
  // CHECK CONSTRAINTS
  // ============================================================================

  describe('Check constraints', () => {
    describe('users.status check constraint', () => {
      it('should accept valid status values', async () => {
        const activeUser = await createUser({
          email: 'active-status@example.com',
          name: 'Active User',
          status: 'active',
        })
        expect(activeUser.status).toBe('active')

        const inactiveUser = await createUser({
          email: 'inactive-status@example.com',
          name: 'Inactive User',
          status: 'inactive',
        })
        expect(inactiveUser.status).toBe('inactive')
      })

      it('should reject invalid status values', () => {
        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO users (id, google_id, email, name, status, is_super_admin)
            VALUES (?, ?, ?, ?, ?, ?)
          `
            )
            .run(crypto.randomUUID(), crypto.randomUUID(), 'invalid-status@example.com', 'Invalid Status User', 'invalid_status', 0)
        }).toThrow(/CHECK constraint failed/)
      })
    })

    describe('user_accounts.role check constraint', () => {
      it('should accept valid role values', async () => {
        const user = await createUser({ email: 'role-check@example.com', name: 'Role Check User' })
        const account = await createAccount({ name: 'Role Check Account' })

        const validRoles = ['admin', 'manager', 'user', 'user', 'viewer', 'viewer', 'viewer']

        for (const role of validRoles) {
          const sqlite = getSqlite()
          // First remove any existing association
          sqlite.prepare('DELETE FROM user_accounts WHERE user_id = ? AND account_id = ?').run(user.id, account.id)

          // Then add with new role
          expect(() => {
            sqlite
              .prepare(
                `
              INSERT INTO user_accounts (user_id, account_id, role)
              VALUES (?, ?, ?)
            `
              )
              .run(user.id, account.id, role)
          }).not.toThrow()
        }
      })

      it('should reject invalid role values', async () => {
        const user = await createUser({ email: 'invalid-role@example.com', name: 'Invalid Role User' })
        const account = await createAccount({ name: 'Invalid Role Account' })

        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO user_accounts (user_id, account_id, role)
            VALUES (?, ?, ?)
          `
            )
            .run(user.id, account.id, 'SUPER_ADMIN')
        }).toThrow(/CHECK constraint failed/)

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO user_accounts (user_id, account_id, role)
            VALUES (?, ?, ?)
          `
            )
            .run(user.id, account.id, 'invalid_role')
        }).toThrow(/CHECK constraint failed/)
      })
    })

    describe('invitations.role check constraint', () => {
      it('should accept valid invitation role values', async () => {
        const user = await createUser({ email: 'invite-role-check@example.com', name: 'Invite Role Check' })
        const account = await createAccount({ name: 'Invite Role Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        const validRoles = ['admin', 'manager', 'user', 'user', 'viewer', 'viewer', 'viewer']

        for (let i = 0; i < validRoles.length; i++) {
          const invitation = await createInvitation({
            accountId: account.id,
            email: `invite-role-${i}@example.com`,
            role: validRoles[i] as any,
            invitedById: user.id,
          })
          expect(invitation.role).toBe(validRoles[i])
        }
      })

      it('should reject invalid invitation role values', async () => {
        const user = await createUser({ email: 'invalid-invite-role@example.com', name: 'Invalid Invite Role' })
        const account = await createAccount({ name: 'Invalid Invite Role Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO invitations (id, account_id, email, role, token, invited_by_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              crypto.randomUUID(),
              account.id,
              'invalid-role-invite@example.com',
              'OWNER',
              crypto.randomUUID(),
              user.id,
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            )
        }).toThrow(/CHECK constraint failed/)
      })
    })

    describe('audit_logs.action check constraint', () => {
      it('should accept valid action values', () => {
        const sqlite = getSqlite()
        const validActions = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'TOKEN_REFRESH', 'LOGIN_FAILED']

        for (const action of validActions) {
          expect(() => {
            sqlite
              .prepare(
                `
              INSERT INTO audit_logs (id, transaction_id, entity, entity_id, action)
              VALUES (?, ?, ?, ?, ?)
            `
              )
              .run(crypto.randomUUID(), crypto.randomUUID(), 'Test', crypto.randomUUID(), action)
          }).not.toThrow()
        }
      })

      it('should reject invalid action values', () => {
        const sqlite = getSqlite()

        expect(() => {
          sqlite
            .prepare(
              `
            INSERT INTO audit_logs (id, transaction_id, entity, entity_id, action)
            VALUES (?, ?, ?, ?, ?)
          `
            )
            .run(crypto.randomUUID(), crypto.randomUUID(), 'Test', crypto.randomUUID(), 'INVALID_ACTION')
        }).toThrow(/CHECK constraint failed/)
      })
    })
  })

  // ============================================================================
  // CASCADE DELETE
  // ============================================================================

  describe('Cascade delete behavior', () => {
    describe('user deletion cascades', () => {
      it('should cascade delete user_accounts when user is deleted', async () => {
        const user = await createUser({ email: 'cascade-user@example.com', name: 'Cascade User' })
        const account = await createAccount({ name: 'Cascade Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        const sqlite = getSqlite()

        // Verify user_account exists
        const before = sqlite
          .prepare('SELECT * FROM user_accounts WHERE user_id = ?')
          .all(user.id) as any[]
        expect(before.length).toBe(1)

        // Delete user
        sqlite.prepare('DELETE FROM users WHERE id = ?').run(user.id)

        // Verify user_account is deleted
        const after = sqlite
          .prepare('SELECT * FROM user_accounts WHERE user_id = ?')
          .all(user.id) as any[]
        expect(after.length).toBe(0)
      })

      it('should cascade delete refresh_tokens when user is deleted', async () => {
        const user = await createUser({ email: 'cascade-token@example.com', name: 'Cascade Token User' })

        const sqlite = getSqlite()

        // Create refresh token
        sqlite
          .prepare(
            `
          INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)
        `
          )
          .run(
            crypto.randomUUID(),
            user.id,
            'somehash123',
            Math.floor(Date.now() / 1000) + 3600,
            Math.floor(Date.now() / 1000)
          )

        // Verify token exists
        const before = sqlite
          .prepare('SELECT * FROM refresh_tokens WHERE user_id = ?')
          .all(user.id) as any[]
        expect(before.length).toBe(1)

        // Delete user
        sqlite.prepare('DELETE FROM users WHERE id = ?').run(user.id)

        // Verify token is deleted
        const after = sqlite
          .prepare('SELECT * FROM refresh_tokens WHERE user_id = ?')
          .all(user.id) as any[]
        expect(after.length).toBe(0)
      })
    })

    describe('account deletion cascades', () => {
      it('should cascade delete user_accounts when account is deleted', async () => {
        const user = await createUser({ email: 'cascade-acct@example.com', name: 'Cascade Acct User' })
        const account = await createAccount({ name: 'Cascade Delete Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        const sqlite = getSqlite()

        // Verify user_account exists
        const before = sqlite
          .prepare('SELECT * FROM user_accounts WHERE account_id = ?')
          .all(account.id) as any[]
        expect(before.length).toBe(1)

        // Delete account
        sqlite.prepare('DELETE FROM accounts WHERE id = ?').run(account.id)

        // Verify user_account is deleted
        const after = sqlite
          .prepare('SELECT * FROM user_accounts WHERE account_id = ?')
          .all(account.id) as any[]
        expect(after.length).toBe(0)
      })

      it('should cascade delete invitations when account is deleted', async () => {
        const user = await createUser({ email: 'cascade-invite@example.com', name: 'Cascade Invite User' })
        const account = await createAccount({ name: 'Cascade Invite Account' })
        await addUserToAccount(user.id, account.id, 'admin')

        await createInvitation({
          accountId: account.id,
          email: 'cascade-invitee@example.com',
          role: 'viewer',
          invitedById: user.id,
        })

        const sqlite = getSqlite()

        // Verify invitation exists
        const before = sqlite
          .prepare('SELECT * FROM invitations WHERE account_id = ?')
          .all(account.id) as any[]
        expect(before.length).toBe(1)

        // Delete account (need to delete user_accounts first due to FK on invitations.invited_by_id)
        sqlite.prepare('DELETE FROM user_accounts WHERE account_id = ?').run(account.id)
        sqlite.prepare('DELETE FROM accounts WHERE id = ?').run(account.id)

        // Verify invitation is deleted
        const after = sqlite
          .prepare('SELECT * FROM invitations WHERE account_id = ?')
          .all(account.id) as any[]
        expect(after.length).toBe(0)
      })
    })
  })
})
