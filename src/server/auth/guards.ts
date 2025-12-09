// src/auth/guards.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '../types'
import type { Role } from './roles'
import type { Permission } from './permissions'
import { hasMinimumRole } from './roles'
import { hasPermission } from './permissions'

/**
 * Middleware factory that requires a minimum role level.
 * Users with the minimum role or higher in the hierarchy can access the route.
 * Super-admins bypass all role checks.
 *
 * @param minRole - The minimum role required to access the route
 * @param additionalRoles - Optional array of non-hierarchical roles that also grant access
 */
export const requireRole = (minRole: Role, additionalRoles: Role[] = []) => {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, {
        message: 'Unauthorized: User not authenticated',
      })
    }

    // Super-admin bypass
    if (c.get('isSystemAdminAccess')) {
      await next()
      return
    }

    const userRole = c.get('userRole')

    if (!userRole) {
      throw new HTTPException(403, {
        message: 'Forbidden: No role assigned for this account',
      })
    }

    // Check if user has minimum role (userRole is guaranteed to be Role here)
    if (!hasMinimumRole(userRole as Role, minRole, additionalRoles)) {
      throw new HTTPException(403, {
        message: `Forbidden: Requires ${minRole} role or higher`,
      })
    }

    await next()
  })
}

/**
 * Middleware factory that requires a specific permission.
 * Super-admins bypass all permission checks.
 *
 * @param permission - The permission required to access the route
 */
export const requirePermission = (permission: Permission) => {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, {
        message: 'Unauthorized: User not authenticated',
      })
    }

    // Super-admin bypass
    if (c.get('isSystemAdminAccess')) {
      await next()
      return
    }

    const userRole = c.get('userRole')

    if (!userRole) {
      throw new HTTPException(403, {
        message: 'Forbidden: No role assigned for this account',
      })
    }

    // Check if user's role has the required permission (userRole is guaranteed to be Role here)
    if (!hasPermission(userRole as Role, permission)) {
      throw new HTTPException(403, {
        message: `Forbidden: Requires ${permission} permission`,
      })
    }

    await next()
  })
}
