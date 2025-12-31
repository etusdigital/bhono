import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoEnv } from '../../types'
import { requireRole } from '../../auth/guards'
import {
  listAccountsRoute,
  getAccountRoute,
  createAccountRoute,
  updateAccountRoute,
  deleteAccountRoute,
  restoreAccountRoute,
} from './routes'
import {
  listAccountsHandler,
  getAccountHandler,
  createAccountHandler,
  updateAccountHandler,
  deleteAccountHandler,
  restoreAccountHandler,
} from './handlers'

const accounts = new OpenAPIHono<HonoEnv>()

/**
 * Convert OpenAPI path syntax {param} to Hono path syntax :param
 * This is needed because .use() requires Hono path syntax
 */
function toHonoPath(openApiPath: string): string {
  return openApiPath.replace(/{(\w+)}/g, ':$1')
}

// List accounts - requires VIEWER role or higher
accounts.openapi(listAccountsRoute, listAccountsHandler)

// Get account - requires VIEWER role or higher
accounts.openapi(getAccountRoute, getAccountHandler)

// Create account - super-admin only (enforced in service layer)
// Still requires ADMIN role at route level for non-super-admins
accounts.use(toHonoPath(createAccountRoute.path), requireRole('ADMIN'))
accounts.openapi(createAccountRoute, createAccountHandler)

// Update account - requires MANAGER role or higher
accounts.use(toHonoPath(updateAccountRoute.path), requireRole('MANAGER'))
accounts.openapi(updateAccountRoute, updateAccountHandler)

// Delete account - super-admin only (enforced in service layer)
// Still requires ADMIN role at route level for non-super-admins
accounts.use(toHonoPath(deleteAccountRoute.path), requireRole('ADMIN'))
accounts.openapi(deleteAccountRoute, deleteAccountHandler)

// Restore soft-deleted account - super-admin only (enforced in service layer)
accounts.use(toHonoPath(restoreAccountRoute.path), requireRole('ADMIN'))
accounts.openapi(restoreAccountRoute, restoreAccountHandler)

export { accounts }
