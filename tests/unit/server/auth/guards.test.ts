import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import type { AuthUser } from '@etus/auth'
import { protectAccountOwner } from '@server/auth/guards'
import type { HonoEnv } from '@server/types'
import { createMockD1AsD1Database, setMockQueryResult } from '@tests/mocks/db'

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
