// Small compatibility layer for package-owned account routes.
//
// @etus/auth 0.3 owns membership persistence, but it still has a few hard-coded
// assumptions around account membership roles. Keep those checks here so the
// boilerplate exposes one stable contract until the package grows
// multiTenant.roles/defaultRole.

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { HonoEnv } from '../types'
import { ACCOUNT_MEMBERSHIP_ROLES, type AccountMembershipRole } from './matrix'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isAccountMembershipRole(role: unknown): role is AccountMembershipRole {
  return (
    typeof role === 'string'
    && (ACCOUNT_MEMBERSHIP_ROLES as readonly string[]).includes(role)
  )
}

export function requireSupportedAccountMembershipRole(methods: readonly string[] = ['POST', 'PATCH']) {
  const roleMethods = new Set(methods)

  return createMiddleware<HonoEnv>(async (c, next) => {
    if (!roleMethods.has(c.req.method)) {
      await next()
      return
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw new HTTPException(400, { message: 'JSON body is required' })
    }

    const role = isRecord(body) ? body.role : undefined
    if (role === undefined) {
      throw new HTTPException(400, {
        message: 'Membership role is required',
      })
    }

    if (!isAccountMembershipRole(role)) {
      throw new HTTPException(400, {
        message: `Membership role must be one of: ${ACCOUNT_MEMBERSHIP_ROLES.join(', ')}`,
      })
    }

    await next()
  })
}
