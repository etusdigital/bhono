import { describe, expect, it } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { me } from '@server/routes/me'
import { createMockEnv } from '@tests/helpers/server'
import type { HonoEnv } from '@server/types'

describe('GET /api/me (gateway account context)', () => {
  it('returns a safe empty shape when no gateway context is present (gatewayAuthority off)', async () => {
    const res = await me.request('/', {}, createMockEnv())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ accounts: [], superAdmin: false })
  })

  it("reflects the user's gateway accounts and super-admin flag from context", async () => {
    const app = new OpenAPIHono<HonoEnv>()
    app.use('*', async (c, next) => {
      // The @etus/auth middleware sets these under /api/*; inject them directly here.
      const set = c.set.bind(c) as (key: string, value: unknown) => void
      set('authAccounts', [{ id: 'acct-1', slug: 'unum', name: 'Unum', role: 'manager' }])
      set('authSuperAdmin', true)
      await next()
    })
    app.route('/', me)

    const res = await app.request('/', {}, createMockEnv())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      accounts: [{ id: 'acct-1', slug: 'unum', name: 'Unum', role: 'manager' }],
      superAdmin: true,
    })
  })
})
