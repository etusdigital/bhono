// Permission guard for app routes.
//
// @etus/auth's middleware resolves the user's effective permissions into the
// `authPermissions` context variable (role matrix + hierarchy). This guard
// reads that variable — it never needs the AuthInstance, so route files stay
// module-scoped. Wildcards ('resources:*', '*') are honored by hasPermission.

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { hasPermission } from '@etus/auth'
import type { HonoEnv } from '../types'

export function requirePermission(permission: string) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const permissions = c.get('authPermissions') ?? []
    if (!hasPermission(permission, permissions)) {
      throw new HTTPException(403, { message: `Missing permission: ${permission}` })
    }
    await next()
  })
}

// Interceptor for PATCH /accounts/:id/members/:userId.
//
// @etus/auth's accountRoutes lets any account `admin` change any member's
// role (it only protects against removing the last admin). That leaves the
// account owner demotable by an admin. This guard runs before accountRoutes
// and rejects any attempt to modify the owner's membership unless the
// requester IS the owner. Mount with the parametric path so :id / :userId
// are parsed.
export function protectAccountOwner() {
  return createMiddleware<HonoEnv>(async (c, next) => {
    if (c.req.method !== 'PATCH') {
      await next()
      return
    }

    const accountId = c.req.param('id')
    const targetUserId = c.req.param('userId')
    const db = c.env.DB
    if (!accountId || !targetUserId || !db) {
      await next()
      return
    }

    const account = await db
      .prepare('SELECT owner_id FROM auth_accounts WHERE id = ?')
      .bind(accountId)
      .first<{ owner_id: string }>()

    // Unknown account — let accountRoutes return its own 404.
    if (!account) {
      await next()
      return
    }

    if (targetUserId === account.owner_id) {
      const requester = c.get('authUser')
      if (requester?.id !== account.owner_id) {
        throw new HTTPException(403, {
          message: "Only the account owner can modify the owner's membership",
        })
      }
    }

    await next()
  })
}
