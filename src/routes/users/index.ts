import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listUsersRoute,
  getUserRoute,
  createUserRoute,
  updateUserRoute,
  deleteUserRoute,
} from './routes'
import {
  listUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from './handlers'

const users = new OpenAPIHono<HonoEnv>()

// List users - requires VIEWER role or higher
users.openapi(listUsersRoute, listUsersHandler)

// Get user - requires VIEWER role or higher
users.openapi(getUserRoute, getUserHandler)

// Create user - requires ADMIN role
users.use(createUserRoute.path, requireRole('ADMIN'))
users.openapi(createUserRoute, createUserHandler)

// Update user - requires MANAGER role or higher
users.use(updateUserRoute.path, requireRole('MANAGER'))
users.openapi(updateUserRoute, updateUserHandler)

// Delete user - requires ADMIN role
users.use(deleteUserRoute.path, requireRole('ADMIN'))
users.openapi(deleteUserRoute, deleteUserHandler)

export { users }
