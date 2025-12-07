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

const ROLE_HIERARCHY: Record<Role, number> = {
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
