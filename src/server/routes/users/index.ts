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
} from './routes'
import {
  listUsersHandler,
  getUserHandler,
  // createUserHandler, // Disabled - users should only be created via OAuth
  updateUserHandler,
  deleteUserHandler,
  createBulkUserAccountsHandler,
  deleteBulkUserAccountsHandler,
} from './handlers'

const users = new OpenAPIHono<HonoEnv>()

// List users - requires VIEWER role or higher
users.openapi(listUsersRoute, listUsersHandler)

// Get user - requires VIEWER role or higher
users.openapi(getUserRoute, getUserHandler)

// NOTE: User creation route is disabled - users should only be created through Google OAuth
// Create user - requires ADMIN role
// users.use(createUserRoute.path, requireRole('ADMIN'))
// users.openapi(createUserRoute, createUserHandler)

// Update user - requires MANAGER role or higher
users.use(updateUserRoute.path, requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Delete user - requires ADMIN role
users.use(deleteUserRoute.path, requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)

// Bulk User-Account Operations
// Create user-account relationships - requires MANAGER role or higher
users.use(createBulkUserAccountsRoute.path, requireRole('MANAGER'))
users.openapi(createBulkUserAccountsRoute, createBulkUserAccountsHandler)

// Delete user-account relationships - requires MANAGER role or higher
users.use(deleteBulkUserAccountsRoute.path, requireRole('MANAGER'))
users.openapi(deleteBulkUserAccountsRoute, deleteBulkUserAccountsHandler)

export { users }
