// src/middleware/account.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '../types'
import type { Role } from '../auth/roles'
import { queryOne } from '../db/sql'

export const accountMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  // Check account-id header (required)
  const accountId = c.req.header('account-id')

  if (!accountId) {
    throw new HTTPException(400, {
      message: 'Missing account-id header',
    })
  }

  // Get user from context (should be set by jwtAuth middleware)
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, {
      message: 'Unauthorized: User not authenticated',
    })
  }

  // Super-admin bypass - super admins can access any account
  if (user.isSuperAdmin) {
    c.set('accountId', accountId)
    c.set('userRole', 'ADMIN' as Role)
    c.set('isSystemAdminAccess', true)
    await next()
    return
  }

  // Check user-account membership in database
  const db = c.get('db')
  const accountDb = c.env.DB ?? db
  if (!accountDb) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }
  const membership = await queryOne<{ role: Role }>(
    accountDb,
    `SELECT role FROM user_accounts WHERE user_id = ? AND account_id = ? LIMIT 1`,
    [user.id, accountId]
  )
  if (!membership) {
    throw new HTTPException(403, {
      message: 'Forbidden: User does not have access to this account',
    })
  }

  // Set accountId and userRole in context
  c.set('accountId', accountId)
  c.set('userRole', membership.role as Role)
  c.set('isSystemAdminAccess', false)

  await next()
})
