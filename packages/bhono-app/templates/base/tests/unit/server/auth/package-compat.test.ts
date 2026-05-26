import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '@server/middleware'
import type { HonoEnv } from '@server/types'
import {
  isAccountMembershipRole,
  requireSupportedAccountMembershipRole,
} from '@server/auth/package-compat'

function makeApp() {
  const app = new Hono<HonoEnv>()
  app.onError(errorHandler)
  app.use('/accounts/:id/members/invite', requireSupportedAccountMembershipRole(['POST']))
  app.use('/accounts/:id/members/:userId', requireSupportedAccountMembershipRole(['PATCH']))
  app.post('/accounts/:id/members/invite', async (c) => {
    const body = await c.req.json()
    return c.json({ ok: true, body })
  })
  app.patch('/accounts/:id/members/:userId', async (c) => {
    const body = await c.req.json()
    return c.json({ ok: true, body })
  })
  app.get('/accounts/:id/members/:userId', (c) => c.json({ ok: true }))
  return app
}

describe('isAccountMembershipRole', () => {
  it('accepts only the account membership roles supported by the package routes', () => {
    expect(isAccountMembershipRole('admin')).toBe(true)
    expect(isAccountMembershipRole('member')).toBe(true)
    expect(isAccountMembershipRole('guest')).toBe(true)
    expect(isAccountMembershipRole('owner')).toBe(false)
    expect(isAccountMembershipRole('viewer')).toBe(false)
  })
})

describe('requireSupportedAccountMembershipRole', () => {
  it('rejects member invitations without an explicit role', async () => {
    const res = await makeApp().request('/accounts/acc-1/members/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toBe('Membership role is required')
  })

  it('rejects product-only and package-default roles before they reach @etus/auth', async () => {
    for (const role of ['owner', 'viewer']) {
      const res = await makeApp().request('/accounts/acc-1/members/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com', role }),
        headers: { 'content-type': 'application/json' },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Membership role must be one of: admin, member, guest')
    }
  })

  it('allows supported roles and keeps the request body readable by downstream routes', async () => {
    const res = await makeApp().request('/accounts/acc-1/members/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', role: 'member' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.body).toEqual({ email: 'new@example.com', role: 'member' })
  })

  it('applies the same contract to membership role updates', async () => {
    const res = await makeApp().request('/accounts/acc-1/members/user-1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'guest' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(200)
  })

  it('ignores non-mutating membership requests', async () => {
    const res = await makeApp().request('/accounts/acc-1/members/user-1')

    expect(res.status).toBe(200)
  })
})
