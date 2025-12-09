import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listAccountsRoute,
  getAccountRoute,
  createAccountRoute,
  updateAccountRoute,
  deleteAccountRoute,
} from './routes'
import {
  listAccountsHandler,
  getAccountHandler,
  createAccountHandler,
  updateAccountHandler,
  deleteAccountHandler,
} from './handlers'

const accounts = new OpenAPIHono<HonoEnv>()

// List accounts - requires VIEWER role or higher
accounts.openapi(listAccountsRoute, listAccountsHandler)

// Get account - requires VIEWER role or higher
accounts.openapi(getAccountRoute, getAccountHandler)

// Create account - super-admin only (enforced in service layer)
// Still requires ADMIN role at route level for non-super-admins
accounts.use(createAccountRoute.path, requireRole('ADMIN'))
accounts.openapi(createAccountRoute, createAccountHandler)

// Update account - requires MANAGER role or higher
accounts.use(updateAccountRoute.path, requireRole('MANAGER'))
accounts.openapi(updateAccountRoute, updateAccountHandler)

// Delete account - super-admin only (enforced in service layer)
// Still requires ADMIN role at route level for non-super-admins
accounts.use(deleteAccountRoute.path, requireRole('ADMIN'))
accounts.openapi(deleteAccountRoute, deleteAccountHandler)

export { accounts }
