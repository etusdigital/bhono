import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listUsersRoute,
  getUserRoute,
  // createUserRoute, // Disabled - users should only be created via OAuth
  updateUserRoute,
  deleteUserRoute,
  createBulkUserAccountsRoute,
  deleteBulkUserAccountsRoute,
  restoreUserRoute,
} from './routes'
import {
  listUsersHandler,
  getUserHandler,
  // createUserHandler, // Disabled - users should only be created via OAuth
  updateUserHandler,
  deleteUserHandler,
  createBulkUserAccountsHandler,
  deleteBulkUserAccountsHandler,
  restoreUserHandler,
} from './handlers'

const users = new OpenAPIHono<HonoEnv>()

/**
 * Convert OpenAPI path syntax {param} to Hono path syntax :param
 * This is needed because .use() requires Hono path syntax
 */
function toHonoPath(openApiPath: string): string {
  return openApiPath.replace(/{(\w+)}/g, ':$1')
}

// List users - requires VIEWER role or higher
users.openapi(listUsersRoute, listUsersHandler)

// NOTE: User creation route is disabled - users should only be created through Google OAuth
// Create user - requires ADMIN role
// users.use(toHonoPath(createUserRoute.path), requireRole('ADMIN'))
// users.openapi(createUserRoute, createUserHandler)

// Bulk User-Account Operations - register BEFORE /:id routes to prevent wildcard matching
// Create user-account relationships - requires MANAGER role or higher
users.use(toHonoPath(createBulkUserAccountsRoute.path), requireRole('MANAGER'))
users.openapi(createBulkUserAccountsRoute, createBulkUserAccountsHandler)

// Delete user-account relationships - requires MANAGER role or higher
users.use(toHonoPath(deleteBulkUserAccountsRoute.path), requireRole('MANAGER'))
users.openapi(deleteBulkUserAccountsRoute, deleteBulkUserAccountsHandler)

// Get user - requires VIEWER role or higher
users.openapi(getUserRoute, getUserHandler)

// Update user - requires MANAGER role or higher
users.use(toHonoPath(updateUserRoute.path), requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Delete user - requires ADMIN role
users.use(toHonoPath(deleteUserRoute.path), requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)

// Restore soft-deleted user - requires ADMIN role
users.use(toHonoPath(restoreUserRoute.path), requireRole('ADMIN'))
users.openapi(restoreUserRoute, restoreUserHandler)

export { users }
