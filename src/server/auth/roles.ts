// src/auth/roles.ts
export const Role = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
  VIEWER: 'VIEWER',
  BILLING: 'BILLING',
  ANALYTICS: 'ANALYTICS',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 0,
  MANAGER: 1,
  EDITOR: 2,
  AUTHOR: 3,
  VIEWER: 4,
  BILLING: -1,
  ANALYTICS: -1,
}

export function hasMinimumRole(
  userRole: Role,
  requiredRole: Role,
  additionalRoles: Role[] = []
): boolean {
  // Check additional roles first (for non-hierarchical access)
  if (additionalRoles.includes(userRole)) {
    return true
  }

  const userLevel = ROLE_HIERARCHY[userRole]
  const requiredLevel = ROLE_HIERARCHY[requiredRole]

  // Non-hierarchical roles can only match exactly
  if (userLevel === -1 || requiredLevel === -1) {
    return userRole === requiredRole
  }

  // Lower or equal level = higher or equal privilege
  return userLevel <= requiredLevel
}

/**
 * Get all roles that have access from a minimum role level
 * Non-hierarchical roles (BILLING, ANALYTICS) are excluded unless in additionalRoles
 */
export function getRolesWithMinimumAccess(
  minRole: Role,
  additionalRoles: Role[] = []
): Role[] {
  const minLevel = ROLE_HIERARCHY[minRole]

  // Non-hierarchical role as minimum returns empty (use additionalRoles)
  if (minLevel === -1) {
    return [...additionalRoles]
  }

  const roles: Role[] = []

  for (const [role, level] of Object.entries(ROLE_HIERARCHY)) {
    if (level !== -1 && level <= minLevel) {
      roles.push(role as Role)
    }
  }

  // Add additional roles
  for (const role of additionalRoles) {
    if (!roles.includes(role)) {
      roles.push(role)
    }
  }

  return roles
}

/**
 * Check if a role is hierarchical (not BILLING or ANALYTICS)
 */
export function isHierarchicalRole(role: Role): boolean {
  return ROLE_HIERARCHY[role] !== -1
}

/**
 * Get the numeric level of a role (0=ADMIN highest, 4=VIEWER lowest, -1=special)
 */
export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY[role]
}

/**
 * Get all available roles
 */
export function getAllRoles(): Role[] {
  return Object.values(Role)
}

/**
 * Compare two roles like a sort comparator
 * Returns: -1 if roleA > roleB, 0 if equal, 1 if roleA < roleB
 * Non-hierarchical roles are treated as equal to each other
 */
export function compareRoles(roleA: Role, roleB: Role): number {
  const levelA = ROLE_HIERARCHY[roleA]
  const levelB = ROLE_HIERARCHY[roleB]

  // Both non-hierarchical = equal
  if (levelA === -1 && levelB === -1) {
    return 0
  }

  // One non-hierarchical = lower than hierarchical
  if (levelA === -1) {
    return 1
  }
  if (levelB === -1) {
    return -1
  }

  // Compare hierarchical roles (lower level = higher privilege)
  if (levelA < levelB) return -1
  if (levelA > levelB) return 1
  return 0
}

/**
 * Check if roleA is strictly higher than roleB in the hierarchy
 */
export function isRoleHigherThan(roleA: Role, roleB: Role): boolean {
  const levelA = ROLE_HIERARCHY[roleA]
  const levelB = ROLE_HIERARCHY[roleB]

  // Non-hierarchical roles cannot be "higher"
  if (levelA === -1 || levelB === -1) {
    return false
  }

  return levelA < levelB
}
