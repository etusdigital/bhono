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
