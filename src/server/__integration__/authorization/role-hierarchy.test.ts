/**
 * Role Hierarchy Unit/Integration Tests
 *
 * Tests the complete role hierarchy system and all related functions.
 * This tests the LOGIC of roles, not API endpoint access (those are tested elsewhere).
 *
 * Role Hierarchy (hierarchical roles):
 * - ADMIN: Level 0 (highest privilege)
 * - MANAGER: Level 1
 * - EDITOR: Level 2
 * - AUTHOR: Level 3
 * - VIEWER: Level 4 (lowest hierarchical privilege)
 *
 * Non-hierarchical (specialized) roles:
 * - BILLING: Level -1 (separate domain, no inheritance)
 * - ANALYTICS: Level -1 (separate domain, no inheritance)
 */

import { describe, it, expect } from 'vitest'
import {
  Role,
  ROLE_HIERARCHY,
  hasMinimumRole,
  isHierarchicalRole,
  getRoleLevel,
  getRolesWithMinimumAccess,
  getAllRoles,
  compareRoles,
  isRoleHigherThan,
} from '../../auth/roles'

// ============================================================================
// ROLE HIERARCHY CONSTANTS TESTS
// ============================================================================

describe('Role Hierarchy Constants', () => {
  describe('ROLE_HIERARCHY values', () => {
    it('should define ADMIN as level 0 (highest hierarchical privilege)', () => {
      expect(ROLE_HIERARCHY.ADMIN).toBe(0)
    })

    it('should define MANAGER as level 1', () => {
      expect(ROLE_HIERARCHY.MANAGER).toBe(1)
    })

    it('should define EDITOR as level 2', () => {
      expect(ROLE_HIERARCHY.EDITOR).toBe(2)
    })

    it('should define AUTHOR as level 3', () => {
      expect(ROLE_HIERARCHY.AUTHOR).toBe(3)
    })

    it('should define VIEWER as level 4 (lowest hierarchical privilege)', () => {
      expect(ROLE_HIERARCHY.VIEWER).toBe(4)
    })

    it('should define BILLING as level -1 (non-hierarchical)', () => {
      expect(ROLE_HIERARCHY.BILLING).toBe(-1)
    })

    it('should define ANALYTICS as level -1 (non-hierarchical)', () => {
      expect(ROLE_HIERARCHY.ANALYTICS).toBe(-1)
    })

    it('should have exactly 7 roles defined', () => {
      expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(7)
    })
  })

  describe('Role enum values', () => {
    it('should have ADMIN role', () => {
      expect(Role.ADMIN).toBe('ADMIN')
    })

    it('should have MANAGER role', () => {
      expect(Role.MANAGER).toBe('MANAGER')
    })

    it('should have EDITOR role', () => {
      expect(Role.EDITOR).toBe('EDITOR')
    })

    it('should have AUTHOR role', () => {
      expect(Role.AUTHOR).toBe('AUTHOR')
    })

    it('should have VIEWER role', () => {
      expect(Role.VIEWER).toBe('VIEWER')
    })

    it('should have BILLING role', () => {
      expect(Role.BILLING).toBe('BILLING')
    })

    it('should have ANALYTICS role', () => {
      expect(Role.ANALYTICS).toBe('ANALYTICS')
    })
  })
})

// ============================================================================
// getRoleLevel FUNCTION TESTS
// ============================================================================

describe('getRoleLevel()', () => {
  describe('hierarchical roles', () => {
    it('should return 0 for ADMIN', () => {
      expect(getRoleLevel('ADMIN')).toBe(0)
    })

    it('should return 1 for MANAGER', () => {
      expect(getRoleLevel('MANAGER')).toBe(1)
    })

    it('should return 2 for EDITOR', () => {
      expect(getRoleLevel('EDITOR')).toBe(2)
    })

    it('should return 3 for AUTHOR', () => {
      expect(getRoleLevel('AUTHOR')).toBe(3)
    })

    it('should return 4 for VIEWER', () => {
      expect(getRoleLevel('VIEWER')).toBe(4)
    })
  })

  describe('non-hierarchical roles', () => {
    it('should return -1 for BILLING', () => {
      expect(getRoleLevel('BILLING')).toBe(-1)
    })

    it('should return -1 for ANALYTICS', () => {
      expect(getRoleLevel('ANALYTICS')).toBe(-1)
    })
  })

  describe('hierarchy order verification', () => {
    it('should have ADMIN with lower level than MANAGER (higher privilege)', () => {
      expect(getRoleLevel('ADMIN')).toBeLessThan(getRoleLevel('MANAGER'))
    })

    it('should have MANAGER with lower level than EDITOR (higher privilege)', () => {
      expect(getRoleLevel('MANAGER')).toBeLessThan(getRoleLevel('EDITOR'))
    })

    it('should have EDITOR with lower level than AUTHOR (higher privilege)', () => {
      expect(getRoleLevel('EDITOR')).toBeLessThan(getRoleLevel('AUTHOR'))
    })

    it('should have AUTHOR with lower level than VIEWER (higher privilege)', () => {
      expect(getRoleLevel('AUTHOR')).toBeLessThan(getRoleLevel('VIEWER'))
    })
  })
})

// ============================================================================
// isHierarchicalRole FUNCTION TESTS
// ============================================================================

describe('isHierarchicalRole()', () => {
  describe('hierarchical roles', () => {
    it('should return true for ADMIN', () => {
      expect(isHierarchicalRole('ADMIN')).toBe(true)
    })

    it('should return true for MANAGER', () => {
      expect(isHierarchicalRole('MANAGER')).toBe(true)
    })

    it('should return true for EDITOR', () => {
      expect(isHierarchicalRole('EDITOR')).toBe(true)
    })

    it('should return true for AUTHOR', () => {
      expect(isHierarchicalRole('AUTHOR')).toBe(true)
    })

    it('should return true for VIEWER', () => {
      expect(isHierarchicalRole('VIEWER')).toBe(true)
    })
  })

  describe('non-hierarchical roles', () => {
    it('should return false for BILLING', () => {
      expect(isHierarchicalRole('BILLING')).toBe(false)
    })

    it('should return false for ANALYTICS', () => {
      expect(isHierarchicalRole('ANALYTICS')).toBe(false)
    })
  })

  describe('complete coverage', () => {
    it('should correctly classify all roles', () => {
      const hierarchical = ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER'] as const
      const nonHierarchical = ['BILLING', 'ANALYTICS'] as const

      for (const role of hierarchical) {
        expect(isHierarchicalRole(role)).toBe(true)
      }

      for (const role of nonHierarchical) {
        expect(isHierarchicalRole(role)).toBe(false)
      }
    })
  })
})

// ============================================================================
// hasMinimumRole FUNCTION TESTS - HIERARCHICAL ROLES
// ============================================================================

describe('hasMinimumRole() - Hierarchical Roles', () => {
  describe('ADMIN access', () => {
    it('should satisfy ADMIN requirement', () => {
      expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
    })

    it('should satisfy MANAGER requirement', () => {
      expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true)
    })

    it('should satisfy EDITOR requirement', () => {
      expect(hasMinimumRole('ADMIN', 'EDITOR')).toBe(true)
    })

    it('should satisfy AUTHOR requirement', () => {
      expect(hasMinimumRole('ADMIN', 'AUTHOR')).toBe(true)
    })

    it('should satisfy VIEWER requirement', () => {
      expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
    })
  })

  describe('MANAGER access', () => {
    it('should NOT satisfy ADMIN requirement', () => {
      expect(hasMinimumRole('MANAGER', 'ADMIN')).toBe(false)
    })

    it('should satisfy MANAGER requirement', () => {
      expect(hasMinimumRole('MANAGER', 'MANAGER')).toBe(true)
    })

    it('should satisfy EDITOR requirement', () => {
      expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
    })

    it('should satisfy AUTHOR requirement', () => {
      expect(hasMinimumRole('MANAGER', 'AUTHOR')).toBe(true)
    })

    it('should satisfy VIEWER requirement', () => {
      expect(hasMinimumRole('MANAGER', 'VIEWER')).toBe(true)
    })
  })

  describe('EDITOR access', () => {
    it('should NOT satisfy ADMIN requirement', () => {
      expect(hasMinimumRole('EDITOR', 'ADMIN')).toBe(false)
    })

    it('should NOT satisfy MANAGER requirement', () => {
      expect(hasMinimumRole('EDITOR', 'MANAGER')).toBe(false)
    })

    it('should satisfy EDITOR requirement', () => {
      expect(hasMinimumRole('EDITOR', 'EDITOR')).toBe(true)
    })

    it('should satisfy AUTHOR requirement', () => {
      expect(hasMinimumRole('EDITOR', 'AUTHOR')).toBe(true)
    })

    it('should satisfy VIEWER requirement', () => {
      expect(hasMinimumRole('EDITOR', 'VIEWER')).toBe(true)
    })
  })

  describe('AUTHOR access', () => {
    it('should NOT satisfy ADMIN requirement', () => {
      expect(hasMinimumRole('AUTHOR', 'ADMIN')).toBe(false)
    })

    it('should NOT satisfy MANAGER requirement', () => {
      expect(hasMinimumRole('AUTHOR', 'MANAGER')).toBe(false)
    })

    it('should NOT satisfy EDITOR requirement', () => {
      expect(hasMinimumRole('AUTHOR', 'EDITOR')).toBe(false)
    })

    it('should satisfy AUTHOR requirement', () => {
      expect(hasMinimumRole('AUTHOR', 'AUTHOR')).toBe(true)
    })

    it('should satisfy VIEWER requirement', () => {
      expect(hasMinimumRole('AUTHOR', 'VIEWER')).toBe(true)
    })
  })

  describe('VIEWER access', () => {
    it('should NOT satisfy ADMIN requirement', () => {
      expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
    })

    it('should NOT satisfy MANAGER requirement', () => {
      expect(hasMinimumRole('VIEWER', 'MANAGER')).toBe(false)
    })

    it('should NOT satisfy EDITOR requirement', () => {
      expect(hasMinimumRole('VIEWER', 'EDITOR')).toBe(false)
    })

    it('should NOT satisfy AUTHOR requirement', () => {
      expect(hasMinimumRole('VIEWER', 'AUTHOR')).toBe(false)
    })

    it('should satisfy VIEWER requirement', () => {
      expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true)
    })
  })
})

// ============================================================================
// hasMinimumRole FUNCTION TESTS - NON-HIERARCHICAL ROLES
// ============================================================================

describe('hasMinimumRole() - Non-Hierarchical Roles', () => {
  describe('BILLING role behavior', () => {
    it('should only satisfy its own exact requirement', () => {
      expect(hasMinimumRole('BILLING', 'BILLING')).toBe(true)
    })

    it('should NOT satisfy any hierarchical role requirement', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN')).toBe(false)
      expect(hasMinimumRole('BILLING', 'MANAGER')).toBe(false)
      expect(hasMinimumRole('BILLING', 'EDITOR')).toBe(false)
      expect(hasMinimumRole('BILLING', 'AUTHOR')).toBe(false)
      expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
    })

    it('should NOT satisfy ANALYTICS requirement', () => {
      expect(hasMinimumRole('BILLING', 'ANALYTICS')).toBe(false)
    })
  })

  describe('ANALYTICS role behavior', () => {
    it('should only satisfy its own exact requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'ANALYTICS')).toBe(true)
    })

    it('should NOT satisfy any hierarchical role requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'ADMIN')).toBe(false)
      expect(hasMinimumRole('ANALYTICS', 'MANAGER')).toBe(false)
      expect(hasMinimumRole('ANALYTICS', 'EDITOR')).toBe(false)
      expect(hasMinimumRole('ANALYTICS', 'AUTHOR')).toBe(false)
      expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)
    })

    it('should NOT satisfy BILLING requirement', () => {
      expect(hasMinimumRole('ANALYTICS', 'BILLING')).toBe(false)
    })
  })

  describe('hierarchical roles vs non-hierarchical requirements', () => {
    it('ADMIN should NOT satisfy BILLING requirement', () => {
      expect(hasMinimumRole('ADMIN', 'BILLING')).toBe(false)
    })

    it('ADMIN should NOT satisfy ANALYTICS requirement', () => {
      expect(hasMinimumRole('ADMIN', 'ANALYTICS')).toBe(false)
    })

    it('VIEWER should NOT satisfy BILLING requirement', () => {
      expect(hasMinimumRole('VIEWER', 'BILLING')).toBe(false)
    })

    it('VIEWER should NOT satisfy ANALYTICS requirement', () => {
      expect(hasMinimumRole('VIEWER', 'ANALYTICS')).toBe(false)
    })
  })
})

// ============================================================================
// hasMinimumRole FUNCTION TESTS - ADDITIONAL ROLES
// ============================================================================

describe('hasMinimumRole() - Additional Roles Parameter', () => {
  describe('non-hierarchical role bypass via additionalRoles', () => {
    it('should allow BILLING to satisfy ADMIN requirement when in additionalRoles', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN', ['BILLING'])).toBe(true)
    })

    it('should allow BILLING to satisfy VIEWER requirement when in additionalRoles', () => {
      expect(hasMinimumRole('BILLING', 'VIEWER', ['BILLING'])).toBe(true)
    })

    it('should allow ANALYTICS to satisfy ADMIN requirement when in additionalRoles', () => {
      expect(hasMinimumRole('ANALYTICS', 'ADMIN', ['ANALYTICS'])).toBe(true)
    })

    it('should allow ANALYTICS to satisfy VIEWER requirement when in additionalRoles', () => {
      expect(hasMinimumRole('ANALYTICS', 'VIEWER', ['ANALYTICS'])).toBe(true)
    })
  })

  describe('hierarchical role with additionalRoles (no change expected)', () => {
    it('should still work for ADMIN even if in additionalRoles (redundant)', () => {
      expect(hasMinimumRole('ADMIN', 'VIEWER', ['ADMIN'])).toBe(true)
    })

    it('should still NOT allow VIEWER to satisfy ADMIN even with empty additionalRoles', () => {
      expect(hasMinimumRole('VIEWER', 'ADMIN', [])).toBe(false)
    })
  })

  describe('cross-non-hierarchical bypass', () => {
    it('should allow BILLING to satisfy ANALYTICS requirement when BILLING in additionalRoles', () => {
      expect(hasMinimumRole('BILLING', 'ANALYTICS', ['BILLING'])).toBe(true)
    })

    it('should allow ANALYTICS to satisfy BILLING requirement when ANALYTICS in additionalRoles', () => {
      expect(hasMinimumRole('ANALYTICS', 'BILLING', ['ANALYTICS'])).toBe(true)
    })
  })

  describe('additionalRoles does not affect mismatch', () => {
    it('should NOT allow BILLING to satisfy ADMIN when different role in additionalRoles', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN', ['ANALYTICS'])).toBe(false)
    })

    it('should NOT allow VIEWER to satisfy ADMIN when BILLING in additionalRoles', () => {
      expect(hasMinimumRole('VIEWER', 'ADMIN', ['BILLING'])).toBe(false)
    })
  })
})

// ============================================================================
// getRolesWithMinimumAccess FUNCTION TESTS
// ============================================================================

describe('getRolesWithMinimumAccess()', () => {
  describe('hierarchical role minimums', () => {
    it('should return only ADMIN for ADMIN minimum', () => {
      const roles = getRolesWithMinimumAccess('ADMIN')
      expect(roles).toContain('ADMIN')
      expect(roles).not.toContain('MANAGER')
      expect(roles).not.toContain('EDITOR')
      expect(roles).not.toContain('AUTHOR')
      expect(roles).not.toContain('VIEWER')
      expect(roles).not.toContain('BILLING')
      expect(roles).not.toContain('ANALYTICS')
    })

    it('should return ADMIN and MANAGER for MANAGER minimum', () => {
      const roles = getRolesWithMinimumAccess('MANAGER')
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).not.toContain('EDITOR')
      expect(roles).not.toContain('AUTHOR')
      expect(roles).not.toContain('VIEWER')
    })

    it('should return ADMIN, MANAGER, EDITOR for EDITOR minimum', () => {
      const roles = getRolesWithMinimumAccess('EDITOR')
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).toContain('EDITOR')
      expect(roles).not.toContain('AUTHOR')
      expect(roles).not.toContain('VIEWER')
    })

    it('should return ADMIN, MANAGER, EDITOR, AUTHOR for AUTHOR minimum', () => {
      const roles = getRolesWithMinimumAccess('AUTHOR')
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).toContain('EDITOR')
      expect(roles).toContain('AUTHOR')
      expect(roles).not.toContain('VIEWER')
    })

    it('should return all hierarchical roles for VIEWER minimum', () => {
      const roles = getRolesWithMinimumAccess('VIEWER')
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).toContain('EDITOR')
      expect(roles).toContain('AUTHOR')
      expect(roles).toContain('VIEWER')
      // Non-hierarchical should NOT be included
      expect(roles).not.toContain('BILLING')
      expect(roles).not.toContain('ANALYTICS')
    })
  })

  describe('non-hierarchical role minimums', () => {
    it('should return empty array for BILLING minimum (use additionalRoles)', () => {
      const roles = getRolesWithMinimumAccess('BILLING')
      expect(roles).toHaveLength(0)
    })

    it('should return empty array for ANALYTICS minimum (use additionalRoles)', () => {
      const roles = getRolesWithMinimumAccess('ANALYTICS')
      expect(roles).toHaveLength(0)
    })
  })

  describe('with additionalRoles', () => {
    it('should include BILLING when specified in additionalRoles for ADMIN minimum', () => {
      const roles = getRolesWithMinimumAccess('ADMIN', ['BILLING'])
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('BILLING')
      expect(roles).toHaveLength(2)
    })

    it('should include ANALYTICS when specified in additionalRoles for VIEWER minimum', () => {
      const roles = getRolesWithMinimumAccess('VIEWER', ['ANALYTICS'])
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).toContain('EDITOR')
      expect(roles).toContain('AUTHOR')
      expect(roles).toContain('VIEWER')
      expect(roles).toContain('ANALYTICS')
      expect(roles).toHaveLength(6)
    })

    it('should include both BILLING and ANALYTICS when both specified', () => {
      const roles = getRolesWithMinimumAccess('EDITOR', ['BILLING', 'ANALYTICS'])
      expect(roles).toContain('ADMIN')
      expect(roles).toContain('MANAGER')
      expect(roles).toContain('EDITOR')
      expect(roles).toContain('BILLING')
      expect(roles).toContain('ANALYTICS')
      expect(roles).toHaveLength(5)
    })

    it('should return additionalRoles for non-hierarchical minimum', () => {
      const roles = getRolesWithMinimumAccess('BILLING', ['BILLING'])
      expect(roles).toContain('BILLING')
      expect(roles).toHaveLength(1)
    })
  })
})

// ============================================================================
// getAllRoles FUNCTION TESTS
// ============================================================================

describe('getAllRoles()', () => {
  it('should return all 7 roles', () => {
    const roles = getAllRoles()
    expect(roles).toHaveLength(7)
  })

  it('should include all hierarchical roles', () => {
    const roles = getAllRoles()
    expect(roles).toContain('ADMIN')
    expect(roles).toContain('MANAGER')
    expect(roles).toContain('EDITOR')
    expect(roles).toContain('AUTHOR')
    expect(roles).toContain('VIEWER')
  })

  it('should include all non-hierarchical roles', () => {
    const roles = getAllRoles()
    expect(roles).toContain('BILLING')
    expect(roles).toContain('ANALYTICS')
  })
})

// ============================================================================
// compareRoles FUNCTION TESTS
// ============================================================================

describe('compareRoles()', () => {
  describe('hierarchical comparisons', () => {
    it('should return -1 when ADMIN compared to MANAGER (ADMIN > MANAGER)', () => {
      expect(compareRoles('ADMIN', 'MANAGER')).toBe(-1)
    })

    it('should return 1 when MANAGER compared to ADMIN (MANAGER < ADMIN)', () => {
      expect(compareRoles('MANAGER', 'ADMIN')).toBe(1)
    })

    it('should return 0 when comparing same role', () => {
      expect(compareRoles('ADMIN', 'ADMIN')).toBe(0)
      expect(compareRoles('VIEWER', 'VIEWER')).toBe(0)
    })

    it('should return -1 when ADMIN compared to VIEWER', () => {
      expect(compareRoles('ADMIN', 'VIEWER')).toBe(-1)
    })

    it('should return 1 when VIEWER compared to ADMIN', () => {
      expect(compareRoles('VIEWER', 'ADMIN')).toBe(1)
    })

    it('should return -1 when EDITOR compared to AUTHOR', () => {
      expect(compareRoles('EDITOR', 'AUTHOR')).toBe(-1)
    })

    it('should return 1 when AUTHOR compared to EDITOR', () => {
      expect(compareRoles('AUTHOR', 'EDITOR')).toBe(1)
    })
  })

  describe('non-hierarchical comparisons', () => {
    it('should return 0 when comparing two non-hierarchical roles', () => {
      expect(compareRoles('BILLING', 'ANALYTICS')).toBe(0)
      expect(compareRoles('ANALYTICS', 'BILLING')).toBe(0)
    })

    it('should return 0 when comparing same non-hierarchical role', () => {
      expect(compareRoles('BILLING', 'BILLING')).toBe(0)
      expect(compareRoles('ANALYTICS', 'ANALYTICS')).toBe(0)
    })
  })

  describe('mixed hierarchical and non-hierarchical', () => {
    it('should return -1 when hierarchical compared to non-hierarchical', () => {
      expect(compareRoles('ADMIN', 'BILLING')).toBe(-1)
      expect(compareRoles('VIEWER', 'ANALYTICS')).toBe(-1)
    })

    it('should return 1 when non-hierarchical compared to hierarchical', () => {
      expect(compareRoles('BILLING', 'ADMIN')).toBe(1)
      expect(compareRoles('ANALYTICS', 'VIEWER')).toBe(1)
    })
  })
})

// ============================================================================
// isRoleHigherThan FUNCTION TESTS
// ============================================================================

describe('isRoleHigherThan()', () => {
  describe('hierarchical role comparisons', () => {
    it('should return true when ADMIN is higher than MANAGER', () => {
      expect(isRoleHigherThan('ADMIN', 'MANAGER')).toBe(true)
    })

    it('should return true when ADMIN is higher than VIEWER', () => {
      expect(isRoleHigherThan('ADMIN', 'VIEWER')).toBe(true)
    })

    it('should return true when MANAGER is higher than EDITOR', () => {
      expect(isRoleHigherThan('MANAGER', 'EDITOR')).toBe(true)
    })

    it('should return true when EDITOR is higher than AUTHOR', () => {
      expect(isRoleHigherThan('EDITOR', 'AUTHOR')).toBe(true)
    })

    it('should return true when AUTHOR is higher than VIEWER', () => {
      expect(isRoleHigherThan('AUTHOR', 'VIEWER')).toBe(true)
    })

    it('should return false when VIEWER is NOT higher than ADMIN', () => {
      expect(isRoleHigherThan('VIEWER', 'ADMIN')).toBe(false)
    })

    it('should return false when MANAGER is NOT higher than ADMIN', () => {
      expect(isRoleHigherThan('MANAGER', 'ADMIN')).toBe(false)
    })

    it('should return false when comparing same role (not strictly higher)', () => {
      expect(isRoleHigherThan('ADMIN', 'ADMIN')).toBe(false)
      expect(isRoleHigherThan('VIEWER', 'VIEWER')).toBe(false)
    })
  })

  describe('non-hierarchical role comparisons', () => {
    it('should return false for any comparison involving non-hierarchical roles', () => {
      // Non-hierarchical vs non-hierarchical
      expect(isRoleHigherThan('BILLING', 'ANALYTICS')).toBe(false)
      expect(isRoleHigherThan('ANALYTICS', 'BILLING')).toBe(false)

      // Non-hierarchical vs hierarchical
      expect(isRoleHigherThan('BILLING', 'ADMIN')).toBe(false)
      expect(isRoleHigherThan('BILLING', 'VIEWER')).toBe(false)

      // Hierarchical vs non-hierarchical
      expect(isRoleHigherThan('ADMIN', 'BILLING')).toBe(false)
      expect(isRoleHigherThan('VIEWER', 'ANALYTICS')).toBe(false)
    })

    it('should return false when comparing same non-hierarchical role', () => {
      expect(isRoleHigherThan('BILLING', 'BILLING')).toBe(false)
      expect(isRoleHigherThan('ANALYTICS', 'ANALYTICS')).toBe(false)
    })
  })
})

// ============================================================================
// COMPLETE ROLE MATRIX TESTS
// ============================================================================

describe('Complete Role Matrix', () => {
  const hierarchicalRoles = ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER'] as const
  const nonHierarchicalRoles = ['BILLING', 'ANALYTICS'] as const
  const allRoles = [...hierarchicalRoles, ...nonHierarchicalRoles] as const

  describe('hasMinimumRole complete matrix for hierarchical roles', () => {
    const expectedResults: Record<string, Record<string, boolean>> = {
      ADMIN: { ADMIN: true, MANAGER: true, EDITOR: true, AUTHOR: true, VIEWER: true },
      MANAGER: { ADMIN: false, MANAGER: true, EDITOR: true, AUTHOR: true, VIEWER: true },
      EDITOR: { ADMIN: false, MANAGER: false, EDITOR: true, AUTHOR: true, VIEWER: true },
      AUTHOR: { ADMIN: false, MANAGER: false, EDITOR: false, AUTHOR: true, VIEWER: true },
      VIEWER: { ADMIN: false, MANAGER: false, EDITOR: false, AUTHOR: false, VIEWER: true },
    }

    for (const userRole of hierarchicalRoles) {
      for (const requiredRole of hierarchicalRoles) {
        it(`${userRole} ${expectedResults[userRole][requiredRole] ? 'SHOULD' : 'should NOT'} satisfy ${requiredRole} requirement`, () => {
          expect(hasMinimumRole(userRole, requiredRole)).toBe(expectedResults[userRole][requiredRole])
        })
      }
    }
  })

  describe('hasMinimumRole matrix: non-hierarchical cannot satisfy hierarchical', () => {
    for (const userRole of nonHierarchicalRoles) {
      for (const requiredRole of hierarchicalRoles) {
        it(`${userRole} should NOT satisfy ${requiredRole} requirement`, () => {
          expect(hasMinimumRole(userRole, requiredRole)).toBe(false)
        })
      }
    }
  })

  describe('hasMinimumRole matrix: hierarchical cannot satisfy non-hierarchical', () => {
    for (const userRole of hierarchicalRoles) {
      for (const requiredRole of nonHierarchicalRoles) {
        it(`${userRole} should NOT satisfy ${requiredRole} requirement`, () => {
          expect(hasMinimumRole(userRole, requiredRole)).toBe(false)
        })
      }
    }
  })

  describe('hasMinimumRole matrix: non-hierarchical exact match only', () => {
    for (const userRole of nonHierarchicalRoles) {
      for (const requiredRole of nonHierarchicalRoles) {
        const shouldMatch = userRole === requiredRole
        it(`${userRole} ${shouldMatch ? 'SHOULD' : 'should NOT'} satisfy ${requiredRole} requirement`, () => {
          expect(hasMinimumRole(userRole, requiredRole)).toBe(shouldMatch)
        })
      }
    }
  })
})

// ============================================================================
// EDGE CASES AND BOUNDARY CONDITIONS
// ============================================================================

describe('Edge Cases and Boundary Conditions', () => {
  describe('role level boundaries', () => {
    it('should maintain strict ordering between consecutive hierarchical levels', () => {
      const orderedRoles = ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER'] as const
      for (let i = 0; i < orderedRoles.length - 1; i++) {
        const higherRole = orderedRoles[i]
        const lowerRole = orderedRoles[i + 1]

        // Higher role should have lower level number
        expect(getRoleLevel(higherRole)).toBeLessThan(getRoleLevel(lowerRole))

        // Higher role should satisfy lower role requirement
        expect(hasMinimumRole(higherRole, lowerRole)).toBe(true)

        // Lower role should NOT satisfy higher role requirement
        expect(hasMinimumRole(lowerRole, higherRole)).toBe(false)
      }
    })

    it('should handle the boundary between hierarchical and non-hierarchical correctly', () => {
      // VIEWER is the lowest hierarchical (level 4)
      // BILLING and ANALYTICS are non-hierarchical (level -1)

      // VIEWER can access VIEWER-level things
      expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true)

      // But VIEWER cannot access BILLING or ANALYTICS
      expect(hasMinimumRole('VIEWER', 'BILLING')).toBe(false)
      expect(hasMinimumRole('VIEWER', 'ANALYTICS')).toBe(false)

      // And BILLING/ANALYTICS cannot access even VIEWER
      expect(hasMinimumRole('BILLING', 'VIEWER')).toBe(false)
      expect(hasMinimumRole('ANALYTICS', 'VIEWER')).toBe(false)
    })
  })

  describe('additionalRoles edge cases', () => {
    it('should handle empty additionalRoles array', () => {
      expect(hasMinimumRole('ADMIN', 'VIEWER', [])).toBe(true)
      expect(hasMinimumRole('BILLING', 'VIEWER', [])).toBe(false)
    })

    it('should handle additionalRoles with duplicates', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN', ['BILLING', 'BILLING'])).toBe(true)
    })

    it('should handle additionalRoles with multiple non-hierarchical roles', () => {
      expect(hasMinimumRole('BILLING', 'ADMIN', ['BILLING', 'ANALYTICS'])).toBe(true)
      expect(hasMinimumRole('ANALYTICS', 'ADMIN', ['BILLING', 'ANALYTICS'])).toBe(true)
    })
  })

  describe('self-reference consistency', () => {
    it('every role should satisfy its own requirement', () => {
      const allRoles = getAllRoles()
      for (const role of allRoles) {
        expect(hasMinimumRole(role as Role, role as Role)).toBe(true)
      }
    })

    it('every role compared to itself should return 0', () => {
      const allRoles = getAllRoles()
      for (const role of allRoles) {
        expect(compareRoles(role as Role, role as Role)).toBe(0)
      }
    })

    it('no role should be strictly higher than itself', () => {
      const allRoles = getAllRoles()
      for (const role of allRoles) {
        expect(isRoleHigherThan(role as Role, role as Role)).toBe(false)
      }
    })
  })
})

// ============================================================================
// TRANSITIVITY TESTS
// ============================================================================

describe('Transitivity Properties', () => {
  describe('hasMinimumRole transitivity for hierarchical roles', () => {
    it('if ADMIN satisfies MANAGER and MANAGER satisfies EDITOR, then ADMIN satisfies EDITOR', () => {
      expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true)
      expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
      expect(hasMinimumRole('ADMIN', 'EDITOR')).toBe(true)
    })

    it('if MANAGER satisfies EDITOR and EDITOR satisfies AUTHOR, then MANAGER satisfies AUTHOR', () => {
      expect(hasMinimumRole('MANAGER', 'EDITOR')).toBe(true)
      expect(hasMinimumRole('EDITOR', 'AUTHOR')).toBe(true)
      expect(hasMinimumRole('MANAGER', 'AUTHOR')).toBe(true)
    })

    it('if EDITOR satisfies AUTHOR and AUTHOR satisfies VIEWER, then EDITOR satisfies VIEWER', () => {
      expect(hasMinimumRole('EDITOR', 'AUTHOR')).toBe(true)
      expect(hasMinimumRole('AUTHOR', 'VIEWER')).toBe(true)
      expect(hasMinimumRole('EDITOR', 'VIEWER')).toBe(true)
    })

    it('full chain: ADMIN satisfies all through transitivity', () => {
      // ADMIN -> MANAGER -> EDITOR -> AUTHOR -> VIEWER
      expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
    })
  })

  describe('isRoleHigherThan transitivity for hierarchical roles', () => {
    it('if ADMIN > MANAGER and MANAGER > EDITOR, then ADMIN > EDITOR', () => {
      expect(isRoleHigherThan('ADMIN', 'MANAGER')).toBe(true)
      expect(isRoleHigherThan('MANAGER', 'EDITOR')).toBe(true)
      expect(isRoleHigherThan('ADMIN', 'EDITOR')).toBe(true)
    })

    it('if EDITOR > AUTHOR and AUTHOR > VIEWER, then EDITOR > VIEWER', () => {
      expect(isRoleHigherThan('EDITOR', 'AUTHOR')).toBe(true)
      expect(isRoleHigherThan('AUTHOR', 'VIEWER')).toBe(true)
      expect(isRoleHigherThan('EDITOR', 'VIEWER')).toBe(true)
    })
  })
})

// ============================================================================
// ANTI-SYMMETRY TESTS
// ============================================================================

describe('Anti-Symmetry Properties', () => {
  describe('hasMinimumRole anti-symmetry for hierarchical roles', () => {
    it('if ADMIN satisfies VIEWER, then VIEWER does NOT satisfy ADMIN', () => {
      expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true)
      expect(hasMinimumRole('VIEWER', 'ADMIN')).toBe(false)
    })

    it('if MANAGER satisfies AUTHOR, then AUTHOR does NOT satisfy MANAGER', () => {
      expect(hasMinimumRole('MANAGER', 'AUTHOR')).toBe(true)
      expect(hasMinimumRole('AUTHOR', 'MANAGER')).toBe(false)
    })
  })

  describe('compareRoles anti-symmetry', () => {
    it('compareRoles(A, B) = -compareRoles(B, A) for hierarchical roles', () => {
      expect(compareRoles('ADMIN', 'VIEWER')).toBe(-1)
      expect(compareRoles('VIEWER', 'ADMIN')).toBe(1)
      expect(compareRoles('ADMIN', 'VIEWER') + compareRoles('VIEWER', 'ADMIN')).toBe(0)
    })

    it('compareRoles(A, B) = -compareRoles(B, A) for mixed roles', () => {
      expect(compareRoles('ADMIN', 'BILLING')).toBe(-1)
      expect(compareRoles('BILLING', 'ADMIN')).toBe(1)
      expect(compareRoles('ADMIN', 'BILLING') + compareRoles('BILLING', 'ADMIN')).toBe(0)
    })
  })

  describe('isRoleHigherThan anti-symmetry', () => {
    it('if ADMIN is higher than VIEWER, then VIEWER is NOT higher than ADMIN', () => {
      expect(isRoleHigherThan('ADMIN', 'VIEWER')).toBe(true)
      expect(isRoleHigherThan('VIEWER', 'ADMIN')).toBe(false)
    })

    it('mutual exclusion: if A > B then NOT B > A', () => {
      const pairs = [
        ['ADMIN', 'MANAGER'],
        ['MANAGER', 'EDITOR'],
        ['EDITOR', 'AUTHOR'],
        ['AUTHOR', 'VIEWER'],
      ] as const

      for (const [higher, lower] of pairs) {
        expect(isRoleHigherThan(higher, lower)).toBe(true)
        expect(isRoleHigherThan(lower, higher)).toBe(false)
      }
    })
  })
})
