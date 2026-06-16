import { describe, it, expect } from 'vitest'
import type { Hono } from 'hono'
import { buildApp } from '@server/index'
import type { HonoEnv } from '@server/types'
import type { Env } from '@server/env'
import { getEnv, getSqlite, seedUser, seedUserAccount } from '../setup'

// Mint a real session via dev test-login and return the session cookie + the account
// test-login provisioned for the user (ensureUserAccount).
async function login(
  app: Hono<HonoEnv>,
  env: Env,
  email: string,
  role = 'admin',
): Promise<{ cookie: string; accountId: string }> {
  const res = await app.request(
    'http://localhost/auth/test-login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: email.split('@')[0], role }),
    },
    env,
  )
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = /(?:^|,\s*)(auth_sid=[^;]+)/.exec(setCookie)
  if (!match) throw new Error(`no session cookie in Set-Cookie: ${setCookie}`)
  const body = (await res.json()) as { accountId: string }
  return { cookie: match[1], accountId: body.accountId }
}

// Local membership management (admin/member/guest) is the assignment surface the app
// owns, driven through @etus/auth's account routes. These run against the real worker
// via buildApp() (not the Vite dev server), so /accounts resolves normally.
describe('local membership assignment (account routes)', () => {
  it('GET /accounts returns the workspace test-login provisioned for the user', async () => {
    const env = getEnv()
    const app = buildApp(env)
    const { cookie, accountId } = await login(app, env, 'team-admin@example.com')

    const res = await app.request(
      'http://localhost/accounts',
      { method: 'GET', headers: { Cookie: cookie } },
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { accounts: { id: string }[] }
    expect(body.accounts.map((a) => a.id)).toContain(accountId)
  })

  it('PATCH /accounts/:id/members/:userId assigns a new role to a member', async () => {
    const env = getEnv()
    const app = buildApp(env)
    const { cookie, accountId } = await login(app, env, 'team-admin@example.com')

    // A second user, seeded as a plain member of the admin's workspace.
    const member = await seedUser({ email: 'teammate@example.com', name: 'Teammate', role: 'member', status: 'active' })
    await seedUserAccount({ userId: member.id, accountId, role: 'member' })

    const res = await app.request(
      `http://localhost/accounts/${accountId}/members/${member.id}`,
      {
        method: 'PATCH',
        headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: 'http://localhost' },
        body: JSON.stringify({ role: 'admin' }),
      },
      env,
    )

    expect(res.status).toBe(200)
    // The assignment persisted to the membership row.
    const row = getSqlite()
      .prepare('SELECT role FROM auth_memberships WHERE account_id = ? AND user_id = ?')
      .get(accountId, member.id) as { role: string } | undefined
    expect(row?.role).toBe('admin')
  })

  it('POST /accounts/:id/members/invite creates a pending invitation with the chosen role', async () => {
    const env = getEnv()
    const app = buildApp(env)
    const { cookie, accountId } = await login(app, env, 'team-admin@example.com')

    const res = await app.request(
      `http://localhost/accounts/${accountId}/members/invite`,
      {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: 'http://localhost' },
        body: JSON.stringify({ email: 'invitee@example.com', role: 'member' }),
      },
      env,
    )

    expect(res.status).toBeLessThan(300)
    // A pending invitation row exists for the invitee at the chosen role.
    const row = getSqlite()
      .prepare('SELECT role FROM auth_invitations WHERE account_id = ? AND email = ?')
      .get(accountId, 'invitee@example.com') as { role: string } | undefined
    expect(row?.role).toBe('member')
  })
})
