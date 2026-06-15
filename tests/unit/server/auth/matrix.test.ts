import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS_MATRIX,
  PERMISSION_CATALOG,
  ACCOUNT_ROLE_MAP,
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

// Gateway per-account roles (viewer < editor < manager < admin, migration 0070)
// mapped to local permissions via ACCOUNT_ROLE_MAP. Drift here silently mis-grants
// when the gateway resolves a per-account role for a user.
describe('ACCOUNT_ROLE_MAP', () => {
  const GATEWAY_ACCOUNT_ROLES = ['viewer', 'editor', 'manager', 'admin']

  it('maps exactly the four gateway account roles', () => {
    expect(Object.keys(ACCOUNT_ROLE_MAP).sort()).toEqual([...GATEWAY_ACCOUNT_ROLES].sort())
  })

  it('every non-wildcard permission exists in PERMISSION_CATALOG', () => {
    const catalog = new Set<string>(PERMISSION_CATALOG)
    for (const [role, perms] of Object.entries(ACCOUNT_ROLE_MAP)) {
      for (const perm of perms) {
        if (perm === '*' || perm.endsWith(':*')) continue
        expect(
          catalog.has(perm),
          `permission "${perm}" (account role "${role}") is not in PERMISSION_CATALOG`,
        ).toBe(true)
      }
    }
  })

  it('is cumulative: viewer ⊆ editor ⊆ manager, admin is the wildcard', () => {
    const editor = new Set(ACCOUNT_ROLE_MAP.editor)
    for (const p of ACCOUNT_ROLE_MAP.viewer) {
      expect(editor.has(p), `editor is missing viewer permission "${p}"`).toBe(true)
    }
    const manager = new Set(ACCOUNT_ROLE_MAP.manager)
    for (const p of ACCOUNT_ROLE_MAP.editor) {
      expect(manager.has(p), `manager is missing editor permission "${p}"`).toBe(true)
    }
    expect(ACCOUNT_ROLE_MAP.admin).toContain('*')
  })
})
