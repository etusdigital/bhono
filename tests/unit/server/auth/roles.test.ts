// src/auth/roles.test.ts
import { describe, it, expect } from 'vitest'
import {
  Role,
  hasMinimumRole,
  getRolesWithMinimumAccess,
  getRoleLevel,
  getAllRoles,
  compareRoles,
  isRoleHigherThan,
  canAssignRole,
  getAssignableRoles,
  isValidRole,
  validateRoleChange,
} from '@server/auth/roles'

describe('roles', () => {
  describe('Role constants', () => {
    it('should define 4 roles', () => {
      expect(Role.VIEWER).toBe('viewer')
      expect(Role.USER).toBe('user')
      expect(Role.MANAGER).toBe('manager')
      expect(Role.ADMIN).toBe('admin')
    })
  })

  describe('hasMinimumRole', () => {
    it('admin should have access to admin-required endpoints', () => {
      expect(hasMinimumRole('admin', 'admin')).toBe(true)
    })

    it('admin should have access to viewer-required endpoints', () => {
      expect(hasMinimumRole('admin', 'viewer')).toBe(true)
    })

    it('viewer should NOT have access to admin-required endpoints', () => {
      expect(hasMinimumRole('viewer', 'admin')).toBe(false)
    })

    it('manager should have access to user-required endpoints', () => {
      expect(hasMinimumRole('manager', 'user')).toBe(true)
    })

    it('user should have access to viewer-required endpoints', () => {
      expect(hasMinimumRole('user', 'viewer')).toBe(true)
    })

    it('user should NOT have access to manager-required endpoints', () => {
      expect(hasMinimumRole('user', 'manager')).toBe(false)
    })
  })

  describe('getRolesWithMinimumAccess', () => {
    it('should return admin, manager, user for user minimum', () => {
      const result = getRolesWithMinimumAccess('user')
      expect(result).toContain('admin')
      expect(result).toContain('manager')
      expect(result).toContain('user')
      expect(result).not.toContain('viewer')
    })

    it('should return only admin for admin minimum', () => {
      const result = getRolesWithMinimumAccess('admin')
      expect(result).toEqual(['admin'])
    })

    it('should return all roles for viewer minimum', () => {
      const result = getRolesWithMinimumAccess('viewer')
      expect(result).toContain('admin')
      expect(result).toContain('manager')
      expect(result).toContain('user')
      expect(result).toContain('viewer')
      expect(result).toHaveLength(4)
    })
  })

  describe('getRoleLevel', () => {
    it('should return 40 for admin', () => {
      expect(getRoleLevel('admin')).toBe(40)
    })

    it('should return 30 for manager', () => {
      expect(getRoleLevel('manager')).toBe(30)
    })

    it('should return 20 for user', () => {
      expect(getRoleLevel('user')).toBe(20)
    })

    it('should return 10 for viewer', () => {
      expect(getRoleLevel('viewer')).toBe(10)
    })
  })

  describe('getAllRoles', () => {
    it('should return all 4 roles', () => {
      const roles = getAllRoles()
      expect(roles).toHaveLength(4)
      expect(roles).toContain('viewer')
      expect(roles).toContain('user')
      expect(roles).toContain('manager')
      expect(roles).toContain('admin')
    })
  })

  describe('compareRoles', () => {
    it('should return -1 when roleA is higher than roleB', () => {
      expect(compareRoles('admin', 'viewer')).toBe(-1)
    })

    it('should return 1 when roleA is lower than roleB', () => {
      expect(compareRoles('viewer', 'admin')).toBe(1)
    })

    it('should return 0 when roles are equal', () => {
      expect(compareRoles('manager', 'manager')).toBe(0)
    })

    it('should correctly compare adjacent roles', () => {
      expect(compareRoles('admin', 'manager')).toBe(-1)
      expect(compareRoles('manager', 'user')).toBe(-1)
      expect(compareRoles('user', 'viewer')).toBe(-1)
    })
  })

  describe('isRoleHigherThan', () => {
    it('should return true when admin compared to viewer', () => {
      expect(isRoleHigherThan('admin', 'viewer')).toBe(true)
    })

    it('should return true when manager compared to user', () => {
      expect(isRoleHigherThan('manager', 'user')).toBe(true)
    })

    it('should return false when viewer compared to admin', () => {
      expect(isRoleHigherThan('viewer', 'admin')).toBe(false)
    })

    it('should return false when roles are equal', () => {
      expect(isRoleHigherThan('manager', 'manager')).toBe(false)
    })
  })

  describe('canAssignRole', () => {
    it('admin can assign any role', () => {
      expect(canAssignRole('admin', 'admin')).toBe(true)
      expect(canAssignRole('admin', 'manager')).toBe(true)
      expect(canAssignRole('admin', 'user')).toBe(true)
      expect(canAssignRole('admin', 'viewer')).toBe(true)
    })

    it('manager can assign up to manager role', () => {
      expect(canAssignRole('manager', 'admin')).toBe(false)
      expect(canAssignRole('manager', 'manager')).toBe(true)
      expect(canAssignRole('manager', 'user')).toBe(true)
      expect(canAssignRole('manager', 'viewer')).toBe(true)
    })

    it('user can only assign viewer and user roles', () => {
      expect(canAssignRole('user', 'admin')).toBe(false)
      expect(canAssignRole('user', 'manager')).toBe(false)
      expect(canAssignRole('user', 'user')).toBe(true)
      expect(canAssignRole('user', 'viewer')).toBe(true)
    })

    it('viewer can only assign viewer role', () => {
      expect(canAssignRole('viewer', 'admin')).toBe(false)
      expect(canAssignRole('viewer', 'manager')).toBe(false)
      expect(canAssignRole('viewer', 'user')).toBe(false)
      expect(canAssignRole('viewer', 'viewer')).toBe(true)
    })
  })

  describe('getAssignableRoles', () => {
    it('admin can assign all roles', () => {
      const roles = getAssignableRoles('admin')
      expect(roles).toHaveLength(4)
      expect(roles).toContain('admin')
      expect(roles).toContain('manager')
      expect(roles).toContain('user')
      expect(roles).toContain('viewer')
    })

    it('manager can assign up to manager', () => {
      const roles = getAssignableRoles('manager')
      expect(roles).toHaveLength(3)
      expect(roles).not.toContain('admin')
      expect(roles).toContain('manager')
      expect(roles).toContain('user')
      expect(roles).toContain('viewer')
    })

    it('user can assign user and viewer', () => {
      const roles = getAssignableRoles('user')
      expect(roles).toHaveLength(2)
      expect(roles).not.toContain('admin')
      expect(roles).not.toContain('manager')
      expect(roles).toContain('user')
      expect(roles).toContain('viewer')
    })

    it('viewer can only assign viewer', () => {
      const roles = getAssignableRoles('viewer')
      expect(roles).toHaveLength(1)
      expect(roles).toContain('viewer')
    })
  })

  describe('isValidRole', () => {
    it('should return true for valid roles', () => {
      expect(isValidRole('viewer')).toBe(true)
      expect(isValidRole('user')).toBe(true)
      expect(isValidRole('manager')).toBe(true)
      expect(isValidRole('admin')).toBe(true)
    })

    it('should return false for invalid roles', () => {
      expect(isValidRole('VIEWER')).toBe(false)
      expect(isValidRole('ADMIN')).toBe(false)
      expect(isValidRole('editor')).toBe(false)
      expect(isValidRole('billing')).toBe(false)
      expect(isValidRole('superadmin')).toBe(false)
      expect(isValidRole('')).toBe(false)
      expect(isValidRole(null)).toBe(false)
      expect(isValidRole(undefined)).toBe(false)
    })

    it('should return false for non-string types', () => {
      expect(isValidRole(123)).toBe(false)
      expect(isValidRole(0)).toBe(false)
      expect(isValidRole(true)).toBe(false)
      expect(isValidRole(false)).toBe(false)
      expect(isValidRole({})).toBe(false)
      expect(isValidRole([])).toBe(false)
      expect(isValidRole(['admin'])).toBe(false)
      expect(isValidRole({ role: 'admin' })).toBe(false)
      expect(isValidRole(() => 'admin')).toBe(false)
      expect(isValidRole(Symbol('admin'))).toBe(false)
    })
  })

  describe('validateRoleChange', () => {
    describe('Rule 1: Super Admin can do anything', () => {
      it('should allow super admin to assign admin role to viewer', () => {
        const result = validateRoleChange(
          { role: 'viewer', isSuperAdmin: true },
          { role: 'viewer', userId: 'user-123' },
          'admin'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow super admin to demote admin to viewer', () => {
        const result = validateRoleChange(
          { role: 'viewer', isSuperAdmin: true },
          { role: 'admin', userId: 'user-123' },
          'viewer'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow super admin with low role to modify higher role user', () => {
        const result = validateRoleChange(
          { role: 'user', isSuperAdmin: true },
          { role: 'admin', userId: 'user-123' },
          'manager'
        )
        expect(result).toEqual({ canChange: true })
      })
    })

    describe('Rule 2: Cannot assign a role higher than your own', () => {
      it('should reject manager trying to assign admin role', () => {
        const result = validateRoleChange(
          { role: 'manager', isSuperAdmin: false },
          { role: 'user', userId: 'user-123' },
          'admin'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot assign admin role')
      })

      it('should reject user trying to assign manager role', () => {
        const result = validateRoleChange(
          { role: 'user', isSuperAdmin: false },
          { role: 'viewer', userId: 'user-123' },
          'manager'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot assign manager role')
      })

      it('should reject viewer trying to assign user role', () => {
        const result = validateRoleChange(
          { role: 'viewer', isSuperAdmin: false },
          { role: 'viewer', userId: 'user-123' },
          'user'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot assign user role')
      })

      it('should reject viewer trying to assign admin role', () => {
        const result = validateRoleChange(
          { role: 'viewer', isSuperAdmin: false },
          { role: 'viewer', userId: 'user-123' },
          'admin'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot assign admin role')
      })
    })

    describe('Rule 3: Cannot modify someone with a higher role', () => {
      it('should reject manager trying to modify admin user', () => {
        const result = validateRoleChange(
          { role: 'manager', isSuperAdmin: false },
          { role: 'admin', userId: 'user-123' },
          'viewer'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot modify admin')
      })

      it('should reject user trying to modify manager user', () => {
        const result = validateRoleChange(
          { role: 'user', isSuperAdmin: false },
          { role: 'manager', userId: 'user-123' },
          'viewer'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot modify manager')
      })

      it('should reject viewer trying to modify user', () => {
        const result = validateRoleChange(
          { role: 'viewer', isSuperAdmin: false },
          { role: 'user', userId: 'user-123' },
          'viewer'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot modify user')
      })

      it('should reject user trying to modify admin user even with valid target role', () => {
        const result = validateRoleChange(
          { role: 'user', isSuperAdmin: false },
          { role: 'admin', userId: 'user-123' },
          'user'
        )
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot modify admin')
      })
    })

    describe('Rule 4: All checks pass', () => {
      it('should allow admin to assign manager role to user', () => {
        const result = validateRoleChange(
          { role: 'admin', isSuperAdmin: false },
          { role: 'user', userId: 'user-123' },
          'manager'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow admin to demote manager to viewer', () => {
        const result = validateRoleChange(
          { role: 'admin', isSuperAdmin: false },
          { role: 'manager', userId: 'user-123' },
          'viewer'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow manager to assign user role to viewer', () => {
        const result = validateRoleChange(
          { role: 'manager', isSuperAdmin: false },
          { role: 'viewer', userId: 'user-123' },
          'user'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow manager to assign same role (manager) to another manager', () => {
        const result = validateRoleChange(
          { role: 'manager', isSuperAdmin: false },
          { role: 'manager', userId: 'user-123' },
          'manager'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow user to demote another user to viewer', () => {
        const result = validateRoleChange(
          { role: 'user', isSuperAdmin: false },
          { role: 'user', userId: 'user-123' },
          'viewer'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow admin to promote viewer directly to admin', () => {
        const result = validateRoleChange(
          { role: 'admin', isSuperAdmin: false },
          { role: 'viewer', userId: 'user-123' },
          'admin'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should allow viewer to keep another viewer as viewer', () => {
        const result = validateRoleChange(
          { role: 'viewer', isSuperAdmin: false },
          { role: 'viewer', userId: 'user-123' },
          'viewer'
        )
        expect(result).toEqual({ canChange: true })
      })
    })

    describe('edge cases', () => {
      it('should allow admin to modify another admin', () => {
        const result = validateRoleChange(
          { role: 'admin', isSuperAdmin: false },
          { role: 'admin', userId: 'user-123' },
          'manager'
        )
        expect(result).toEqual({ canChange: true })
      })

      it('should check target role permission before new role permission', () => {
        // User cannot modify manager (Rule 3 triggers before Rule 2)
        const result = validateRoleChange(
          { role: 'user', isSuperAdmin: false },
          { role: 'manager', userId: 'user-123' },
          'admin'
        )
        // Rule 2 triggers first because it's checked first
        expect(result.canChange).toBe(false)
        expect(result.reason).toBe('Cannot assign admin role')
      })
    })
  })
})
