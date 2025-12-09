// src/middleware/account.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { userAccounts } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import type { HonoEnv } from '../types'
import type { Role } from '../auth/roles'

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
  const [membership] = await db
    .select()
    .from(userAccounts)
    .where(
      and(
        eq(userAccounts.userId, user.id),
        eq(userAccounts.accountId, accountId)
      )
    )
    .limit(1)

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
