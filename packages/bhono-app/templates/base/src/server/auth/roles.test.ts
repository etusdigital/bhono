// src/auth/roles.test.ts
import { describe, it, expect } from 'vitest'
import {
  Role,
  hasMinimumRole,
  getRolesWithMinimumAccess,
  isHierarchicalRole,
  getRoleLevel,
  getAllRoles,
  compareRoles,
  isRoleHigherThan,
} from './roles'

describe('roles', () => {
  describe('hasMinimumRole', () => {
    it('ADMIN should have access to ADMIN-required endpoints', () => {
      expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
    })

    it('ADMIN should have access to VIEWER-required endpoints', () => {
      expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
    })

    it('VIEWER should NOT have access to ADMIN-required endpoints', () => {
      expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
    })

    it('MANAGER should have access to EDITOR-required endpoints', () => {
      expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
    })

    it('BILLING (non-hierarchical) should only match BILLING', () => {
      expect(hasMinimumRole('BILLING', 'BILLING')).toBe(true)
      expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
      expect(hasMinimumRole('ADMIN', 'BILLING')).toBe(false)
    })

    it('ANALYTICS (non-hierarchical) should only match ANALYTICS', () => {
      expect(hasMinimumRole('ANALYTICS', 'ANALYTICS')).toBe(true)
      expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)
    })

    it('should allow access via additionalRoles', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN', ['BILLING'])).toBe(true)
    })
  })

  describe('getRolesWithMinimumAccess', () => {
    it('should return ADMIN, MANAGER, EDITOR for EDITOR minimum', () => {
      const result = getRolesWithMinimumAccess('EDITOR')
      expect(result).toContain('ADMIN')
      expect(result).toContain('MANAGER')
      expect(result).toContain('EDITOR')
      expect(result).not.toContain('AUTHOR')
      expect(result).not.toContain('VIEWER')
    })

    it('should return only ADMIN for ADMIN minimum', () => {
      const result = getRolesWithMinimumAccess('ADMIN')
      expect(result).toEqual(['ADMIN'])
    })

    it('should return all hierarchical roles for VIEWER minimum', () => {
      const result = getRolesWithMinimumAccess('VIEWER')
      expect(result).toContain('ADMIN')
      expect(result).toContain('MANAGER')
      expect(result).toContain('EDITOR')
      expect(result).toContain('AUTHOR')
      expect(result).toContain('VIEWER')
    })

    it('should include additional roles', () => {
      const result = getRolesWithMinimumAccess('ADMIN', ['BILLING'])
      expect(result).toContain('ADMIN')
      expect(result).toContain('BILLING')
    })

    it('should return empty for non-hierarchical role without additionalRoles', () => {
      const result = getRolesWithMinimumAccess('BILLING')
      expect(result).toEqual([])
    })
  })

  describe('isHierarchicalRole', () => {
    it('should return true for ADMIN', () => {
      expect(isHierarchicalRole('ADMIN')).toBe(true)
    })

    it('should return true for VIEWER', () => {
      expect(isHierarchicalRole('VIEWER')).toBe(true)
    })

    it('should return false for BILLING', () => {
      expect(isHierarchicalRole('BILLING')).toBe(false)
    })

    it('should return false for ANALYTICS', () => {
      expect(isHierarchicalRole('ANALYTICS')).toBe(false)
    })
  })

  describe('getRoleLevel', () => {
    it('should return 0 for ADMIN', () => {
      expect(getRoleLevel('ADMIN')).toBe(0)
    })

    it('should return 1 for MANAGER', () => {
      expect(getRoleLevel('MANAGER')).toBe(1)
    })

    it('should return 4 for VIEWER', () => {
      expect(getRoleLevel('VIEWER')).toBe(4)
    })

    it('should return -1 for BILLING', () => {
      expect(getRoleLevel('BILLING')).toBe(-1)
    })
  })

  describe('getAllRoles', () => {
    it('should return all 7 roles', () => {
      const roles = getAllRoles()
      expect(roles).toHaveLength(7)
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('BILLING')
      expect(roles).toContain('ANALYTICS')
    })
  })

  describe('compareRoles', () => {
    it('should return -1 when roleA is higher than roleB', () => {
      expect(compareRoles('ADMIN', 'VIEWER')).toBe(-1)
    })

    it('should return 1 when roleA is lower than roleB', () => {
      expect(compareRoles('VIEWER', 'ADMIN')).toBe(1)
    })

    it('should return 0 when roles are equal', () => {
      expect(compareRoles('MANAGER', 'MANAGER')).toBe(0)
    })

    it('should handle non-hierarchical roles', () => {
      expect(compareRoles('BILLING', 'ANALYTICS')).toBe(0)
    })
  })

  describe('isRoleHigherThan', () => {
    it('should return true when ADMIN compared to VIEWER', () => {
      expect(isRoleHigherThan('ADMIN', 'VIEWER')).toBe(true)
    })

    it('should return true when MANAGER compared to EDITOR', () => {
      expect(isRoleHigherThan('MANAGER', 'EDITOR')).toBe(true)
    })

    it('should return false when VIEWER compared to ADMIN', () => {
      expect(isRoleHigherThan('VIEWER', 'ADMIN')).toBe(false)
    })

    it('should return false when roles are equal', () => {
      expect(isRoleHigherThan('MANAGER', 'MANAGER')).toBe(false)
    })

    it('should return false for non-hierarchical roles', () => {
      expect(isRoleHigherThan('BILLING', 'VIEWER')).toBe(false)
    })
  })
})
