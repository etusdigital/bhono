import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS_MATRIX,
  PERMISSION_CATALOG,
} from '@server/auth/matrix'

// Guards the invariant that @etus/auth depends on: createAuth({ permissions })
// silently resolves a missing role to [], so a role absent from the matrix
// fails closed and confusingly. These tests make that gap loud instead.
describe('RBAC matrix', () => {
  it('every declared role has a non-empty PERMISSIONS_MATRIX entry', () => {
    for (const role of ROLES) {
      expect(PERMISSIONS_MATRIX[role], `role "${role}" missing from PERMISSIONS_MATRIX`).toBeDefined()
      expect(
        PERMISSIONS_MATRIX[role].length,
        `role "${role}" resolves to no permissions`,
      ).toBeGreaterThan(0)
    }
  })

  it('PERMISSIONS_MATRIX has no entry outside the declared roles', () => {
    for (const role of Object.keys(PERMISSIONS_MATRIX)) {
      expect(ROLES as readonly string[], `"${role}" is in the matrix but not a declared role`).toContain(role)
    }
  })

  it('ROLE_HIERARCHY covers exactly the declared roles', () => {
    expect([...ROLE_HIERARCHY].sort()).toEqual([...ROLES].sort())
  })

  it('every non-wildcard permission in the matrix exists in PERMISSION_CATALOG', () => {
    const catalog = new Set<string>(PERMISSION_CATALOG)
    for (const [role, perms] of Object.entries(PERMISSIONS_MATRIX)) {
      for (const perm of perms) {
        if (perm === '*' || perm.endsWith(':*')) continue
        expect(
          catalog.has(perm),
          `permission "${perm}" (role "${role}") is not in PERMISSION_CATALOG`,
        ).toBe(true)
      }
    }
  })
})
