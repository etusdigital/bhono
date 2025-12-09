// src/auth/permissions.test.ts
import { describe, it, expect } from 'vitest'
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from './permissions'

describe('permissions', () => {
  describe('hasPermission', () => {
    it('ADMIN should have MANAGE_SYSTEM_SETTINGS', () => {
      expect(hasPermission('ADMIN', 'MANAGE_SYSTEM_SETTINGS')).toBe(true)
    })

    it('VIEWER should NOT have MANAGE_SYSTEM_SETTINGS', () => {
      expect(hasPermission('VIEWER', 'MANAGE_SYSTEM_SETTINGS')).toBe(false)
    })

    it('VIEWER should have VIEW_CONTENT', () => {
      expect(hasPermission('VIEWER', 'VIEW_CONTENT')).toBe(true)
    })

    it('BILLING should have MANAGE_BILLING', () => {
      expect(hasPermission('BILLING', 'MANAGE_BILLING')).toBe(true)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      expect(hasAnyPermission('EDITOR', ['MANAGE_BILLING', 'CREATE_CONTENT'])).toBe(true)
    })

    it('should return false if user has none of the permissions', () => {
      expect(hasAnyPermission('VIEWER', ['MANAGE_BILLING', 'CREATE_CONTENT'])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      expect(hasAllPermissions('ADMIN', ['CREATE_CONTENT', 'VIEW_CONTENT'])).toBe(true)
    })

    it('should return false if user is missing any permission', () => {
      expect(hasAllPermissions('VIEWER', ['CREATE_CONTENT', 'VIEW_CONTENT'])).toBe(false)
    })
  })
})
