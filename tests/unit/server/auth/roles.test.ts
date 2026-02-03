// tests/unit/server/auth/roles.test.ts
import { describe, it, expect } from 'vitest'
import { Role, ROLE_HIERARCHY, hasMinimumRole } from '@server/auth/roles'

describe('roles', () => {
  describe('Role constants', () => {
    it('should define 7 roles', () => {
      expect(Role.ADMIN).toBe('ADMIN')
      expect(Role.MANAGER).toBe('MANAGER')
      expect(Role.EDITOR).toBe('EDITOR')
      expect(Role.AUTHOR).toBe('AUTHOR')
      expect(Role.VIEWER).toBe('VIEWER')
      expect(Role.BILLING).toBe('BILLING')
      expect(Role.ANALYTICS).toBe('ANALYTICS')
    })
  })

  describe('ROLE_HIERARCHY', () => {
    it('should define hierarchy levels for all roles', () => {
      expect(ROLE_HIERARCHY.ADMIN).toBe(0)
      expect(ROLE_HIERARCHY.MANAGER).toBe(1)
      expect(ROLE_HIERARCHY.EDITOR).toBe(2)
      expect(ROLE_HIERARCHY.AUTHOR).toBe(3)
      expect(ROLE_HIERARCHY.VIEWER).toBe(4)
      // Non-hierarchical roles
      expect(ROLE_HIERARCHY.BILLING).toBe(-1)
      expect(ROLE_HIERARCHY.ANALYTICS).toBe(-1)
    })
  })

  describe('hasMinimumRole', () => {
    describe('hierarchical roles', () => {
      it('ADMIN should have access to all role requirements', () => {
        expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
        expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true)
        expect(hasMinimumRole('ADMIN', 'EDITOR')).toBe(true)
        expect(hasMinimumRole('ADMIN', 'AUTHOR')).toBe(true)
        expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
      })

      it('MANAGER should have access to MANAGER and below', () => {
        expect(hasMinimumRole('MANAGER', 'ADMIN')).toBe(false)
        expect(hasMinimumRole('MANAGER', 'MANAGER')).toBe(true)
        expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
        expect(hasMinimumRole('MANAGER', 'AUTHOR')).toBe(true)
        expect(hasMinimumRole('MANAGER', 'VIEWER')).toBe(true)
      })

      it('EDITOR should have access to EDITOR and below', () => {
        expect(hasMinimumRole('EDITOR', 'ADMIN')).toBe(false)
        expect(hasMinimumRole('EDITOR', 'MANAGER')).toBe(false)
        expect(hasMinimumRole('EDITOR', 'EDITOR')).toBe(true)
        expect(hasMinimumRole('EDITOR', 'AUTHOR')).toBe(true)
        expect(hasMinimumRole('EDITOR', 'VIEWER')).toBe(true)
      })

      it('AUTHOR should have access to AUTHOR and below', () => {
        expect(hasMinimumRole('AUTHOR', 'ADMIN')).toBe(false)
        expect(hasMinimumRole('AUTHOR', 'MANAGER')).toBe(false)
        expect(hasMinimumRole('AUTHOR', 'EDITOR')).toBe(false)
        expect(hasMinimumRole('AUTHOR', 'AUTHOR')).toBe(true)
        expect(hasMinimumRole('AUTHOR', 'VIEWER')).toBe(true)
      })

      it('VIEWER should only have access to VIEWER', () => {
        expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
        expect(hasMinimumRole('VIEWER', 'MANAGER')).toBe(false)
        expect(hasMinimumRole('VIEWER', 'EDITOR')).toBe(false)
        expect(hasMinimumRole('VIEWER', 'AUTHOR')).toBe(false)
        expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true)
      })
    })

    describe('non-hierarchical roles', () => {
      it('BILLING should only match exact BILLING requirement', () => {
        expect(hasMinimumRole('BILLING', 'BILLING')).toBe(true)
        expect(hasMinimumRole('BILLING', 'ADMIN')).toBe(false)
        expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
      })

      it('ANALYTICS should only match exact ANALYTICS requirement', () => {
        expect(hasMinimumRole('ANALYTICS', 'ANALYTICS')).toBe(true)
        expect(hasMinimumRole('ANALYTICS', 'ADMIN')).toBe(false)
        expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)
      })

      it('hierarchical roles should not have access to non-hierarchical roles', () => {
        expect(hasMinimumRole('ADMIN', 'BILLING')).toBe(false)
        expect(hasMinimumRole('ADMIN', 'ANALYTICS')).toBe(false)
        expect(hasMinimumRole('MANAGER', 'BILLING')).toBe(false)
      })
    })

    describe('additionalRoles parameter', () => {
      it('should grant access via additionalRoles even if hierarchical check fails', () => {
        // VIEWER doesn't have ADMIN access hierarchically
        expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
        // But can be granted via additionalRoles
        expect(hasMinimumRole('VIEWER', 'ADMIN', ['VIEWER'])).toBe(true)
      })

      it('should grant BILLING access to ADMIN via additionalRoles', () => {
        expect(hasMinimumRole('ADMIN', 'BILLING')).toBe(false)
        expect(hasMinimumRole('ADMIN', 'BILLING', ['ADMIN'])).toBe(true)
      })

      it('should grant access when user role is in additionalRoles', () => {
        expect(hasMinimumRole('ANALYTICS', 'ADMIN', ['ANALYTICS'])).toBe(true)
      })
    })
  })
})
