import { describe, it, expect } from 'vitest'
import { ACCOUNT_ROLES, mapAccountRolesToPermissions, hasPermission } from '@etus/auth'
import type { GatewayAccount } from '@etus/auth'
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
  it("maps exactly @etus/auth's gateway account roles (anchored to the package, not a literal copy)", () => {
    // Importing ACCOUNT_ROLES from the package makes this a REAL drift guard: a
    // future @etus/auth that adds/renames a role fails this test instead of
    // silently mis-granting.
    expect(Object.keys(ACCOUNT_ROLE_MAP).sort()).toEqual([...ACCOUNT_ROLES].sort())
  })

  it('every permission exists in PERMISSION_CATALOG', () => {
    const catalog = new Set<string>(PERMISSION_CATALOG)
    for (const [role, perms] of Object.entries(ACCOUNT_ROLE_MAP)) {
      for (const perm of perms) {
        expect(
          catalog.has(perm),
          `permission "${perm}" (account role "${role}") is not in PERMISSION_CATALOG`,
        ).toBe(true)
      }
    }
  })

  it('contains NO wildcards (the map is unioned across all accounts, so a wildcard would over-grant the whole app)', () => {
    for (const [role, perms] of Object.entries(ACCOUNT_ROLE_MAP)) {
      for (const perm of perms) {
        expect(
          perm === '*' || perm.endsWith(':*'),
          `account role "${role}" maps to wildcard "${perm}" — forbidden: ACCOUNT_ROLE_MAP is unioned across every gateway account a user holds, so a wildcard lets admin-on-any-account pass every guard. Use requireGatewayAccountRole(slug, role) for precise per-account authority.`,
        ).toBe(false)
      }
    }
  })

  it('is cumulative: viewer ⊆ editor ⊆ manager ⊆ admin', () => {
    const tiers = ['viewer', 'editor', 'manager', 'admin'] as const
    for (let i = 1; i < tiers.length; i++) {
      const higher = new Set(ACCOUNT_ROLE_MAP[tiers[i]])
      for (const p of ACCOUNT_ROLE_MAP[tiers[i - 1]]) {
        expect(higher.has(p), `${tiers[i]} is missing ${tiers[i - 1]} permission "${p}"`).toBe(true)
      }
    }
  })

  it('does not grant destructive permissions org-wide (no delete / billing:manage / account:delete)', () => {
    const forbidden = new Set(['resources:delete', 'account:delete', 'billing:manage'])
    for (const [role, perms] of Object.entries(ACCOUNT_ROLE_MAP)) {
      for (const perm of perms) {
        expect(forbidden.has(perm), `account role "${role}" grants destructive "${perm}" org-wide`).toBe(
          false,
        )
      }
    }
  })
})

// Over-grant regression (PR #62 review): @etus/auth UNIONS ACCOUNT_ROLE_MAP across
// EVERY gateway account a user holds (super-admin = admin everywhere). With the old
// `admin: ['*']` this meant admin-on-any-account → full app access. These tests pin
// the closed behavior against the package's REAL mapper + permission check, so a
// regression that re-introduces a wildcard/destructive grant fails here.
describe('ACCOUNT_ROLE_MAP cross-account union does not over-grant', () => {
  const acct = (slug: string, role: GatewayAccount['role']): GatewayAccount => ({
    id: `acct-${slug}`,
    slug,
    name: slug,
    role,
  })

  it('admin on an UNRELATED account does not grant a wildcard or destructive permission app-wide', () => {
    // Low-privilege in the relevant workspace (viewer), but admin on a side account.
    const perms = mapAccountRolesToPermissions(
      [acct('unum', 'viewer'), acct('side-project', 'admin')],
      ACCOUNT_ROLE_MAP,
      false,
    )
    expect(perms).not.toContain('*')
    expect(hasPermission('resources:delete', perms)).toBe(false)
    expect(hasPermission('account:delete', perms)).toBe(false)
    expect(hasPermission('billing:manage', perms)).toBe(false)
    // It DOES grant the bounded admin perms (the map's intended org-level baseline).
    expect(hasPermission('members:role', perms)).toBe(true)
  })

  it('super-admin resolves to the bounded admin set, not a wildcard', () => {
    const perms = mapAccountRolesToPermissions([], ACCOUNT_ROLE_MAP, true)
    expect(perms).not.toContain('*')
    expect(hasPermission('resources:delete', perms)).toBe(false)
    expect(hasPermission('members:role', perms)).toBe(true)
  })
})
