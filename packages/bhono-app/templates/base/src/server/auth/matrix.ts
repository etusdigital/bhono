// RBAC matrix for @etus/auth — passed to createAuth({ permissions, roleHierarchy }).
// Requirements: docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md (R6-R8).

export const ROLES = ['owner', 'admin', 'member', 'guest'] as const
export type Role = (typeof ROLES)[number]

export const ACCOUNT_MEMBERSHIP_ROLES = ['admin', 'member', 'guest'] as const
export type AccountMembershipRole = (typeof ACCOUNT_MEMBERSHIP_ROLES)[number]

// Permission catalog — every entry has a consumer in PERMISSIONS_MATRIX below.
// Products extend this locally; see the auth-extend skill.
export const PERMISSION_CATALOG = [
  'account:read',
  'account:update',
  'account:delete',
  'members:invite',
  'members:remove',
  'members:role',
  'audit:read',
  'billing:view',
  'billing:manage',
  'resources:create',
  'resources:read',
  'resources:update',
  'resources:delete',
] as const

// Most → least privileged. Higher roles inherit lower roles' permissions via the
// @etus/auth pipeline — this affects BOTH requireRole guards AND permission
// resolution (R7b), so PERMISSIONS_MATRIX entries are the final aggregate per role.
export const ROLE_HIERARCHY: Role[] = ['owner', 'admin', 'member', 'guest']

// Role → permission strings. Wildcards supported: 'resources:*', '*'.
export const PERMISSIONS_MATRIX: Record<Role, string[]> = {
  owner: ['*'],
  admin: [
    'account:read',
    'account:update',
    'members:*',
    'audit:read',
    'billing:view',
    'billing:manage',
    'resources:*',
  ],
  member: [
    'account:read',
    'members:invite',
    'resources:create',
    'resources:read',
    'resources:update',
  ],
  guest: ['account:read', 'resources:read'],
}

// Gateway scope → local permissions (gateway-as-authority, v0.7.0).
//
// This IS the scope→action translation that belongs to the consuming app: the
// gateway resolves which colon-vocabulary scopes a user holds on this app's
// resource, and SCOPE_MAP turns them into the local permission strings the
// guards enforce (`requirePermission` reads `authPermissions`).
//
// IMPORTANT — keep this in sync with the gateway in two directions:
//   * KEYS must equal the scope vocabulary your app declares when it is
//     registered as a `web_app` resource in the gateway (here `bhono:*` —
//     rename to your app's prefix, e.g. `myapp:editor`).
//   * VALUES must be entries of PERMISSION_CATALOG above (or wildcards), or the
//     guards will never match.
// Scopes the gateway returns that are not mapped here are simply ignored.
export const SCOPE_MAP: Record<string, string[]> = {
  'bhono:admin': ['*'],
  'bhono:editor': [
    'account:read',
    'members:invite',
    'resources:create',
    'resources:read',
    'resources:update',
  ],
  'bhono:viewer': ['account:read', 'resources:read'],
}
