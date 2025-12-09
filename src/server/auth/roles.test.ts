// src/auth/roles.test.ts
import { describe, it, expect } from 'vitest'
import { Role, hasMinimumRole } from './roles'

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
})
