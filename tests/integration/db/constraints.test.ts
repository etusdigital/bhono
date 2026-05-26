/**
 * Database Constraints Integration Tests
 *
 * These tests intentionally mirror the @etus/auth-owned auth_* schema. They
 * validate constraints that actually exist in schema.sql instead of preserving
 * assumptions from the legacy local auth tables.
 */

import { describe, it, expect } from 'vitest'
import { getSqlite } from '../setup'

function insertUser(data: {
  id?: string
  email?: string
  gatewayUserId?: string | null
  role?: string
  status?: string
} = {}): string {
  const db = getSqlite()
  const id = data.id ?? crypto.randomUUID()

  db.prepare(`
    INSERT INTO auth_users (id, gateway_user_id, email, name, picture, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.gatewayUserId ?? `gateway_${id}`,
    data.email ?? `${id}@example.com`,
    'Test User',
    null,
    data.role ?? 'member',
    data.status ?? 'active',
  )

  return id
}

function insertAccount(data: {
  id?: string
  name?: string
  slug?: string | null
  ownerId?: string
} = {}): string {
  const db = getSqlite()
  const id = data.id ?? crypto.randomUUID()

  db.prepare(`
    INSERT INTO auth_accounts (id, name, slug, owner_id)
    VALUES (?, ?, ?, ?)
  `).run(id, data.name ?? 'Test Account', data.slug ?? null, data.ownerId ?? 'owner-id')

  return id
}

function insertMembership(data: {
  accountId: string
  userId: string
  role?: string
}): string {
  const db = getSqlite()
  const id = crypto.randomUUID()

  db.prepare(`
    INSERT INTO auth_memberships (id, account_id, user_id, role, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.accountId, data.userId, data.role ?? 'member', 'active')

  return id
}

function insertInvitation(data: {
  accountId: string
  invitedBy: string
  email?: string
  role?: string
  token?: string
}): string {
  const db = getSqlite()
  const id = crypto.randomUUID()

  db.prepare(`
    INSERT INTO auth_invitations (id, account_id, email, role, invited_by, token, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.accountId,
    data.email ?? `${id}@example.com`,
    data.role ?? 'guest',
    data.invitedBy,
    data.token ?? crypto.randomUUID(),
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  )

  return id
}

describe('Database Constraints Integration Tests', () => {
  describe('auth_users', () => {
    it('rejects duplicate emails because email is the local identity key', () => {
      insertUser({ email: 'unique@example.com' })

      expect(() => {
        insertUser({ email: 'unique@example.com' })
      }).toThrow(/UNIQUE constraint failed/)
    })

    it('allows duplicate gateway_user_id because the package indexes but does not constrain it', () => {
      const gatewayUserId = 'gateway_shared'

      insertUser({ email: 'first@example.com', gatewayUserId })
      const secondUserId = insertUser({ email: 'second@example.com', gatewayUserId })

      expect(secondUserId).toBeDefined()
    })

    it('defaults product role to guest when a role is omitted', () => {
      const db = getSqlite()
      const id = crypto.randomUUID()

      db.prepare(`
        INSERT INTO auth_users (id, gateway_user_id, email, name, picture, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, `gateway_${id}`, 'default-role@example.com', 'Default Role', null, 'pending')

      const row = db.prepare('SELECT role FROM auth_users WHERE id = ?').get(id) as { role: string }
      expect(row.role).toBe('guest')
    })
  })

  describe('auth_accounts', () => {
    it('rejects duplicate slugs because account URLs need stable lookup keys', () => {
      insertAccount({ name: 'First Account', slug: 'acme' })

      expect(() => {
        insertAccount({ name: 'Second Account', slug: 'acme' })
      }).toThrow(/UNIQUE constraint failed/)
    })

    it('allows multiple accounts without slugs while onboarding is incomplete', () => {
      insertAccount({ name: 'No Slug A' })
      const secondAccountId = insertAccount({ name: 'No Slug B' })

      expect(secondAccountId).toBeDefined()
    })
  })

  describe('auth_memberships', () => {
    it('rejects duplicate account/user memberships so one role owns the account context', () => {
      const userId = insertUser({ email: 'member@example.com' })
      const accountId = insertAccount({ ownerId: userId })

      insertMembership({ userId, accountId, role: 'admin' })

      expect(() => {
        insertMembership({ userId, accountId, role: 'guest' })
      }).toThrow(/UNIQUE constraint failed/)
    })

    it('defaults membership role to guest when a role is omitted', () => {
      const db = getSqlite()
      const userId = insertUser({ email: 'membership-default@example.com' })
      const accountId = insertAccount({ ownerId: userId })
      const membershipId = crypto.randomUUID()

      db.prepare(`
        INSERT INTO auth_memberships (id, account_id, user_id, status)
        VALUES (?, ?, ?, ?)
      `).run(membershipId, accountId, userId, 'active')

      const row = db
        .prepare('SELECT role FROM auth_memberships WHERE id = ?')
        .get(membershipId) as { role: string }
      expect(row.role).toBe('guest')
    })
  })

  describe('auth_invitations', () => {
    it('rejects duplicate tokens because invitation acceptance is token-addressed', () => {
      const inviterId = insertUser({ email: 'inviter@example.com' })
      const accountId = insertAccount({ ownerId: inviterId })
      const token = crypto.randomUUID()

      insertInvitation({ accountId, invitedBy: inviterId, email: 'one@example.com', token })

      expect(() => {
        insertInvitation({ accountId, invitedBy: inviterId, email: 'two@example.com', token })
      }).toThrow(/UNIQUE constraint failed/)
    })

    it('defaults invitation role to guest when a role is omitted', () => {
      const inviterId = insertUser({ email: 'invite-default@example.com' })
      const accountId = insertAccount({ ownerId: inviterId })
      const invitationId = insertInvitation({
        accountId,
        invitedBy: inviterId,
        email: 'guest-invite@example.com',
      })

      const row = getSqlite()
        .prepare('SELECT role FROM auth_invitations WHERE id = ?')
        .get(invitationId) as { role: string }
      expect(row.role).toBe('guest')
    })
  })

  describe('auth_sessions', () => {
    it('rejects sessions for unknown users so cookies cannot point at missing principals', () => {
      const db = getSqlite()

      expect(() => {
        db.prepare(`
          INSERT INTO auth_sessions (id, user_id, expires_at, created_at)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), 'missing-user', Date.now() + 1000, Date.now())
      }).toThrow(/FOREIGN KEY constraint failed/)
    })

    it('cascades sessions when a user is deleted', () => {
      const db = getSqlite()
      const userId = insertUser({ email: 'session-cascade@example.com' })
      const sessionId = crypto.randomUUID()

      db.prepare(`
        INSERT INTO auth_sessions (id, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, userId, Date.now() + 1000, Date.now())

      db.prepare('DELETE FROM auth_users WHERE id = ?').run(userId)

      const row = db.prepare('SELECT id FROM auth_sessions WHERE id = ?').get(sessionId)
      expect(row).toBeUndefined()
    })
  })

  describe('permission grants', () => {
    it('rejects duplicate global user permission grants', () => {
      const db = getSqlite()
      const userId = insertUser({ email: 'permission@example.com' })

      db.prepare(`
        INSERT INTO auth_user_permissions (id, user_id, permission)
        VALUES (?, ?, ?)
      `).run(crypto.randomUUID(), userId, 'resources:read')

      expect(() => {
        db.prepare(`
          INSERT INTO auth_user_permissions (id, user_id, permission)
          VALUES (?, ?, ?)
        `).run(crypto.randomUUID(), userId, 'resources:read')
      }).toThrow(/UNIQUE constraint failed/)
    })

    it('allows the same user permission scoped to different accounts', () => {
      const db = getSqlite()
      const userId = insertUser({ email: 'scoped-permission@example.com' })

      db.prepare(`
        INSERT INTO auth_user_permissions (id, user_id, permission, account_id)
        VALUES (?, ?, ?, ?)
      `).run(crypto.randomUUID(), userId, 'resources:read', 'account-a')

      const { changes } = db.prepare(`
        INSERT INTO auth_user_permissions (id, user_id, permission, account_id)
        VALUES (?, ?, ?, ?)
      `).run(crypto.randomUUID(), userId, 'resources:read', 'account-b')

      expect(changes).toBe(1)
    })

    it('rejects resource permissions for unknown users', () => {
      const db = getSqlite()

      expect(() => {
        db.prepare(`
          INSERT INTO auth_resource_permissions
            (id, user_id, resource_type, resource_id, permission)
          VALUES (?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), 'missing-user', 'document', 'doc-1', 'resources:read')
      }).toThrow(/FOREIGN KEY constraint failed/)
    })

    it('rejects duplicate resource permission grants for the same resource scope', () => {
      const db = getSqlite()
      const userId = insertUser({ email: 'resource-permission@example.com' })

      db.prepare(`
        INSERT INTO auth_resource_permissions
          (id, user_id, resource_type, resource_id, permission)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), userId, 'document', 'doc-1', 'resources:read')

      expect(() => {
        db.prepare(`
          INSERT INTO auth_resource_permissions
            (id, user_id, resource_type, resource_id, permission)
          VALUES (?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), userId, 'document', 'doc-1', 'resources:read')
      }).toThrow(/UNIQUE constraint failed/)
    })

    it('cascades direct permission grants when a user is deleted', () => {
      const db = getSqlite()
      const userId = insertUser({ email: 'permission-cascade@example.com' })
      const userPermissionId = crypto.randomUUID()
      const resourcePermissionId = crypto.randomUUID()

      db.prepare(`
        INSERT INTO auth_user_permissions (id, user_id, permission)
        VALUES (?, ?, ?)
      `).run(userPermissionId, userId, 'resources:read')
      db.prepare(`
        INSERT INTO auth_resource_permissions
          (id, user_id, resource_type, resource_id, permission)
        VALUES (?, ?, ?, ?, ?)
      `).run(resourcePermissionId, userId, 'document', 'doc-1', 'resources:read')

      db.prepare('DELETE FROM auth_users WHERE id = ?').run(userId)

      const directGrant = db
        .prepare('SELECT id FROM auth_user_permissions WHERE id = ?')
        .get(userPermissionId)
      const resourceGrant = db
        .prepare('SELECT id FROM auth_resource_permissions WHERE id = ?')
        .get(resourcePermissionId)

      expect(directGrant).toBeUndefined()
      expect(resourceGrant).toBeUndefined()
    })
  })

  describe('auth_audit_logs', () => {
    it('accepts system events without actor or account because audit can record anonymous failures', () => {
      const db = getSqlite()

      const { changes } = db.prepare(`
        INSERT INTO auth_audit_logs (id, event_type, metadata)
        VALUES (?, ?, ?)
      `).run(crypto.randomUUID(), 'auth.oauth_error', JSON.stringify({ reason: 'bad_state' }))

      expect(changes).toBe(1)
    })
  })
})
