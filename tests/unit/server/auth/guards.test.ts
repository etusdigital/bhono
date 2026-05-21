import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import type { AuthUser } from '@etus/auth'
import { protectAccountOwner, requirePermission } from '@server/auth/guards'
import type { HonoEnv } from '@server/types'
import { createMockD1AsD1Database, setMockQueryResult } from '@tests/mocks/db'

describe('requirePermission', () => {
  function makeApp(permissions: string[], required: string) {
    const app = new Hono<HonoEnv>()
    app.use('/x', async (c, next) => {
      c.set('authPermissions', permissions)
      await next()
    })
    app.use('/x', requirePermission(required))
    app.get('/x', (c) => c.json({ ok: true }))
    return app
  }

  it('allows a request that holds the exact permission', async () => {
    const res = await makeApp(['resources:read'], 'resources:read').request('/x')
    expect(res.status).toBe(200)
  })

  it('rejects a request missing the permission with 403', async () => {
    const res = await makeApp(['resources:read'], 'resources:delete').request('/x')
    expect(res.status).toBe(403)
  })

  it('honors the full wildcard *', async () => {
    const res = await makeApp(['*'], 'resources:delete').request('/x')
    expect(res.status).toBe(200)
  })

  it('honors a resource wildcard (resources:*)', async () => {
    const res = await makeApp(['resources:*'], 'resources:delete').request('/x')
    expect(res.status).toBe(200)
  })

  it('rejects when the permission set is empty', async () => {
    const res = await makeApp([], 'resources:read').request('/x')
    expect(res.status).toBe(403)
  })
})

// Builds a minimal app: a stand-in for optionalMiddleware sets authUser,
// then the guard runs, then a handler that 200s if the guard let it through.
function makeApp(authUser: AuthUser | null) {
  const app = new Hono<HonoEnv>()
  app.use('/accounts/:id/members/:userId', async (c, next) => {
    c.set('authUser', authUser)
    return protectAccountOwner()(c, next)
  })
  app.patch('/accounts/:id/members/:userId', (c) => c.json({ ok: true }))
  app.get('/accounts/:id/members/:userId', (c) => c.json({ ok: true }))
  return app
}

const asUser = (id: string) => ({ id }) as AuthUser

describe('protectAccountOwner', () => {
  it('rejects an admin trying to modify the account owner membership', async () => {
    const db = createMockD1AsD1Database()
    setMockQueryResult(db, ['acc-1'], { owner_id: 'owner-1' })
    const res = await makeApp(asUser('admin-9')).request(
      '/accounts/acc-1/members/owner-1',
      { method: 'PATCH' },
      { DB: db },
    )
    expect(res.status).toBe(403)
  })

  it('allows the owner to modify their own membership', async () => {
    const db = createMockD1AsD1Database()
    setMockQueryResult(db, ['acc-1'], { owner_id: 'owner-1' })
    const res = await makeApp(asUser('owner-1')).request(
      '/accounts/acc-1/members/owner-1',
      { method: 'PATCH' },
      { DB: db },
    )
    expect(res.status).toBe(200)
  })

  it('allows modifying a non-owner member', async () => {
    const db = createMockD1AsD1Database()
    setMockQueryResult(db, ['acc-1'], { owner_id: 'owner-1' })
    const res = await makeApp(asUser('admin-9')).request(
      '/accounts/acc-1/members/member-3',
      { method: 'PATCH' },
      { DB: db },
    )
    expect(res.status).toBe(200)
  })

  it('ignores non-PATCH methods', async () => {
    const db = createMockD1AsD1Database()
    setMockQueryResult(db, ['acc-1'], { owner_id: 'owner-1' })
    const res = await makeApp(null).request(
      '/accounts/acc-1/members/owner-1',
      { method: 'GET' },
      { DB: db },
    )
    expect(res.status).toBe(200)
  })
})
