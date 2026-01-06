// src/auth/permissions.test.ts
import { describe, it, expect } from 'vitest'
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  isReadOnlyPermission,
  isSystemPermission,
} from '@server/auth/permissions'

describe('permissions', () => {
  describe('Permission constants', () => {
    it('should define dashboard permissions', () => {
      expect(Permission.DASHBOARD_READ).toBe('dashboard:read')
    })

    it('should define data permissions', () => {
      expect(Permission.DATA_READ).toBe('data:read')
      expect(Permission.DATA_CREATE).toBe('data:create')
      expect(Permission.DATA_UPDATE).toBe('data:update')
      expect(Permission.DATA_DELETE).toBe('data:delete')
    })

    it('should define account permissions', () => {
      expect(Permission.ACCOUNT_READ).toBe('account:read')
      expect(Permission.ACCOUNT_UPDATE).toBe('account:update')
      expect(Permission.ACCOUNT_DELETE).toBe('account:delete')
    })

    it('should define system permissions', () => {
      expect(Permission.SYSTEM_ACCOUNTS).toBe('system:accounts')
      expect(Permission.SYSTEM_IMPERSONATE).toBe('system:impersonate')
      expect(Permission.SYSTEM_SUSPEND).toBe('system:suspend')
    })
  })

  describe('hasPermission', () => {
    it('admin should have account:update permission', () => {
      expect(hasPermission('admin', Permission.ACCOUNT_UPDATE)).toBe(true)
    })

    it('admin should NOT have system:impersonate (requires isSuperAdmin)', () => {
      expect(hasPermission('admin', Permission.SYSTEM_IMPERSONATE)).toBe(false)
    })

    it('viewer should have dashboard:read', () => {
      expect(hasPermission('viewer', Permission.DASHBOARD_READ)).toBe(true)
    })

    it('viewer should have data:read', () => {
      expect(hasPermission('viewer', Permission.DATA_READ)).toBe(true)
    })

    it('viewer should NOT have data:create', () => {
      expect(hasPermission('viewer', Permission.DATA_CREATE)).toBe(false)
    })

    it('user should have data:create', () => {
      expect(hasPermission('user', Permission.DATA_CREATE)).toBe(true)
    })

    it('manager should have members:manage', () => {
      expect(hasPermission('manager', Permission.MEMBERS_MANAGE)).toBe(true)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      expect(hasAnyPermission('user', [Permission.DATA_READ, Permission.DATA_CREATE])).toBe(true)
    })

    it('should return false if user has none of the permissions', () => {
      expect(hasAnyPermission('viewer', [Permission.DATA_CREATE, Permission.DATA_DELETE])).toBe(false)
    })

    it('should return true if user has at least one permission', () => {
      expect(hasAnyPermission('viewer', [Permission.DATA_READ, Permission.DATA_CREATE])).toBe(true)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      expect(hasAllPermissions('admin', [Permission.DATA_READ, Permission.DATA_CREATE])).toBe(true)
    })

    it('should return false if user is missing any permission', () => {
      expect(hasAllPermissions('viewer', [Permission.DATA_READ, Permission.DATA_CREATE])).toBe(false)
    })

    it('should return true for empty array', () => {
      expect(hasAllPermissions('viewer', [])).toBe(true)
    })
  })

  describe('getPermissionsForRole', () => {
    it('should return viewer permissions', () => {
      const permissions = getPermissionsForRole('viewer')
      expect(permissions).toContain(Permission.DASHBOARD_READ)
      expect(permissions).toContain(Permission.DATA_READ)
      expect(permissions).not.toContain(Permission.DATA_CREATE)
    })

    it('should return user permissions', () => {
      const permissions = getPermissionsForRole('user')
      expect(permissions).toContain(Permission.DATA_CREATE)
      expect(permissions).toContain(Permission.DATA_UPDATE)
      expect(permissions).toContain(Permission.DATA_DELETE)
    })

    it('should return manager permissions', () => {
      const permissions = getPermissionsForRole('manager')
      expect(permissions).toContain(Permission.MEMBERS_MANAGE)
      expect(permissions).toContain(Permission.INVITATIONS_CREATE)
    })

    it('should return admin permissions', () => {
      const permissions = getPermissionsForRole('admin')
      expect(permissions).toContain(Permission.ACCOUNT_UPDATE)
      expect(permissions).toContain(Permission.BILLING_MANAGE)
    })

    it('should return a new array (not a reference)', () => {
      const permissions1 = getPermissionsForRole('admin')
      const permissions2 = getPermissionsForRole('admin')
      expect(permissions1).not.toBe(permissions2)
      expect(permissions1).toEqual(permissions2)
    })
  })

  describe('isReadOnlyPermission', () => {
    it('should return true for read permissions', () => {
      expect(isReadOnlyPermission(Permission.DATA_READ)).toBe(true)
      expect(isReadOnlyPermission(Permission.DASHBOARD_READ)).toBe(true)
      expect(isReadOnlyPermission(Permission.ACCOUNT_READ)).toBe(true)
    })

    it('should return false for write permissions', () => {
      expect(isReadOnlyPermission(Permission.DATA_CREATE)).toBe(false)
      expect(isReadOnlyPermission(Permission.DATA_UPDATE)).toBe(false)
      expect(isReadOnlyPermission(Permission.DATA_DELETE)).toBe(false)
    })
  })

  describe('isSystemPermission', () => {
    it('should return true for system permissions', () => {
      expect(isSystemPermission(Permission.SYSTEM_ACCOUNTS)).toBe(true)
      expect(isSystemPermission(Permission.SYSTEM_IMPERSONATE)).toBe(true)
      expect(isSystemPermission(Permission.SYSTEM_SUSPEND)).toBe(true)
    })

    it('should return false for non-system permissions', () => {
      expect(isSystemPermission(Permission.DATA_READ)).toBe(false)
      expect(isSystemPermission(Permission.ACCOUNT_UPDATE)).toBe(false)
    })
  })
})
