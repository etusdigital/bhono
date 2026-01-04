// src/server/routes/auth/test-login.ts
import type { RouteHandler } from '@hono/zod-openapi'
import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { execute, queryOne, type SqlRow } from '../../db/sql'
import type { UserRecord } from '../../db/records'
import { createSession } from '../../lib/session'
import type { HonoEnv } from '../../types'

const TestLoginSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
})

const USER_SELECT_COLUMNS = `
  id,
  google_id as googleId,
  email,
  name,
  avatar_url as avatarUrl,
  status,
  is_super_admin as isSuperAdmin,
  created_at as createdAt,
  updated_at as updatedAt,
  deleted_at as deletedAt
`

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

function mapUserRow(row: SqlRow): UserRecord {
  return {
    id: String(row.id ?? ''),
    googleId: String(row.googleId ?? row.google_id ?? ''),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    avatarUrl: row.avatarUrl ? String(row.avatarUrl) : null,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    providerIds: [],
    isSuperAdmin: toBoolean(row.isSuperAdmin ?? row.is_super_admin),
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ''),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
  }
}

export const testLoginRoute = createRoute({
  method: 'post',
  path: '/test-login',
  tags: ['Auth'],
  summary: 'Test login endpoint (development only)',
  description:
    'Creates or finds a test user and establishes a session. Only available in development/test environments.',
  request: {
    body: {
      content: { 'application/json': { schema: TestLoginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
            }),
            accountId: z.string().nullable().describe('The default account ID for API requests'),
          }),
        },
      },
    },
    403: {
      description: 'Not available in production',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({ message: z.string() }),
          }),
        },
      },
    },
  },
})

export const testLoginHandler: RouteHandler<typeof testLoginRoute, HonoEnv> = async (c) => {
  // Only allow in development/test
  const env = c.env
  if (env.ENVIRONMENT === 'production') {
    throw new HTTPException(403, { message: 'Not available in production' })
  }

  const { email, name } = c.req.valid('json')
  const db = c.env?.DB ?? c.get('db')

  if (!db) {
    throw new Error('Database not initialized')
  }

  // Find or create user
  const existingUser = await queryOne(
    db,
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email]
  )

  let user: UserRecord | undefined = existingUser ? mapUserRow(existingUser) : undefined
  let defaultAccountId: string | null = null

  if (user === undefined) {
    // Create test user
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    await execute(
      db,
      `INSERT INTO users (
        id,
        email,
        name,
        google_id,
        status,
        is_super_admin,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        email,
        name ?? 'E2E Test User',
        `test-${userId}`,
        'active',
        0,
        now,
        now,
      ]
    )

    const createdUser = await queryOne(
      db,
      `SELECT ${USER_SELECT_COLUMNS}
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    )

    user = createdUser ? mapUserRow(createdUser) : undefined

    // Create a default account for the user
    defaultAccountId = crypto.randomUUID()
    await execute(
      db,
      `INSERT INTO accounts (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [defaultAccountId, `${name ?? 'Test'}'s Workspace`, now, now]
    )

    // Link user to account as ADMIN
    await execute(
      db,
      `INSERT INTO user_accounts (user_id, account_id, role) VALUES (?, ?, ?)`,
      [userId, defaultAccountId, 'ADMIN']
    )
  } else {
    // Get the user's first account
    const userAccount = await queryOne<{ accountId: string }>(
      db,
      `SELECT account_id as accountId FROM user_accounts WHERE user_id = ? LIMIT 1`,
      [user.id]
    )

    if (userAccount?.accountId) {
      defaultAccountId = userAccount.accountId
    }
  }

  if (user === undefined) {
    throw new Error('Failed to create or find user')
  }

  // Create session
  await createSession(c, {
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    isSuperAdmin: user.isSuperAdmin,
  })

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accountId: defaultAccountId,
    },
    200
  )
}
